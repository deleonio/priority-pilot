import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { JournalEntry, NotificationLog, PushSubscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runJournalImpulsePush } from './journalImpulsePush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #2855 — Journal-Impuls (AK4); Vertrag: `docs/spec/issue-2855.md`.
 * `journalImpulsePush.ts` existiert noch nicht — der fehlende Modul-Import ist der legitime
 * erste Rot-Zustand; die Impl-Phase liefert das Modul.
 */

// Europa/Berlin, Juli = CEST (UTC+2): 17:00Z → 19:00 lokal (Abendfenster 18–20). 2026-07-07 = W28.
const NOW = new Date('2026-07-07T17:00:00Z');

type PushUserAttrs = { carePushEnabled?: boolean; sprache?: string | null };

const seedUser = (email: string, extra: PushUserAttrs = {}) =>
	User.create({
		email,
		displayName: 'Journal Empfänger',
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

/** Journal-Nutzer mit einem Eintrag (createdAt = jetzt, also frisch). */
const seedJournalNutzer = async (email: string, extra: PushUserAttrs = {}) => {
	const user = await seedUser(email, extra);
	await seedSubscription(user.id, `https://push.example.com/${email}`);
	await JournalEntry.create({ userId: user.id, text: 'Heute war viel.', date: '2026-07-06', pillarId: null });
	return user;
};

describe('logics/journalImpulsePush — Journal-Impuls (#2855 AK4)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK4: Journal-Eintrag in 30 Tagen + Abendfenster → Push mit Ziel /journal, Slot-Dedup (AK7: de/en)', async () => {
		await seedJournalNutzer('ji-de@example.com', { sprache: 'de' });
		await seedJournalNutzer('ji-en@example.com', { sprache: 'en' });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runJournalImpulsePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 2);
		const erstes = payloadVon(calls, 0);
		assert.equal(erstes.url, '/journal', 'der Push öffnet das Journal');
		assert.notEqual(erstes.title.trim(), '');
		assert.notEqual((erstes.body ?? '').trim(), '');
		assert.notEqual(payloadVon(calls, 1).title, erstes.title, 'AK7: de- und en-Text unterscheiden sich');
		const logs = await NotificationLog.findAll({ where: { kind: 'journal-impulse' } });
		assert.equal(logs.length, 2, 'beide Zustellungen werden protokolliert');
		assert.match(logs[0]!.dedupeKey, /^1:2026-W28:\d+$/, 'Dedup = <userId>:<ISO-Woche>:<slot>');
	});

	it('AK4: ohne Journal-Eintrag kein Push und kein Log', async () => {
		const user = await seedUser('ji-ohne@example.com');
		await seedSubscription(user.id, 'https://push.example.com/ji-ohne');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runJournalImpulsePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'nur Journal-Nutzer bekommen den Impuls');
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK4: letzter Journal-Eintrag älter als 30 Tage → kein Push', async () => {
		const user = await seedJournalNutzer('ji-alt@example.com');
		const eintrag = (await JournalEntry.findOne({ where: { userId: user.id } }))!;
		await JournalEntry.update({ createdAt: new Date('2026-06-05T12:00:00Z') }, { where: { id: eintrag.id } });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runJournalImpulsePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, '32 Tage alter Eintrag zählt nicht mehr');
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK4: Abendfenster — 17:59 lokal kein Versand, 18:00 lokal ja', async () => {
		await seedJournalNutzer('ji-fenster@example.com');
		const send = okSender([]);

		const vorFenster = await runJournalImpulsePush(new Date('2026-07-07T15:59:00Z'), send); // 17:59 Berlin
		const fensterAuf = await runJournalImpulsePush(new Date('2026-07-07T16:00:00Z'), send); // 18:00 Berlin

		assert.deepEqual([vorFenster.usersNotified, fensterAuf.usersNotified], [0, 1]);
	});

	it('AK4: 20:00 lokal liegt außerhalb des Abendfensters', async () => {
		await seedJournalNutzer('ji-spaet@example.com');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runJournalImpulsePush(new Date('2026-07-07T18:00:00Z'), okSender(calls)); // 20:00 Berlin

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK4: höchstens 2 je ISO-Woche — der dritte Lauf der Woche sendet nichts', async () => {
		await seedJournalNutzer('ji-limit@example.com');
		const send = okSender([]);

		const erster = await runJournalImpulsePush(new Date('2026-07-07T16:00:00Z'), send); // Di 18:00
		const zweiter = await runJournalImpulsePush(new Date('2026-07-09T17:00:00Z'), send); // Do 19:00
		const dritter = await runJournalImpulsePush(new Date('2026-07-10T17:00:00Z'), send); // Fr 19:00, gleiche Woche

		assert.deepEqual([erster.usersNotified, zweiter.usersNotified, dritter.usersNotified], [1, 1, 0]);
		const logs = await NotificationLog.findAll({ where: { kind: 'journal-impulse' } });
		assert.equal(logs.length, 2);
		assert.notEqual(logs[0]!.dedupeKey, logs[1]!.dedupeKey, 'beide Sends brauchen unterscheidbare Keys');
	});

	it('AK4: Fürsorge-Schalter aus → kein Journal-Impuls', async () => {
		await seedJournalNutzer('ji-off@example.com', { carePushEnabled: false });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runJournalImpulsePush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});
});
