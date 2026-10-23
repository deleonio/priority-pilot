import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, Task, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { BUDGET_KIND } from './pushBudget.js';
import { TIP_PUSH_KIND, TIP_PUSH_TEXTE, runTipPush } from './tipPush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #2856 (Spec `docs/spec/issue-2856.md`) — Tipps-Hinweis-Sweep
 * (push-konzept.md §8). Vertrag: `runTipPush(now, send)` sendet Free + Opt-in mit mindestens
 * drei passenden Aufgaben (Ort = Koordinaten gesetzt; „für andere angelegt“ = createdById +
 * fremder userId/groupId) höchstens alle 30 Tage genau einen Hinweis auf `/settings/pakete`;
 * Schalter aus / Plan plus|pro / Konto < 7 Tage senden nichts; das Kind ist im Push-Budget
 * registriert und wird bei erschöpftem Budget verdrängt. Umsetzung von `tipPush.ts` im selben PR.
 * Muster: `aboPush.test.ts` (injizierbare Uhr, injizierbarer PushSender, Log erst bei sent > 0).
 */

const TAG_MS = 24 * 60 * 60 * 1000;
/** 10:00 UTC — außerhalb der Ruhezeit (21–7); Testnutzer ohne Zeitzone: UTC-Fallback. */
const NOW = new Date('2026-10-21T10:00:00Z');

