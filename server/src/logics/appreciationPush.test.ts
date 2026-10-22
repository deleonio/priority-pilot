import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, Pillar, PushSubscription, ScoreEntry, Task, TaskPillar, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runAppreciationPush, runWelcomeBackPush } from './appreciationPush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #2855 — Lob-Push (AK1) und Willkommen-zurück-Push (AK6);
 * Vertrag: `docs/spec/issue-2855.md`. `appreciationPush.ts` existiert noch nicht — der fehlende
 * Modul-Import ist der legitime erste Rot-Zustand; die Impl-Phase liefert das Modul.
 */

// Europa/Berlin, Juli = CEST (UTC+2): 12:00Z → 14:00 lokal. 2026-07-07 ist Dienstag, ISO-Woche 2026-W28.
const NOW = new Date('2026-07-07T12:00:00Z');
const GESTERN = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

type PushUserAttrs = { carePushEnabled?: boolean; sprache?: string | null };

const seedUser = (email: string, extra: PushUserAttrs = {}) =>
	User.create({
		email,
		displayName: 'Push Empfänger',
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

/** Erledigte Aufgabe (share 100 %) mit ScoreEntry-Zeitpunkt — Muster carePush.test.ts. */
const seedDoneEffort = async (userId: number, pillarId: number, effort: number, erledigtAm: Date, title: string) => {
	const task = await Task.create({ title, status: 'Done', priority: 3, estimatedEffort: effort, userId });
	await TaskPillar.create({ taskId: task.id, pillarId, share: 100, confidence: 1 });
	await ScoreEntry.create({ taskId: task.id, punkte: Math.round(effort * 10), pünktlich: true, zeitpunkt: erledigtAm });
};

/** „Weder Defizit noch Überlast“: eine Säule mit genau einer Erledigung gestern (unter der Mindestmenge). */
const seedAusgewogenerNutzer = async (email: string, extra: PushUserAttrs = {}) => {
	const user = await seedUser(email, extra);
	const saeule = await Pillar.create({ name: 'Körper', userId: user.id });
	await seedSubscription(user.id, `https://push.example.com/${email}`);
	await seedDoneEffort(user.id, saeule.id, 0.5, GESTERN, 'Ausgleich');
	return user;
};

describe('logics/appreciationPush — Lob (#2855 AK1)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: ohne Defizit/Überlass → Lob je Konto, Ziel /#karte-balance, Dedup <userId>:<ISO-Woche> (AK7: de/en)', async () => {
		const de = await seedAusgewogenerNutzer('lob-de@example.com', { sprache: 'de' });
		await seedAusgewogenerNutzer('lob-en@example.com', { sprache: 'en' });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runAppreciationPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 2, 'beide ausgewogenen Nutzer erhalten das Lob');
		assert.equal(calls.length, 2);
		const erstes = payloadVon(calls, 0);
		assert.equal(erstes.url, '/#karte-balance', 'der Push öffnet die Balance-Karte');
		assert.notEqual(erstes.title.trim(), '', 'Titel aus dem Katalog, kein Leerstring');
		assert.notEqual((erstes.body ?? '').trim(), '', 'Text aus dem Katalog, kein Leerstring');
		assert.notEqual(payloadVon(calls, 1).title, erstes.title, 'AK7: de- und en-Text unterscheiden sich');
		const log = await NotificationLog.findOne({ where: { kind: 'appreciation', userId: de.id } });
		assert.ok(log, 'der Versand wird als appreciation protokolliert');
		assert.match(log.dedupeKey, /^1:2026-W28$/, 'Dedup-Key = <userId>:<ISO-Woche>');
	});

	it('AK1: zweiter Lauf in derselben ISO-Woche sendet nichts, Folgewoche wieder', async () => {
		await seedAusgewogenerNutzer('lob-dedup@example.com');
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const dienstag = await runAppreciationPush(new Date('2026-07-07T12:00:00Z'), send); // Di, W28
		const sonntag = await runAppreciationPush(new Date('2026-07-12T12:00:00Z'), send); // So, noch W28
		const montag = await runAppreciationPush(new Date('2026-07-13T12:00:00Z'), send); // Mo, W29

		assert.deepEqual([dienstag.usersNotified, sonntag.usersNotified, montag.usersNotified], [1, 0, 1]);
		assert.equal(calls.length, 2);
	});

	it('AK1: defizitäre Säule (keine Erledigung im Fenster) → kein Lob, kein Log', async () => {
		const user = await seedUser('lob-defizit@example.com');
		await Pillar.create({ name: 'Körper', userId: user.id });
		await seedSubscription(user.id, 'https://push.example.com/lob-defizit');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runAppreciationPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'Defizit ist Fürsorge-Anlass, kein Lob-Anlass');
		assert.equal(await NotificationLog.count(), 0, 'kein Log-Eintrag');
	});

	it('AK1: Überlast (3 Erledigungen, >50 % auf einer Säule) → kein Lob', async () => {
		const user = await seedUser('lob-ueberlast@example.com');
		const koerper = await Pillar.create({ name: 'Körper', userId: user.id });
		const soziales = await Pillar.create({ name: 'Soziales', userId: user.id });
		await seedSubscription(user.id, 'https://push.example.com/lob-ueberlast');
		await seedDoneEffort(user.id, koerper.id, 0.75, GESTERN, 'Überlast-Körper');
		await seedDoneEffort(user.id, koerper.id, 0.25, GESTERN, 'Überlast-Körper 2');
		await seedDoneEffort(user.id, soziales.id, 0.25, GESTERN, 'Überlast-Soziales');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runAppreciationPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'Überlast ist Fürsorge-Anlass, kein Lob-Anlass');
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK1: an einem lokalen Tag mit care-push-Log kein Lob', async () => {
		const user = await seedAusgewogenerNutzer('lob-care-tag@example.com');
		await NotificationLog.create({
			userId: user.id,
			kind: 'care-push',
			dedupeKey: `${user.id}:2026-07-07`,
			sentAt: NOW,
		});
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runAppreciationPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'am Fürsorge-Tag bleibt das Lob aus');
		assert.equal(await NotificationLog.count({ where: { kind: 'appreciation' } }), 0);
	});

	it('AK1: Fürsorge-Schalter aus → kein Lob', async () => {
		await seedAusgewogenerNutzer('lob-off@example.com', { carePushEnabled: false });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runAppreciationPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0);
	});
});

