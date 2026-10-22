import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, Task, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runWelcomeStepsPush } from './welcomeStepsPush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #2855 — Willkommensschritte-Push (AK5); Vertrag: `docs/spec/issue-2855.md`.
 * `welcomeStepsPush.ts` existiert noch nicht — der fehlende Modul-Import ist der legitime erste
 * Rot-Zustand; die Impl-Phase liefert das Modul.
 */

// Europa/Berlin, Juli = CEST (UTC+2). 2026-07-07 ist Dienstag.
const NOW = new Date('2026-07-07T12:00:00Z');

type PushUserAttrs = { taskPushEnabled?: boolean; sprache?: string | null };

const seedUser = (email: string, extra: PushUserAttrs = {}) =>
	User.create({
		email,
		displayName: 'Willkommen Empfänger',
		passwordHash: '__test__',
		zeitzone: 'Europe/Berlin',
		...extra,
	});

const seedSubscription = (userId: number, endpoint: string) =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

const okSender =
	(calls: { endpoint: string; body: string }[]): PushSender =>
	(subscription, payload) => {
		calls.push({ endpoint: subscription.endpoint, body: payload });
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

const payloadVon = (calls: { endpoint: string; body: string }[], index: number) =>
	JSON.parse(calls[index]!.body) as { title: string; body: string; url: string };

/** Nutzer mit auf `lokalesDatum + tageZurueck` zurückdatiertem createdAt (statisches Update, MEMORY 2026-10-05). */
const seedNutzerAb = async (email: string, createdAt: string, extra: PushUserAttrs = {}) => {
	const user = await seedUser(email, extra);
	await seedSubscription(user.id, `https://push.example.com/${email}`);
	await User.update({ createdAt: new Date(createdAt) }, { where: { id: user.id } });
	return user;
};

describe('logics/welcomeStepsPush — Willkommensschritte (#2855 AK5)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK5: lokaler Tag 2 nach Registrierung, ohne Aufgabe → Push mit Ziel /#karte-willkommen, fixer Dedup <userId> (AK7: de/en)', async () => {
		const de = await seedNutzerAb('ws-de@example.com', '2026-07-05T10:00:00Z', { sprache: 'de' });
		await seedNutzerAb('ws-en@example.com', '2026-07-05T10:00:00Z', { sprache: 'en' });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeStepsPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 2);
		const erstes = payloadVon(calls, 0);
		assert.equal(erstes.url, '/#karte-willkommen', 'der Push öffnet die Willkommens-Karte');
		assert.notEqual(erstes.title.trim(), '');
		assert.notEqual((erstes.body ?? '').trim(), '');
		assert.notEqual(payloadVon(calls, 1).title, erstes.title, 'AK7: de- und en-Text unterscheiden sich');
		const log = await NotificationLog.findOne({ where: { kind: 'welcome-steps', userId: de.id } });
		assert.ok(log, 'der Versand wird als welcome-steps protokolliert');
		assert.equal(log.dedupeKey, String(de.id), 'fixer Dedup-Key = <userId> — genau einmal je Konto');
	});

	it('AK5: Tag 1 und Tag 3 nach Registrierung senden nichts (nur Tag 2)', async () => {
		await seedNutzerAb('ws-tag1@example.com', '2026-07-06T10:00:00Z');
		await seedNutzerAb('ws-tag3@example.com', '2026-07-04T10:00:00Z');
		const send = okSender([]);

		const result = await runWelcomeStepsPush(NOW, send);

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK5: Nutzer mit Aufgabe (Task-Schritt erledigt) bekommt keinen Push', async () => {
		const user = await seedNutzerAb('ws-mit@example.com', '2026-07-05T10:00:00Z');
		await Task.create({ title: 'Erste Aufgabe', status: 'Open', priority: 3, estimatedEffort: 0.5, userId: user.id });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeStepsPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'wer eine Aufgabe hat, braucht die Willkommensschritte nicht');
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK5: fixer Dedup-Key — auch ein Jahr später kein zweiter Push', async () => {
		await seedNutzerAb('ws-fix@example.com', '2026-07-05T10:00:00Z');
		const send = okSender([]);

		const erster = await runWelcomeStepsPush(NOW, send);
		const zweiter = await runWelcomeStepsPush(new Date('2027-07-07T12:00:00Z'), send);

		assert.equal(erster.usersNotified, 1);
		assert.equal(zweiter.usersNotified, 0, 'genau einmal je Konto, unabhängig vom Datum');
	});

	it('AK5: Aufgaben-Schalter aus → kein Willkommensschritte-Push', async () => {
		await seedNutzerAb('ws-off@example.com', '2026-07-05T10:00:00Z', { taskPushEnabled: false });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeStepsPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK5: Tagesfenster Tag 09–18 — vor 09:00 lokal kein Versand, ab 09:00 versendet (08:59/09:00 Berlin)', async () => {
		await seedNutzerAb('ws-fenster@example.com', '2026-07-05T10:00:00Z');
		const calls: { endpoint: string; body: string }[] = [];

		// Europa/Berlin, Juli = CEST (UTC+2): 06:59Z = 08:59 lokal, 07:00Z = 09:00 lokal — beides
		// liegt auf dem lokalen Tag 2 (2026-07-07), nur die Stunde unterscheidet.
		await runWelcomeStepsPush(new Date('2026-07-07T06:59:00Z'), okSender(calls));
		assert.equal(calls.length, 0, 'vor dem lokalen Fenster wird nicht gesendet');
		assert.equal(await NotificationLog.count(), 0);

		const result = await runWelcomeStepsPush(new Date('2026-07-07T07:00:00Z'), okSender(calls));

		assert.equal(result.usersNotified, 1, 'ab 09:00 lokal wird gesendet');
		assert.equal(calls.length, 1);
	});
});
