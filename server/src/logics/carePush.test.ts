import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SendResult } from 'web-push';
import {
	FcmToken,
	NotificationLog,
	Pillar,
	PushSubscription,
	ScoreEntry,
	Task,
	TaskPillar,
	User,
} from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runDueTaskReminders } from './dueTaskReminders.js';
import { CARE_SPRACHEN } from './careSuggestionData.js';
import { CARE_PUSH_TEXTE, pushTextFuer, runCarePush } from './carePush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #1794 (Spec: docs/spec/issue-1794.md) — fachlicher Fürsorge-Push.
 *
 * - AK1: mind. eine defizitäre/überlastete Säule → höchstens ein Push je lokalem Kalendertag
 *   (NotificationLog `kind: 'care-push'`, `dedupeKey: <userId>:<lokalesISO-Datum>`).
 * - AK2: kein Versand zwischen 21:00 und 08:00 der Nutzer-Zeitzone (08:00 selbst erlaubt).
 * - AK3: ohne betroffene Säule kein Versand und kein Log-Eintrag.
 * - AK4: der Fürsorge-Schalter stoppt nur den Fürsorge-Push, Frist-Erinnerungen laufen weiter.
 * - AK5: Versand über `sendPushToUser` — Web-Push-Subscription UND FCM-Token desselben Nutzers.
 * - AK6: Textkatalog je Situation in allen zehn CARE_SPRACHEN, Fallback für unbekannte Säulen.
 * - AK8: ungültige/fehlende Zeitzone fällt auf UTC zurück, ohne den Lauf zu brechen.
 *
 * `carePush.ts` existiert noch nicht — der fehlende Modul-Import ist hier der legitime erste
 * Rot-Zustand; die Impl-Phase liefert Modul und User-Spalten (`carePushEnabled`, `zeitzone`).
 * Spalten, die es noch nicht gibt, werden beim Seeding per Cast gesetzt (Muster: MEMORY.md
 * 2026-08-23, Produktiv-Typen unangetastet lassen).
 */

// Nutzer-Zeitzone Europa/Berlin, Juli = CEST (UTC+2):
// 05:59Z → 07:59 lokal, 06:00Z → 08:00 lokal, 19:30Z → 21:30 lokal, 20:30Z → 22:30 lokal.
const NOW = new Date('2026-07-07T06:00:00Z');

type CareUserAttrs = { carePushEnabled?: boolean; zeitzone?: string | null };

const seedUser = async (email: string, extra: CareUserAttrs = {}) =>
	// `carePushEnabled`/`zeitzone` entstehen erst mit der Impl-Phase (#1794) — Cast statt Typ-Änderung.
	User.create({ email, displayName: 'Care Empfänger', passwordHash: '__test__', ...extra } as never);

const seedPillar = (name: string, userId: number) => Pillar.create({ name, userId });

const seedSubscription = (userId: number, endpoint: string) =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

/** Erledigter Aufwand auf genau einer Säule (share 100 %) mit ScoreEntry-Zeitpunkt im jungen Fenster. */
const seedDoneEffort = async (
	userId: number,
	pillarId: number,
	effort: number,
	erledigtAm: Date,
	title = `Done ${pillarId}`,
) => {
	const task = await Task.create({ title, status: 'Done', priority: 3, estimatedEffort: effort, userId });
	await TaskPillar.create({ taskId: task.id, pillarId, share: 100, confidence: 1 });
	await ScoreEntry.create({ taskId: task.id, punkte: Math.round(effort * 10), pünktlich: true, zeitpunkt: erledigtAm });
};