/** Empfänger mit Push-Subscription (ohne PushSubscription: sent = 0, kein Log). */
const seedEmpfaenger = async (email: string, extra: Record<string, unknown> = {}): Promise<User> => {
	const user = await User.create({
		email,
		displayName: 'Tipps',
		passwordHash: '__test__',
		...extra,
	} as never);
	await PushSubscription.create({
		endpoint: `https://push.example.com/${user.id}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: user.id,
	});
	return user;
};

const seedTask = async (extra: Record<string, unknown> = {}): Promise<Task> =>
	Task.create({ title: 'Aufgabe', ...extra } as never);

/** Send-Falle: PushSender erhält die Wire-Payload als STRING — erst JSON.parse macht Felder auswertbar. */
const fangSender =
	(calls: string[]): PushSender =>
	(_subscription, payload) => {
		calls.push(payload);
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

/** Free-Konto mit Opt-in, älter als 7 Tage, plus `anzahl` Orts-Aufgaben (AK2-Grundkonstellation). */
const seedOrtKonstellation = async (email: string): Promise<User> => {
	const user = await seedEmpfaenger(email, {
		tipPushEnabled: true,
		createdAt: new Date(NOW.getTime() - 30 * TAG_MS),
	});
	for (let i = 0; i < 3; i++) {
		await seedTask({ userId: user.id, latitude: 52.52 + i, longitude: 13.4 + i });
	}
	return user;
};

describe('tipPush — Tipps-Hinweis (#2856, push-konzept.md §8)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: Schalter aus / Plan plus / Konto juenger als 7 Tage → 0 sends, 0 Logs', async () => {
		await seedEmpfaenger('tip-aus@example.com');
		await seedEmpfaenger('tip-plus@example.com', { plan: 'plus', tipPushEnabled: true });
		await seedEmpfaenger('tip-jung@example.com', {
			tipPushEnabled: true,
			createdAt: new Date(NOW.getTime() - 3 * TAG_MS),
		});
		for (const user of await User.findAll()) {
			for (let i = 0; i < 3; i++) {
				await seedTask({ userId: user.id, latitude: 52.5 + i, longitude: 13.4 + i });
			}
		}

		const calls: string[] = [];
		const { sends } = await runTipPush(NOW, fangSender(calls));

		assert.equal(sends, 0);
		assert.equal(await NotificationLog.count(), 0, 'weder Fach-Log noch Budget-Marker');
	});

	it('AK2: Free + Opt-in + 3 Orts-Aufgaben → genau 1 Hinweis auf /settings/pakete, Zweitlauf 0', async () => {
		await seedOrtKonstellation('tip-ort@example.com');

		const calls: string[] = [];
		const eins = await runTipPush(NOW, fangSender(calls));
		assert.equal(eins.sends, 1);
		assert.equal(JSON.parse(calls[0] ?? '{}').url, '/settings/pakete');

		const zwei = await runTipPush(NOW, fangSender(calls));
		assert.equal(zwei.sends, 0, 'statisches Signalmuster dedupet den Zweitlauf');
	});

	it('AK3: 3 fuer andere angelegte Aufgaben → genau 1 Gruppen-Hinweis; Doppel-Signal → genau 1 (Ort zuerst)', async () => {
		const nutzer = await seedEmpfaenger('tip-gruppen@example.com', {
			tipPushEnabled: true,
			createdAt: new Date(NOW.getTime() - 30 * TAG_MS),
		});
		const fremd = await seedEmpfaenger('tip-fremd@example.com');
		for (let i = 0; i < 3; i++) {
			await seedTask({ createdById: nutzer.id, userId: fremd.id });
		}

		const calls: string[] = [];
		const { sends } = await runTipPush(NOW, fangSender(calls));
		assert.equal(sends, 1);
		assert.equal(
			JSON.parse(calls[0] ?? '{}').title,
			TIP_PUSH_TEXTE.gruppe.de.title,
			'Gruppen-Signal allein → Gruppen-Hinweis',
		);
	});

	it('AK3: beide Signale an → genau ein Push mit dem Ortserinnerungen-Text', async () => {
		const nutzer = await seedOrtKonstellation('tip-doppel@example.com');
		const fremd = await seedEmpfaenger('tip-doppel-fremd@example.com');
		for (let i = 0; i < 3; i++) {
			await seedTask({ createdById: nutzer.id, userId: fremd.id });
		}

		const calls: string[] = [];
		const { sends } = await runTipPush(NOW, fangSender(calls));
		assert.equal(sends, 1, 'kein zweiter Hinweis im selben Lauf');
		assert.equal(JSON.parse(calls[0] ?? '{}').title, TIP_PUSH_TEXTE.ort.de.title, 'Ortserinnerungen zuerst');
	});

	it('AK4: nach Zustellung 29 Tage still, ab Tag 31 wieder hoechstens einer', async () => {
		await seedOrtKonstellation('tip-fenster@example.com');

		const calls: string[] = [];
		assert.equal((await runTipPush(NOW, fangSender(calls))).sends, 1);
		assert.equal(
			(await runTipPush(new Date(NOW.getTime() + 29 * TAG_MS), fangSender(calls))).sends,
			0,
			'NotificationLog-Fenster: Tag 29 blockiert',
		);
		assert.equal(
			(await runTipPush(new Date(NOW.getTime() + 31 * TAG_MS), fangSender(calls))).sends,
			1,
			'danach wieder genau einer (zeitbezogener DedupeKey)',
		);
	});

	it('AK5: erschöpftes Tagesbudget verdrängt den Hinweis (0 sends, kein Fach-Log, kein Budget-Marker)', async () => {
		const nutzer = await seedOrtKonstellation('tip-budget@example.com');
		for (const i of [0, 1, 2]) {
			await NotificationLog.create({
				userId: nutzer.id,
				kind: BUDGET_KIND,
				dedupeKey: `${nutzer.id}:2026-10-21:b${i}`,
				sentAt: NOW,
			});
		}

		const calls: string[] = [];
		const { sends } = await runTipPush(NOW, fangSender(calls));

		assert.equal(sends, 0, 'kein Service-Kind: das Budget-Tor gilt');
		assert.equal(await NotificationLog.count({ where: { kind: TIP_PUSH_KIND } }), 0, 'kein Fach-Log');
		assert.equal(await NotificationLog.count({ where: { kind: BUDGET_KIND } }), 3, 'kein Budget-Marker');
	});
});
