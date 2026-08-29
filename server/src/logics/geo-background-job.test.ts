import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { Task, PushSubscription, NotificationLog, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import {
	DEFAULT_ALARM_DISTANCE_KM,
	GEO_PUSH_INTERVAL_MS,
	collectGeoPushGroups,
	runGeoPushNotifications,
} from './geo-background-job.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #1101 (Spec docs/spec/issue-1101.md) — Geo-Hintergrund-Job mit Push.
 *
 * AK1: Lauf-Intervall Default 5 Minuten; das Intervall ist zugleich das Dedup-Fenster (AK6).
 * AK2: offene Tasks mit Koordinaten im Alarmabstand (Default 1 km) zur Position.
 * AK3: eine aggregierte Payload je Nutzer, zugestellt an alle Subscriptions des Nutzers.
 * AK5: Payload im SW-Kontrakt { title, body?, url? } mit Entfernung (formatKm) und Deep-Link.
 * AK6: Dedup je Task und Intervallfenster über NotificationLog.
 *
 * AK4 (subscribe/unsubscribe) ist bereits durch server/src/express/push.test.ts abgedeckt.
 * Rot, bis das Modul existiert. KEIN Produktivcode.
 */

const NOW = new Date('2026-08-28T09:00:00Z');

/** Referenzposition Berlin (Alexanderplatz) — wie in tasks-nearby.test.ts (#1066). */
const LAT = 52.5219;
const LON = 13.4132;
/** ~0,445 km nördlich → im Alarmabstand. */
const LAT_NEAR = LAT + 0.004;
/** ~2,2 km nördlich → außerhalb des Alarmabstands. */
const LAT_FAR = LAT + 0.02;

type TaskOverrides = Partial<{
	title: string;
	status: 'Open' | 'In process' | 'Done';
	latitude: number | null;
	longitude: number | null;
	userId: number | null;
}>;

const createTask = (overrides: TaskOverrides = {}) =>
	Task.create({
		title: overrides.title ?? 'Task',
		status: overrides.status ?? 'Open',
		priority: 3,
		estimatedEffort: 0.5,
		deadline: null,
		latitude: overrides.latitude ?? null,
		longitude: overrides.longitude ?? null,
		userId: overrides.userId ?? null,
	});

const seedSubscription = (userId: number | null, endpoint: string) =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

/** User mit konfiguriertem Geo-Intervall (#1098) — für den F2-Dedup-Fenster-Test. */
const seedUser = (userId: number, intervalMinutes: number) =>
	User.create({
		id: userId,
		email: `geo-${userId}@example.com`,
		passwordHash: 'x',
		displayName: 'Test',
		intervalMinutes,
	});

/** Erfolgs-Sender: zählt die Aufrufe und liefert die versendete Payload (Vorbild: push.test.ts). */
const okSender =
	(calls: { endpoint: string; body: string }[]): PushSender =>
	(subscription, payload) => {
		calls.push({ endpoint: subscription.endpoint, body: payload });
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

const position = { userId: 1, lat: LAT, lon: LON };

describe('logics/geo-background-job — Geo-Push-Trigger (#1101)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: Lauf-Intervall ist 5 Minuten, Alarmabstand 1 km (Defaults laut Issue)', () => {
		assert.equal(GEO_PUSH_INTERVAL_MS, 5 * 60 * 1000);
		assert.equal(DEFAULT_ALARM_DISTANCE_KM, 1);
	});

	it('AK2: nimmt nur offene Tasks mit Koordinaten im Alarmabstand auf', async () => {
		await createTask({ title: 'nah', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		await createTask({ title: 'zu weit weg', latitude: LAT_FAR, longitude: LON, userId: 1 });
		await createTask({ title: 'ohne Koordinaten', userId: 1 });
		await createTask({ title: 'erledigt', status: 'Done', latitude: LAT_NEAR, longitude: LON, userId: 1 });

		const groups = await collectGeoPushGroups([position], NOW);

		assert.equal(groups.length, 1, 'genau eine Gruppe für den Nutzer mit Position');
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['nah'],
		);
	});

	it('AK2/AK3: isoliert nach Nutzer — fremde Tasks in der Nähe bleiben außen vor', async () => {
		await createTask({ title: 'mein Task', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		await createTask({ title: 'fremder Task', latitude: LAT_NEAR, longitude: LON, userId: 2 });

		const groups = await collectGeoPushGroups([position], NOW);

		assert.equal(groups.length, 1);
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['mein Task'],
		);
	});

	it('AK3: versendet genau eine Payload je Subscription des Nutzers — auch bei mehreren nahen Tasks', async () => {
		await createTask({ title: 'Bäckerei', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		await createTask({ title: 'Apotheke', latitude: LAT - 0.003, longitude: LON, userId: 1 });
		await seedSubscription(1, 'https://push.example/a');
		await seedSubscription(1, 'https://push.example/b');
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runGeoPushNotifications([position], okSender(calls), NOW);

		assert.equal(result.usersNotified, 1);
		assert.deepEqual(calls.map((call) => call.endpoint).sort(), ['https://push.example/a', 'https://push.example/b']);
		const payloads = calls.map((call) => JSON.parse(call.body) as { title: string });
		assert.equal(
			new Set(payloads.map((payload) => payload.title)).size,
			1,
			'aggregiert: beide Subscriptions erhalten dieselbe Nachricht',
		);
	});

	it('AK3: sendet nichts, wenn der Nutzer keine Subscription hat', async () => {
		await createTask({ title: 'nah', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runGeoPushNotifications([position], okSender(calls), NOW);

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
	});

	it('AK5: Payload bei einem Task enthält Titel, Entfernung im km-Format und Deep-Link zur Aufgabe', async () => {
		const task = (await createTask({
			title: 'Bäckerei',
			latitude: LAT_NEAR,
			longitude: LON,
			userId: 1,
		})) as unknown as { id: number };
		await seedSubscription(1, 'https://push.example/a');
		const calls: { endpoint: string; body: string }[] = [];

		await runGeoPushNotifications([position], okSender(calls), NOW);

		const payload = JSON.parse(calls[0].body) as { title: string; body?: string; url?: string };
		assert.equal(payload.title, 'Bäckerei');
		assert.match(payload.body ?? '', /0,4 km/, 'Entfernung de-DE mit einer Nachkommastelle (formatKm-Konvention)');
		assert.ok(
			!Object.keys(payload).some((key) => !['title', 'body', 'url'].includes(key)),
			'kein Feld außerhalb des SW-Kontrakts',
		);
		assert.match(payload.url ?? '', new RegExp(`/\\d`), 'Deep-Link statt generischer App-Wurzel');
		assert.match(payload.url ?? '', new RegExp(`${task.id}`), 'Deep-Link führt zur konkreten Aufgabe');
	});

	it('AK5: Payload bei mehreren Tasks nennt die Anzahl und listet Titel mit Entfernung (F4: Deep-Link auf nächste Aufgabe)', async () => {
		await createTask({ title: 'Bäckerei', latitude: LAT_NEAR, longitude: LON, userId: 1 }); // ~0,45 km
		const apotheke = await createTask({ title: 'Apotheke', latitude: LAT - 0.003, longitude: LON, userId: 1 }); // ~0,33 km
		await seedSubscription(1, 'https://push.example/a');
		const calls: { endpoint: string; body: string }[] = [];

		await runGeoPushNotifications([position], okSender(calls), NOW);

		const payload = JSON.parse(calls[0].body) as { title: string; body?: string; url?: string };
		assert.match(payload.title, /2/, 'Anzahl der nahen Aufgaben im Titel');
		assert.match(payload.body ?? '', /Bäckerei/);
		assert.match(payload.body ?? '', /Apotheke/);
		// F4: Deep-Link auf die nächstgelegene Aufgabe — die Apotheke (~0,33 km) liegt näher als die Bäckerei (~0,45 km).
		assert.equal(payload.url ?? '', `/tasks/${apotheke.id}`, 'Deep-Link führt zur nächsten Aufgabe');
	});

	it('AK6: Dedup — kein erneuter Versand innerhalb des Intervalls, wieder danach', async () => {
		await createTask({ title: 'nah', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		await seedSubscription(1, 'https://push.example/a');
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		await runGeoPushNotifications([position], send, NOW);
		assert.equal(calls.length, 1, 'erster Lauf sendet');

		await runGeoPushNotifications([position], send, new Date(NOW.getTime() + GEO_PUSH_INTERVAL_MS - 1000));
		assert.equal(calls.length, 1, 'zweiter Lauf im selben Intervall sendet nicht erneut');

		const logs = await NotificationLog.findAll({ where: { kind: 'geo-nearby-task' } });
		assert.equal(logs.length, 1, 'genau ein Dedup-Eintrag je Task und Fenster');

		await runGeoPushNotifications([position], send, new Date(NOW.getTime() + GEO_PUSH_INTERVAL_MS + 1000));
		assert.equal(calls.length, 2, 'nach Ablauf des Fensters wird wieder gemeldet');
	});

	// F2 (#1102-Review): Das Dedup-Fenster ist das KONFIGURIERTE Intervall (User.intervalMinutes),
	// nicht hart 5 Minuten — sonst ist der Schutz bei größerem Intervall nach 5 min weg.
	it('F2: Dedup-Fenster folgt User.intervalMinutes (60 min), nicht dem 5-min-Default', async () => {
		await seedUser(1, 60);
		await createTask({ title: 'nah', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		await seedSubscription(1, 'https://push.example/a');
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		await runGeoPushNotifications([position], send, NOW);
		assert.equal(calls.length, 1, 'erster Lauf sendet');

		// 10 min später: außerhalb des 5-min-Defaults, aber INNERHALB des 60-min-Intervalls.
		await runGeoPushNotifications([position], send, new Date(NOW.getTime() + 10 * 60 * 1000));
		assert.equal(calls.length, 1, 'innerhalb des konfigurierten 60-min-Fensters kein erneuter Versand');

		// 61 min später: Fenster abgelaufen → erneuter Versand.
		await runGeoPushNotifications([position], send, new Date(NOW.getTime() + 61 * 60 * 1000));
		assert.equal(calls.length, 2, 'nach Ablauf des konfigurierten Fensters wird wieder gemeldet');
	});

	it('AK6: ohne Tasks im Alarmabstand bleibt der Lauf ein No-op', async () => {
		await createTask({ title: 'zu weit weg', latitude: LAT_FAR, longitude: LON, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runGeoPushNotifications([position], okSender(calls), NOW);

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
		const logs = await NotificationLog.findAll({ where: { kind: 'geo-nearby-task' } });
		assert.equal(logs.length, 0);
	});

	it('F3: parallele Läufe für denselben User werden serialisiert (kein Doppelpush)', async () => {
		await createTask({ title: 'nah', latitude: LAT_NEAR, longitude: LON, userId: 1 });
		await seedSubscription(1, 'https://push.example/a');
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		// Parallele Aufrufe: Promise.all triggert beide gleichzeitig.
		await Promise.all([runGeoPushNotifications([position], send, NOW), runGeoPushNotifications([position], send, NOW)]);

		// Ohne Serialisierung wären es 2 Aufrufe; mit Queue nur 1.
		assert.equal(calls.length, 1, 'parallele Läufe senden nicht doppelt');
	});
});