/** Erfolgs-Sender: zählt die Aufrufe und liefert die versendete Payload (Muster dueTaskReminders.test.ts). */
const okSender =
	(calls: { endpoint: string; body: string }[]): PushSender =>
	(subscription, payload) => {
		calls.push({ endpoint: subscription.endpoint, body: payload });
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

/** Frischer, deficitärer Nutzer: eine Säule, keinerlei erledigter Aufwand im jungen Fenster. */
const seedDeficitUser = async (email: string, extra: CareUserAttrs = {}) => {
	const user = await seedUser(email, extra);
	await seedPillar('Körper', user.id);
	await seedSubscription(user.id, `https://push.example.com/${user.id}`);
	return user;
};

describe('logics/carePush — fachlicher Fürsorge-Push (Issue #1794)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: Defizit-Säule → erster Lauf sendet genau einen Push mit url "/" und Log-Zeile <userId>:<lokalesDatum>', async () => {
		await seedDeficitUser('care-deficit@example.com');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runCarePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1, 'genau eine gebündelte Nachricht trotz Defizit-Auswertung');
		const payload = JSON.parse(calls[0].body) as { title: string; body: string; url: string };
		assert.equal(payload.url, '/', 'der Push öffnet das Dashboard (KI-UX: Zustand dort sichtbar)');
		assert.notEqual(payload.title.trim(), '', 'Titel aus dem Katalog, kein Leerstring');
		assert.notEqual((payload.body ?? '').trim(), '', 'Text aus dem Katalog, kein Leerstring');
		const log = await NotificationLog.findOne({ where: { kind: 'care-push' } });
		assert.ok(log, 'der Versand wird als care-push protokolliert');
		assert.equal(log.userId, 1);
		assert.match(log.dedupeKey, /^1:2026-07-07$/, 'dedupeKey = <userId>:<lokalesISO-Datum> (Nutzer-Zeitzone)');
	});

	it('AK1: zweiter Lauf am selben lokalen Kalendertag sendet nichts, am Folgetag erneut', async () => {
		await seedDeficitUser('care-dedup@example.com', { zeitzone: 'Europe/Berlin' });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const first = await runCarePush(new Date('2026-07-07T06:00:00Z'), send); // 08:00 lokal
		const second = await runCarePush(new Date('2026-07-07T06:30:00Z'), send); // 08:30 lokal, gleicher Tag
		const third = await runCarePush(new Date('2026-07-08T06:00:00Z'), send); // nächster lokaler Tag

		assert.equal(first.usersNotified, 1);
		assert.equal(second.usersNotified, 0, 'wiederholter Lauf am selben lokalen Kalendertag sendet nichts');
		assert.equal(third.usersNotified, 1, 'am Folgetag ist der Push wieder erlaubt');
		assert.equal(calls.length, 2);
	});

	it('AK1: eine nur überlastete Säule (kein Defizit) löst den Fürsorge-Push ebenfalls aus', async () => {
		const user = await seedDeficitUser('care-overload@example.com');
		const koerper = (await Pillar.findOne({ where: { userId: user.id } }))!;
		const soziales = await seedPillar('Soziales', user.id);
		const gestern = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
		// 75 % des Aufwands auf „Körper" → Überlast (> 50 %), „Soziales" hat Aufwand → kein Defizit.
		await seedDoneEffort(user.id, koerper.id, 3, gestern, 'Überlast-Körper');
		await seedDoneEffort(user.id, soziales.id, 1, gestern, 'Überlast-Soziales');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runCarePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1, 'Überlast ohne Defizit ist ebenfalls ein Fürsorge-Anlass');
		assert.equal(calls.length, 1);
	});

	it('AK2: Ruhezeit 21–8 Uhr Nutzer-Zeitzone — 07:59 kein Versand, 08:00 schon, 22:30 keiner', async () => {
		await seedDeficitUser('care-quiet-1@example.com', { zeitzone: 'Europe/Berlin' });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const frueh = await runCarePush(new Date('2026-07-07T05:59:00Z'), send); // 07:59 Berlin
		const grenze = await runCarePush(new Date('2026-07-07T06:00:00Z'), send); // 08:00 Berlin

		assert.equal(frueh.usersNotified, 0, '07:59 liegt noch in der Ruhezeit');
		assert.equal(grenze.usersNotified, 1, '08:00 ist die erlaubte Grenze');
		assert.equal(calls.length, 1);

		// Zweiter Nutzer, derselbe Schicht-Nacht-Fall: 22:30 lokal.
		await seedDeficitUser('care-quiet-2@example.com', { zeitzone: 'Europe/Berlin' });
		const nachts = await runCarePush(new Date('2026-07-07T20:30:00Z'), send); // 22:30 Berlin

		assert.equal(nachts.usersNotified, 0, '22:30 liegt in der Ruhezeit');
		assert.equal(calls.length, 1, 'auch nachts wird kein zweiter Push ausgelöst');
	});

	it('AK3: ausgewogene Säulen → kein Versand und kein NotificationLog-Eintrag', async () => {
		const user = await seedDeficitUser('care-balanced@example.com');
		const koerper = (await Pillar.findOne({ where: { userId: user.id } }))!;
		const soziales = await seedPillar('Soziales', user.id);
		const gestern = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
		// Gleicher Aufwand auf beiden Säulen: kein Defizit, keine Überlast (50 % ≠ strikt > 50 %).
		await seedDoneEffort(user.id, koerper.id, 1, gestern, 'Ausgleich-Körper');
		await seedDoneEffort(user.id, soziales.id, 1, gestern, 'Ausgleich-Soziales');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runCarePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0, 'ohne betroffene Säule kein Log-Eintrag');
	});

	it('AK4: Schalter aus → kein Fürsorge-Push', async () => {
		await seedDeficitUser('care-off@example.com', { carePushEnabled: false });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runCarePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'der eigene Schalter stoppt nur den Fürsorge-Push');
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK4: Frist-Erinnerungen laufen bei ausgeschaltetem Fürsorge-Schalter unverändert', async () => {
		await seedDeficitUser('care-off-due@example.com', { carePushEnabled: false });
		await Task.create({
			title: 'Fällige Aufgabe',
			status: 'Open',
			priority: 3,
			estimatedEffort: 0.5,
			deadline: new Date(NOW.getTime() - 60 * 60 * 1000),
			userId: 1,
		});
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1, 'der Fürsorge-Schalter darf Frist-Erinnerungen nicht anfassen');
		assert.equal(calls.length, 1);
	});

	it('AK5: Web-Push-Subscription und FCM-Token desselben Nutzers erhalten beide die Payload', async () => {
		const user = await seedDeficitUser('care-channels@example.com');
		await FcmToken.create({ token: 'fcm-token-1794', userId: user.id });

		// FCM kanal-seitig aktivieren: Service-Account-Datei mit frischem RSA-Schlüssel (googleAuth
		// signiert lokal, nur die Token-/Send-URLs laufen über fetch → Stub fängt beide ab).
		const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
		const dir = mkdtempSync(join(tmpdir(), 'care-push-fcm-'));
		const keyFile = join(dir, `sa-${process.pid}-${Date.now()}.json`);
		writeFileSync(
			keyFile,
			JSON.stringify({
				project_id: 'care-push-test',
				client_email: 'care-push@test.iam.gserviceaccount.com',
				private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
			}),
		);
		const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
		assert.ok(publicKeyPem.includes('BEGIN PUBLIC KEY'), 'RSA-Schlüssel für den Service-Account erzeugt');
		const fcmCalls: { url: string; body: string }[] = [];
		const fetchMock = mock.method(globalThis, 'fetch', (async (url: string | URL | Request, init?: RequestInit) => {
			fcmCalls.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : '' });
			return new Response(JSON.stringify({ access_token: 'test-token', name: 'projects/care-push-test/messages/1' }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}) as typeof fetch);
		process.env.FCM_SERVICE_ACCOUNT_FILE = keyFile;
		const calls: { endpoint: string; body: string }[] = [];
		try {
			const result = await runCarePush(NOW, okSender(calls));

			assert.equal(result.usersNotified, 1);
			assert.equal(calls.length, 1, 'Web-Push-Subscription erhält genau eine Nachricht');
			const payload = JSON.parse(calls[0].body) as { title: string; body: string };
			const fcmSend = fcmCalls.find((call) => call.url.includes('fcm.googleapis.com'));
			assert.ok(fcmSend, 'FCM-Versand läuft über denselben Lauf');
			const fcmMessage = JSON.parse(fcmSend.body) as {
				message: { token: string; notification: { title: string; body: string } };
			};
			assert.equal(fcmMessage.message.token, 'fcm-token-1794');
			assert.equal(fcmMessage.message.notification.title, payload.title, 'dieselbe Payload auf beiden Kanälen');
			assert.equal(fcmMessage.message.notification.body, payload.body);
		} finally {
			fetchMock.mock.restore();
			delete process.env.FCM_SERVICE_ACCOUNT_FILE;
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('AK6: Katalog je Situation in allen zehn Sprachen vollständig, Fallback für unbekannte Säule', () => {
		for (const situation of ['defizit', 'ueberlast'] as const) {
			const eintraege = CARE_PUSH_TEXTE.filter((eintrag) => eintrag.situation === situation);
			for (const saeuleId of [1, 2, 3, 4, 5]) {
				const eintrag = eintraege.find((kandidat) => kandidat.saeuleId === saeuleId);
				assert.ok(eintrag, `${situation}: kanonische Säule ${saeuleId} hat Katalog-Einträge`);
				for (const sprache of CARE_SPRACHEN) {
					const text = eintrag.texte[sprache];
					assert.ok(text, `${situation}/Säule ${saeuleId}: Sprache ${sprache} fehlt`);
					assert.notEqual(text.titel.trim(), '', `${situation}/Säule ${saeuleId}/${sprache}: Titel leer`);
					assert.notEqual(text.text.trim(), '', `${situation}/Säule ${saeuleId}/${sprache}: Text leer`);
				}
			}
		}
		// Nutzerdefinierte Säulen (Id > 5) bekommen den generischen Fallback statt leerer Texte.
		for (const situation of ['defizit', 'ueberlast'] as const) {
			for (const sprache of CARE_SPRACHEN) {
				const fallback = pushTextFuer(situation, 99, sprache);
				assert.notEqual(fallback.titel.trim(), '', `${situation}/${sprache}: Fallback-Titel leer`);
				assert.notEqual(fallback.text.trim(), '', `${situation}/${sprache}: Fallback-Text leer`);
			}
		}
		// Der sprachspezifische Text für eine kanonische Säule ist kein Fallback-Ersatz:
		assert.equal(
			pushTextFuer('defizit', 1, 'de').titel,
			CARE_PUSH_TEXTE.find((e) => e.situation === 'defizit' && e.saeuleId === 1)!.texte.de.titel,
		);
	});

	it('AK8: ungültige oder fehlende Zeitzone bricht den Lauf nicht und fällt auf UTC zurück', async () => {
		await seedDeficitUser('care-tz-bad@example.com', { zeitzone: 'Mars/Olympus' });
		await seedDeficitUser('care-tz-null@example.com', { zeitzone: null });
		const calls: { endpoint: string; body: string }[] = [];

		// 19:30 UTC liegt außerhalb der UTC-Ruhezeit — mit dem UTC-Fallback wird versendet;
		// in Europa/Berlin wäre es 21:30 und damit blockiert (differenziert den Fallback).
		const result = await runCarePush(new Date('2026-07-07T19:30:00Z'), okSender(calls));

		assert.equal(result.usersNotified, 2, 'beide Nutzer werden mit dem UTC-Fallback bedient');
		assert.equal(calls.length, 2);
	});
});
