import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, ScoreEntry, Task, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { CARE_SPRACHEN } from './careSuggestionData.js';
import { runStreakReminder, streakReminderText } from './streakReminder.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #1836 (Spec: docs/spec/issue-1836.md) — Streak-Erinnerung am Abend.
 * AK1–AK7: `runStreakReminder`, AK8: Textkatalog `streakReminderText`. AK9 (Scheduler-Verdrahtung)
 * bewusst ungetestet (ADR 0001). `streakReminder.ts` existiert noch nicht — der fehlende
 * Modul-Import ist der legitime erste Rot-Zustand.
 */

// 19:00 UTC am 2026-07-07: Zone UTC → Fenster 18–21 offen.
const NOW = new Date('2026-07-07T19:00:00Z');
const at = (iso: string, hhmm = '12:00') => new Date(`${iso}T${hhmm}:00Z`);

type UserAttrs = { carePushEnabled?: boolean; zeitzone?: string | null };

/** Nutzer mit Push-Subscription und je einer Erledigung an den angegebenen Tagen (12:00 UTC). */
const seedUser = async (email: string, tage: string[], extra: UserAttrs = {}, subscribed = true) => {
	const user = await User.create({
		email,
		displayName: 'Streak Empfänger',
		passwordHash: '__test__',
		...extra,
	} as never);
	if (subscribed) {
		await PushSubscription.create({
			endpoint: `https://push.example.com/${user.id}`,
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: user.id,
		});
	}
	for (const tag of tage) {
		const task = await Task.create({
			title: `Done ${tag}`,
			status: 'Done',
			priority: 3,
			estimatedEffort: 0.5,
			userId: user.id,
		});
		await ScoreEntry.create({ taskId: task.id, punkte: 5, pünktlich: true, zeitpunkt: at(tag) });
	}
	return user;
};

