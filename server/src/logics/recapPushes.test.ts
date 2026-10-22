import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runWeeklyRecapPush, runYearlyRecapPush } from './recapPushes.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #2855 — Wochenrückblick (AK2) und Jahresrückblick (AK3);
 * Vertrag: `docs/spec/issue-2855.md`. `recapPushes.ts` existiert noch nicht — der fehlende
 * Modul-Import ist der legitime erste Rot-Zustand; die Impl-Phase liefert das Modul.
 */

type PushUserAttrs = { successPushEnabled?: boolean; sprache?: string | null };

const seedUser = (email: string, extra: PushUserAttrs = {}) =>
	User.create({
		email,
		displayName: 'Rückblick Empfänger',
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

describe('logics/recapPushes — Wochenrückblick (#2855 AK2)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK2: Sonntag 17–20 Uhr Ortszeit → Push mit Ziel /#karte-wochenrueckblick, Dedup <userId>:<ISO-Woche> (AK7: de/en)', async () => {
		const de = await seedUser('wr-de@example.com', { sprache: 'de' });
		await seedUser('wr-en@example.com', { sprache: 'en' });
		await seedSubscription(de.id, 'https://push.example.com/wr-de');
		await seedSubscription(de.id + 1, 'https://push.example.com/wr-en');
		const calls: { endpoint: string; body: string }[] = [];

		// 2026-07-19 ist Sonntag; 17:30Z = 19:30 Berlin (CEST +2), ISO-Woche 2026-W29.
		const result = await runWeeklyRecapPush(new Date('2026-07-19T17:30:00Z'), okSender(calls));

		assert.equal(result.usersNotified, 2);
		const erstes = payloadVon(calls, 0);
		assert.equal(erstes.url, '/#karte-wochenrueckblick', 'der Push öffnet die Wochenkarte');
		assert.notEqual(erstes.title.trim(), '');
		assert.notEqual((erstes.body ?? '').trim(), '');
		assert.notEqual(payloadVon(calls, 1).title, erstes.title, 'AK7: de- und en-Text unterscheiden sich');
		const log = await NotificationLog.findOne({ where: { kind: 'weekly-recap', userId: de.id } });
		assert.ok(log, 'der Versand wird als weekly-recap protokolliert');
		assert.match(log.dedupeKey, /^1:2026-W29$/, 'Dedup-Key = <userId>:<ISO-Woche>');
	});

	it('AK2: Montag sendet nichts (nur Sonntag)', async () => {
		const user = await seedUser('wr-mo@example.com');
		await seedSubscription(user.id, 'https://push.example.com/wr-mo');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWeeklyRecapPush(new Date('2026-07-20T15:30:00Z'), okSender(calls)); // Mo, 17:30 lokal

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK2: Fenster-Grenze — 16:59 lokal kein Versand, 17:00 lokal ja', async () => {
		const user = await seedUser('wr-fenster@example.com');
		await seedSubscription(user.id, 'https://push.example.com/wr-fenster');
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const vorFenster = await runWeeklyRecapPush(new Date('2026-07-19T14:59:00Z'), send); // 16:59 Berlin
		const fensterAuf = await runWeeklyRecapPush(new Date('2026-07-19T15:00:00Z'), send); // 17:00 Berlin

		assert.equal(vorFenster.usersNotified, 0, 'vor 17:00 lokal kein Versand');
		assert.equal(fensterAuf.usersNotified, 1, '17:00 lokal öffnet das Fenster');
		assert.equal(calls.length, 1);
	});

	it('AK2: 20:00 lokal liegt außerhalb des Fensters', async () => {
		const user = await seedUser('wr-abend@example.com');
		await seedSubscription(user.id, 'https://push.example.com/wr-abend');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWeeklyRecapPush(new Date('2026-07-19T18:00:00Z'), okSender(calls)); // 20:00 Berlin

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK2: zweiter Lauf am selben Sonntag sendet nichts (1 je ISO-Woche)', async () => {
		const user = await seedUser('wr-dedup@example.com');
		await seedSubscription(user.id, 'https://push.example.com/wr-dedup');
		const send = okSender([]);

		const erster = await runWeeklyRecapPush(new Date('2026-07-19T15:30:00Z'), send);
		const zweiter = await runWeeklyRecapPush(new Date('2026-07-19T17:30:00Z'), send);

		assert.deepEqual([erster.usersNotified, zweiter.usersNotified], [1, 0]);
	});

	it('AK2: Erfolgs-Schalter aus → kein Wochenrückblick', async () => {
		const user = await seedUser('wr-off@example.com', { successPushEnabled: false });
		await seedSubscription(user.id, 'https://push.example.com/wr-off');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWeeklyRecapPush(new Date('2026-07-19T17:30:00Z'), okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});
});

describe('logics/recapPushes — Jahresrückblick (#2855 AK3)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK3: 2. Januar 9–17 Uhr Ortszeit → Push mit Ziel /#karte-jahresrueckblick, Dedup <userId>:<Vorjahr> (AK7: de/en)', async () => {
		const de = await seedUser('jr-de@example.com', { sprache: 'de' });
		await seedUser('jr-en@example.com', { sprache: 'en' });
		await seedSubscription(de.id, 'https://push.example.com/jr-de');
		await seedSubscription(de.id + 1, 'https://push.example.com/jr-en');
		const calls: { endpoint: string; body: string }[] = [];

		// 2026-01-02, 10:00Z = 11:00 Berlin (CET +1); Rückblick auf 2025 → Key <userId>:2025.
		const result = await runYearlyRecapPush(new Date('2026-01-02T10:00:00Z'), okSender(calls));

		assert.equal(result.usersNotified, 2);
		const erstes = payloadVon(calls, 0);
		assert.equal(erstes.url, '/#karte-jahresrueckblick', 'der Push öffnet die Jahreskarte');
		assert.notEqual(erstes.title.trim(), '');
		assert.notEqual((erstes.body ?? '').trim(), '');
		assert.notEqual(payloadVon(calls, 1).title, erstes.title, 'AK7: de- und en-Text unterscheiden sich');
		const log = await NotificationLog.findOne({ where: { kind: 'yearly-recap', userId: de.id } });
		assert.ok(log, 'der Versand wird als yearly-recap protokolliert');
		assert.match(log.dedupeKey, /^1:2025$/, 'Dedup-Key = <userId>:<Jahr des Rückblicks (Vorjahr)>');
	});

	it('AK3: 1. und 3. Januar senden nichts (nur der 2.)', async () => {
		const user = await seedUser('jr-tag@example.com');
		await seedSubscription(user.id, 'https://push.example.com/jr-tag');
		const send = okSender([]);

		const erster = await runYearlyRecapPush(new Date('2026-01-01T10:00:00Z'), send);
		const dritter = await runYearlyRecapPush(new Date('2026-01-03T10:00:00Z'), send);

		assert.deepEqual([erster.usersNotified, dritter.usersNotified], [0, 0]);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK3: Fenster-Grenze — 08:59 lokal kein Versand, 09:00 lokal ja', async () => {
		const user = await seedUser('jr-fenster@example.com');
		await seedSubscription(user.id, 'https://push.example.com/jr-fenster');
		const send = okSender([]);

		const vorFenster = await runYearlyRecapPush(new Date('2026-01-02T07:59:00Z'), send); // 08:59 Berlin
		const fensterAuf = await runYearlyRecapPush(new Date('2026-01-02T08:00:00Z'), send); // 09:00 Berlin

		assert.deepEqual([vorFenster.usersNotified, fensterAuf.usersNotified], [0, 1]);
	});

	it('AK3: 17:00 lokal liegt außerhalb des Fensters', async () => {
		const user = await seedUser('jr-abend@example.com');
		await seedSubscription(user.id, 'https://push.example.com/jr-abend');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runYearlyRecapPush(new Date('2026-01-02T16:00:00Z'), okSender(calls)); // 17:00 Berlin

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK3: zweiter Lauf am selben 2. Januar sendet nichts (1 je Jahr)', async () => {
		const user = await seedUser('jr-dedup@example.com');
		await seedSubscription(user.id, 'https://push.example.com/jr-dedup');
		const send = okSender([]);

		const erster = await runYearlyRecapPush(new Date('2026-01-02T08:00:00Z'), send);
		const zweiter = await runYearlyRecapPush(new Date('2026-01-02T13:00:00Z'), send);

		assert.deepEqual([erster.usersNotified, zweiter.usersNotified], [1, 0]);
	});

	it('AK3: im Folgejahr ist der Push wieder erlaubt (Key auf neues Vorjahr)', async () => {
		const user = await seedUser('jr-folgejahr@example.com');
		await seedSubscription(user.id, 'https://push.example.com/jr-folgejahr');
		const send = okSender([]);

		const erstesJahr = await runYearlyRecapPush(new Date('2026-01-02T10:00:00Z'), send);
		const zweitesJahr = await runYearlyRecapPush(new Date('2027-01-02T10:00:00Z'), send);

		assert.deepEqual([erstesJahr.usersNotified, zweitesJahr.usersNotified], [1, 1]);
		const log = await NotificationLog.findOne({
			where: { kind: 'yearly-recap', sentAt: new Date('2027-01-02T10:00:00Z') },
		});
		assert.ok(log, 'der Versand 2027 wird protokolliert');
		assert.match(log.dedupeKey, /^1:2026$/, 'Key des Folgejahres zeigt auf das neue Vorjahr');
	});

	it('AK3: Erfolgs-Schalter aus → kein Jahresrückblick', async () => {
		const user = await seedUser('jr-off@example.com', { successPushEnabled: false });
		await seedSubscription(user.id, 'https://push.example.com/jr-off');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runYearlyRecapPush(new Date('2026-01-02T10:00:00Z'), okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count(), 0);
	});
});