describe('logics/appreciationPush — Willkommen zurück (#2855 AK6)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	/** Nutzer mit alter, offener Aufgabe (vor 10 Tagen angelegt, nie erledigt) — „7 Tage ohne Aktivität“. */
	const seedZurueckkehrer = async (email: string, extra: PushUserAttrs = {}) => {
		const user = await seedUser(email, extra);
		await seedSubscription(user.id, `https://push.example.com/${email}`);
		const task = await Task.create({
			title: 'Alte Aufgabe',
			status: 'Open',
			priority: 3,
			estimatedEffort: 0.5,
			userId: user.id,
		});
		await Task.update({ createdAt: new Date('2026-06-27T12:00:00Z') }, { where: { id: task.id } });
		return user;
	};

	it('AK6: 7 Tage ohne angelegte/erledigte Aufgabe → Willkommen-zurück mit Ziel /#karte-balance (AK7: de/en)', async () => {
		const de = await seedZurueckkehrer('wb-de@example.com', { sprache: 'de' });
		await seedZurueckkehrer('wb-en@example.com', { sprache: 'en' });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeBackPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 2);
		const erstes = payloadVon(calls, 0);
		assert.equal(erstes.url, '/#karte-balance', 'der Push öffnet die Balance-Karte');
		assert.notEqual(erstes.title.trim(), '');
		assert.notEqual((erstes.body ?? '').trim(), '');
		assert.notEqual(payloadVon(calls, 1).title, erstes.title, 'AK7: de- und en-Text unterscheiden sich');
		const log = await NotificationLog.findOne({ where: { kind: 'welcome-back', userId: de.id } });
		assert.ok(log, 'der Versand wird als welcome-back protokolliert');
		assert.match(log.dedupeKey, /^1:welcome-back:2026-07-07$/, 'Dedup <userId>:welcome-back:<lokalesDatum>');
	});

	it('AK6: Aufgabe vor 3 Tagen angelegt → kein Push', async () => {
		const user = await seedUser('wb-neu@example.com');
		await seedSubscription(user.id, 'https://push.example.com/wb-neu');
		await Task.create({ title: 'Frisch', status: 'Open', priority: 3, estimatedEffort: 0.5, userId: user.id });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeBackPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'angefasst vor 7 Tagen = kein Willkommen-zurück');
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK6: Erledigung vor 3 Tagen → kein Push (auch wenn die Aufgabe älter ist)', async () => {
		const user = await seedZurueckkehrer('wb-erledigt@example.com');
		const task = (await Task.findOne({ where: { userId: user.id } }))!;
		await ScoreEntry.create({
			taskId: task.id,
			punkte: 5,
			pünktlich: true,
			zeitpunkt: new Date('2026-07-04T12:00:00Z'),
		});
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeBackPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'Erledigung zählt wie Anlegen');
		assert.equal(await NotificationLog.count(), 0);
	});

	it('AK6: höchstens 1 je 30 Tage — NotificationLog-Rückblick auf sentAt', async () => {
		const kuerzlich = await seedZurueckkehrer('wb-kuerzlich@example.com');
		const lange = await seedZurueckkehrer('wb-lange@example.com');
		await NotificationLog.create({
			userId: kuerzlich.id,
			kind: 'welcome-back',
			dedupeKey: '1:welcome-back:2026-06-27',
			sentAt: new Date('2026-06-27T12:00:00Z'),
		});
		await NotificationLog.create({
			userId: lange.id,
			kind: 'welcome-back',
			dedupeKey: '2:welcome-back:2026-05-28',
			sentAt: new Date('2026-05-28T12:00:00Z'),
		});
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeBackPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1, 'Log vor 10 Tagen blockt, Log vor 40 Tagen nicht');
		const log = await NotificationLog.findOne({ where: { kind: 'welcome-back', userId: lange.id } });
		assert.ok(log);
		assert.notEqual(log.dedupeKey, '2:welcome-back:2026-05-28', 'für den alten Stand wurde neu gesendet');
	});

	it('AK6: Fürsorge-Schalter aus → kein Push', async () => {
		await seedZurueckkehrer('wb-off@example.com', { carePushEnabled: false });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runWelcomeBackPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0);
	});
});