const okSender =
	(calls: string[]): PushSender =>
	(_subscription, payload) => {
		calls.push(payload);
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

/** Streak 3, letzter aktiver Tag gestern (06.07.), heute noch nichts. */
const DREI_TAGE = ['2026-07-04', '2026-07-05', '2026-07-06'];

describe('logics/streakReminder — Streak-Erinnerung (Issue #1836)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: gefährdete Streak 3 um 19:00 → genau ein Push mit "3", url /aufgaben und Log streak-reminder', async () => {
		const user = await seedUser('streak-1@example.com', DREI_TAGE);
		const calls: string[] = [];

		const result = await runStreakReminder(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1);
		const payload = JSON.parse(calls[0]) as { title: string; body: string; url: string };
		assert.equal(payload.url, '/aufgaben');
		assert.match(payload.body, /3/, 'Streak-Länge steht im Text');
		const log = await NotificationLog.findOne({ where: { kind: 'streak-reminder' } });
		assert.ok(log);
		assert.equal(log.dedupeKey, `${user.id}:2026-07-07`);
	});

	it('AK1: das Log eines care-push am selben Tag blockiert die Streak-Erinnerung nicht', async () => {
		const user = await seedUser('streak-1b@example.com', DREI_TAGE);
		await NotificationLog.create({
			userId: user.id,
			kind: 'care-push',
			dedupeKey: `${user.id}:2026-07-07`,
			sentAt: NOW,
		});
		const calls: string[] = [];

		const result = await runStreakReminder(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
	});

	it('AK2: heute (lokales Datum) bereits erledigt → kein Push', async () => {
		await seedUser('streak-2@example.com', [...DREI_TAGE, '2026-07-07']);
		const calls: string[] = [];

		const result = await runStreakReminder(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
	});

	it('AK3: keine Streak (letzte Erledigung vor gestern, und nie erledigt) → kein Push', async () => {
		await seedUser('streak-3a@example.com', ['2026-07-01', '2026-07-02']);
		await seedUser('streak-3b@example.com', []);
		const calls: string[] = [];

		const result = await runStreakReminder(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
	});

	it('AK4: carePushEnabled === false → kein Push', async () => {
		await seedUser('streak-4@example.com', DREI_TAGE, { carePushEnabled: false });
		const calls: string[] = [];

		const result = await runStreakReminder(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
	});

	it('AK5: keine Subscription → kein NotificationLog, usersNotified 0', async () => {
		await seedUser('streak-5@example.com', DREI_TAGE, {}, false);

		const result = await runStreakReminder(NOW, okSender([]));

		assert.equal(result.usersNotified, 0);
		assert.equal(await NotificationLog.count({ where: { kind: 'streak-reminder' } }), 0);
	});

	it('AK6: Fenster 18:00–20:59 UTC — 17:59 und 21:00 kein Push, 18:00 und 20:59 Push', async () => {
		await seedUser('streak-6@example.com', DREI_TAGE);
		const calls: string[] = [];
		const send = okSender(calls);

		assert.equal((await runStreakReminder(at('2026-07-07', '17:59'), send)).usersNotified, 0);
		assert.equal((await runStreakReminder(at('2026-07-07', '21:00'), send)).usersNotified, 0);
		assert.equal(calls.length, 0);
		assert.equal((await runStreakReminder(at('2026-07-07', '20:59'), send)).usersNotified, 1);
		await NotificationLog.destroy({ where: {} });
		assert.equal((await runStreakReminder(at('2026-07-07', '18:00'), send)).usersNotified, 1);
	});

	it('AK6: Nutzer-Zeitzone zählt — 17:30Z ist in Berlin 19:30 (Push), in New York 13:30 (kein Push)', async () => {
		await seedUser('streak-6-berlin@example.com', DREI_TAGE, { zeitzone: 'Europe/Berlin' });
		await seedUser('streak-6-ny@example.com', DREI_TAGE, { zeitzone: 'America/New_York' });
		const calls: string[] = [];

		const result = await runStreakReminder(at('2026-07-07', '17:30'), okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1);
		const log = await NotificationLog.findOne({ where: { kind: 'streak-reminder' } });
		assert.match(log!.dedupeKey, /^1:/, 'nur der Berliner Nutzer (Id 1) wurde benachrichtigt');
	});

	it('AK6: ungültige oder fehlende Zeitzone fällt auf UTC zurück (19:00Z → Push, 17:30Z → keiner)', async () => {
		await seedUser('streak-6-invalid@example.com', DREI_TAGE, { zeitzone: 'Nicht/Gueltig' });
		await seedUser('streak-6-null@example.com', DREI_TAGE, { zeitzone: null });

		assert.equal((await runStreakReminder(at('2026-07-07', '17:30'), okSender([]))).usersNotified, 0);
		assert.equal((await runStreakReminder(NOW, okSender([]))).usersNotified, 2);
	});

	it('AK7: zweiter Lauf am selben lokalen Tag sendet nichts mehr', async () => {
		await seedUser('streak-7@example.com', DREI_TAGE);
		const calls: string[] = [];
		const send = okSender(calls);

		const first = await runStreakReminder(NOW, send);
		const second = await runStreakReminder(at('2026-07-07', '19:15'), send);

		assert.equal(first.usersNotified, 1);
		assert.equal(second.usersNotified, 0);
		assert.equal(calls.length, 1);
	});

	it('AK8: Textkatalog in allen zehn Sprachen nicht leer, Streak-Länge eingesetzt', () => {
		assert.equal(CARE_SPRACHEN.length, 10);
		for (const sprache of CARE_SPRACHEN) {
			const { titel, text } = streakReminderText(sprache, 47);
			assert.notEqual(titel.trim(), '', `${sprache}: Titel leer`);
			assert.notEqual(text.trim(), '', `${sprache}: Text leer`);
			assert.match(`${titel} ${text}`, /47/, `${sprache}: Streak-Länge fehlt`);
			assert.doesNotMatch(`${titel} ${text}`, /[{}]|\bundefined\b/, `${sprache}: Platzhalter nicht ersetzt`);
		}
	});
});
