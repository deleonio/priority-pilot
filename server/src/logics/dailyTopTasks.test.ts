import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { Task, PushSubscription, NotificationLog, Series, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { collectDailyTopTasks, runDailyTopTasksPush } from './dailyTopTasks.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für Issue #518 — „Tägliche Push-Benachrichtigung mit den 3 wichtigsten Aufgaben um 6 Uhr".
 *
 * Fachlicher Unterschied zu Issue #355 (`dueTaskReminders`): #355 löst auf nahe Deadlines aus
 * (`deadline <= now + 24h`); #518 sendet **tagesunabhängig von Deadlines** einmal täglich um 06:00 Uhr
 * die **3 nach Priorität höchsten** aktiven Aufgaben. Beide Trigger koexistieren (eigener `kind` /
 * eigener `dedupeKey`), sie deduzieren nicht gegeneinander.
 *
 * Annahmen (offene Punkte aus dem Issue-Body, hier als falsifizierbarer Vertrag festgeschrieben):
 *  - Ranking-Feld ist `Task.priority`, **aufsteigend = wichtiger** (P1 am höchsten; entspricht dem
 *    Demo-Seed `Task 1 = priority 1`, der von anderen Tasks abhängt). Siehe „Offene Punkte" im PR-Body.
 *  - Leer-Fall (0 Aufgaben): **kein Push**, kein NotificationLog (analog No-op in `dueTaskReminders`).
 *  - Fenster (#2849): lokale Stunde 7–8 des Empfängers; das Gating liegt im Trigger selbst
 *    (`runDailyTopTasksPush`), der Scheduler tickt stündlich (`PUSH_REMINDERS_HOUR` entfällt).
 */

// im UTC-Morgenfenster (lokale Stunde 7–8, #2849)
const NOW = new Date('2026-07-07T07:30:00Z');

type TaskOverrides = Partial<{
	title: string;
	status: 'Open' | 'In process' | 'Done';
	priority: number;
	userId: number | null;
	deadline: Date | null;
}>;

const createTask = (overrides: TaskOverrides = {}) =>
	Task.create({
		title: overrides.title ?? 'Task',
		status: overrides.status ?? 'Open',
		priority: overrides.priority ?? 3,
		estimatedEffort: 0.5,
		userId: overrides.userId ?? null,
		deadline: overrides.deadline ?? null,
	});

const seedSubscription = (userId: number | null, endpoint: string) =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

/** Erfolgs-Sender: zählt die Aufrufe und liefert die versendete Payload (Vorbild: push.test.ts). */
const okSender =
	(calls: { endpoint: string; body: string }[]): PushSender =>
	(subscription, payload) => {
		calls.push({ endpoint: subscription.endpoint, body: payload });
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

describe('logics/dailyTopTasks — „3 wichtigste Aufgaben um 6 Uhr" (Issue #518)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AC2/T1/T4: liefert exakt die Top-3 nach Priorität (aufsteigend) und schließt erledigte Tasks aus', async () => {
		await createTask({ title: 'P1-erledigt', status: 'Done', priority: 1, userId: 1 });
		await createTask({ title: 'P2', priority: 2, userId: 1 });
		await createTask({ title: 'P3', priority: 3, userId: 1 });
		await createTask({ title: 'P4', priority: 4, userId: 1 });
		await createTask({ title: 'P5', priority: 5, userId: 1 });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 1, 'ein Nutzer → eine Gruppe');
		const titles = groups[0].tasks.map((task) => task.title);
		assert.deepEqual(titles, ['P2', 'P3', 'P4'], 'Top-3 nach Priorität (P1 erledigt fehlt, P5 zu niedrig)');
	});

	it('AC2: isoliert nach userId und begrenzt je Nutzer auf 3 Aufgaben', async () => {
		await createTask({ title: 'U1-a', priority: 1, userId: 1 });
		await createTask({ title: 'U1-b', priority: 2, userId: 1 });
		await createTask({ title: 'U1-c', priority: 3, userId: 1 });
		await createTask({ title: 'U1-d', priority: 4, userId: 1 });
		await createTask({ title: 'U2-a', priority: 1, userId: 2 });

		const groups = await collectDailyTopTasks(NOW);
		const byUser = new Map(groups.map((group) => [group.userId, group.tasks.map((task) => task.title)]));

		assert.deepEqual(byUser.get(1), ['U1-a', 'U1-b', 'U1-c'], 'Nutzer 1: genau Top-3, vierte fällt weg');
		assert.deepEqual(byUser.get(2), ['U2-a'], 'Nutzer 2: nur die eigene Aufgabe');
	});

	it('AC3/T2: bei 1–2 Aufgaben enthält der Push genau diese (kein Auffüllen auf 3)', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		const task = await createTask({ title: 'Einzige', priority: 2, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDailyTopTasksPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1, 'genau eine gebündelte Notification');
		const payload = JSON.parse(calls[0].body);
		assert.equal(payload.url, `/tasks/${task.id}`, '#2851 AK1: Einzelaufgabe wird direkt verlinkt');
		assert.match(payload.body, /Einzige/, 'die vorhandene Aufgabe taucht im Push auf');
	});

	it('AC3/T3: ohne aktive Aufgaben greift der Leer-Fall — kein Push, kein NotificationLog', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'erledigt', status: 'Done', priority: 1, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDailyTopTasksPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'keine Aufgaben → niemand wird benachrichtigt');
		assert.equal(calls.length, 0, 'definierter Leer-Fall: kein Versand');
		assert.equal(await NotificationLog.count(), 0, 'ohne Versand wird nichts geloggt');
	});

	it('AC2: die Top-3-Titel sind Bestandteil der gesendeten Payload', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Alpha', priority: 1, userId: 1 });
		await createTask({ title: 'Beta', priority: 2, userId: 1 });
		await createTask({ title: 'Gamma', priority: 3, userId: 1 });
		await createTask({ title: 'Delta', priority: 4, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		await runDailyTopTasksPush(NOW, okSender(calls));

		assert.equal(calls.length, 1);
		const payload = JSON.parse(calls[0].body);
		assert.match(payload.body, /Alpha/);
		assert.match(payload.body, /Beta/);
		assert.match(payload.body, /Gamma/);
		assert.doesNotMatch(payload.body, /Delta/, 'vierte (niedrigere) Priorität ist nicht im Push');
		assert.equal(payload.url, '/#karte-top-aufgaben', '#2851 AK1: gebündelter Push springt zur Top-Aufgaben-Karte');
	});

	it('AC4: sendet nur an Nutzer mit Subscription; ohne Subscription kein Versand und kein Log', async () => {
		// userId 1 hat Subscription, userId 2 hat keine
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Mit-Sub', priority: 1, userId: 1 });
		await createTask({ title: 'Ohne-Sub', priority: 1, userId: 2 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDailyTopTasksPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1, 'nur der Nutzer mit Subscription zählt als benachrichtigt');
		assert.equal(calls.length, 1, 'genau ein Versand an die bestehende Subscription');
		assert.equal(await NotificationLog.count(), 1, 'nur für den tatsächlich zugestellten Nutzer wird geloggt');
	});

	it('AC1/T5: ist idempotent pro Kalendertag — mehrfache Ticks senden einmal; am Folgetag erneut', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Top', priority: 1, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const first = await runDailyTopTasksPush(NOW, okSender(calls));
		// Zweiter Tick am selben lokalen Tag (z. B. 08:15 Uhr, noch im Fenster) sendet nicht erneut.
		const sameDay = await runDailyTopTasksPush(new Date('2026-07-07T08:15:00Z'), okSender(calls));
		// Erster Tick am Folgetag löst den täglichen Push erneut aus.
		const nextDay = await runDailyTopTasksPush(new Date('2026-07-08T07:30:00Z'), okSender(calls));

		assert.equal(first.usersNotified, 1);
		assert.equal(sameDay.usersNotified, 0, 'zweiter Tick am selben Tag ist ein No-op (Idempotenz/Tag)');
		assert.equal(nextDay.usersNotified, 1, 'am Folgetag wird der tägliche Push erneut versendet');
		assert.equal(calls.length, 2, 'ein Versand am 07.07., ein Versand am 08.07.');
		assert.equal(await NotificationLog.count(), 2, 'pro Kalendertag ein Log-Eintrag');
	});

	it('AC1/T6: ignoriert Tasks ohne userId — kein Broadcast an alle Subscriptions', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'ohne Nutzer', priority: 1, userId: null });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDailyTopTasksPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'Tasks ohne Eigentümer lösen keinen Daily-Push aus');
		assert.equal(calls.length, 0);
	});
	// #1518 (Spec docs/spec/issue-1518.md, Journey 2): der 06:00-Push nennt drei verschiedene Aufgaben,
	// keine Serie doppelt — auch wenn die Serie fünf Instanzen höchster Priorität hat.
	it('#1518: eine Serie mit fünf Instanzen belegt nur einen der drei Plätze', async () => {
		const series = await Series.create({
			title: 'Sport',
			rhythm: 'daily',
			priority: 1,
			estimatedEffort: 0.5,
			active: true,
			startDate: NOW,
		});
		for (let offset = 0; offset < 5; offset += 1) {
			const occurrence = new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);
			await Task.create({
				title: 'Sport',
				status: 'Open',
				priority: 1,
				estimatedEffort: 0.5,
				deadline: occurrence,
				seriesId: series.id,
				seriesOccurrence: occurrence,
				originSeriesId: series.id,
				userId: 1,
			});
		}
		await createTask({ title: 'Steuer', priority: 2, userId: 1 });
		await createTask({ title: 'Garten', priority: 3, userId: 1 });

		const groups = await collectDailyTopTasks(NOW);
		assert.equal(groups.length, 1);
		const ids = groups[0].tasks.map((task) => task.id);
		assert.equal(new Set(ids).size, 3, 'drei verschiedene Aufgaben, keine doppelt');
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['Sport', 'Steuer', 'Garten'],
		);
	});
});

// Rote Spec-Tests für Issue #1641 (Spec docs/spec/issue-1641.md, Journey 1): Aufgaben mit einem
// Datum mehr als 3 Kalendertage in der Zukunft werden vor der Top-3-Auswahl zurückgehalten.
// KEIN Produktivcode.
describe('logics/dailyTopTasks — Vorlauf 3 Tage (Issue #1641)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	const tag = (offset: number): Date => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

	it('AK1: Aufgabe mit Datum in 5 Tagen fehlt in der Gruppe', async () => {
		await createTask({ title: 'Zu weit weg', priority: 1, userId: 1, deadline: tag(5) });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 0, 'ohne berechtigte Aufgabe entsteht keine Gruppe');
	});

	it('AK2: Aufgabe mit Datum in genau 3 Tagen ist enthalten (Grenze inklusiv)', async () => {
		await createTask({ title: 'Grenzfall', priority: 1, userId: 1, deadline: tag(3) });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 1);
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['Grenzfall'],
		);
	});

	it('AK3: Aufgabe ohne Datum und überfällige Aufgabe erscheinen wie bisher', async () => {
		await createTask({ title: 'Ohne Datum', priority: 1, userId: 1, deadline: null });
		await createTask({ title: 'Überfällig', priority: 2, userId: 1, deadline: tag(-2) });
		await createTask({ title: 'Zu weit weg', priority: 3, userId: 1, deadline: tag(5) });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 1);
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['Ohne Datum', 'Überfällig'],
		);
	});

	it('AK4: zurückgehaltene Aufgabe wird durch die nächstberechtigte ersetzt (Nachrücken)', async () => {
		await createTask({ title: 'P1', priority: 1, userId: 1, deadline: null });
		await createTask({ title: 'P2-zurückgehalten', priority: 2, userId: 1, deadline: tag(5) });
		await createTask({ title: 'P3', priority: 3, userId: 1, deadline: null });
		await createTask({ title: 'P4', priority: 4, userId: 1, deadline: null });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 1);
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['P1', 'P3', 'P4'],
			'P2 fällt weg, P4 rückt als drittes nach',
		);
	});

	it('AK5: Serie mit aktueller Instanz in 5 Tagen erscheint gar nicht', async () => {
		const series = await Series.create({
			title: 'Weit weg',
			rhythm: 'daily',
			priority: 1,
			estimatedEffort: 0.5,
			active: true,
			startDate: tag(5),
		});
		await Task.create({
			title: 'Weit weg',
			status: 'Open',
			priority: 1,
			estimatedEffort: 0.5,
			deadline: tag(5),
			seriesId: series.id,
			seriesOccurrence: tag(5),
			originSeriesId: series.id,
			userId: 1,
		});
		await createTask({ title: 'Sonst nichts los', priority: 5, userId: 1, deadline: null });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 1);
		assert.deepEqual(
			groups[0].tasks.map((task) => task.title),
			['Sonst nichts los'],
			'die Serie ist nicht enthalten, nur die unabhängige Aufgabe',
		);
	});
});

// Rote Spec-Tests für #2849 (Spec docs/spec/issue-2849.md): Fenster lokale Stunde 7–8 je
// Empfänger-Zeitzone, ohne gültige Zone UTC. KEIN Produktivcode.
describe('logics/dailyTopTasks — Fenster & Zeitzone (#2849)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK2: sendet nur bei lokaler Stunde 7–8 — 05:59 Berlin keiner, 07:00 ja, 08:59 ja, 09:00 keiner', async () => {
		// Test-Pflege #2849: die Zeilen 1–3 werden referenziert, aber nie angelegt — nachgetragen
		// (die Assertions erwarten Berlin-Fenster; ohne Zeile fiele der Lookup auf UTC zurück).
		for (const [id, email] of [
			[1, 'top-berlin-1'],
			[2, 'top-berlin-2'],
			[3, 'top-berlin-3'],
		] as const) {
			await User.create({
				email: `${email}@example.com`,
				displayName: `Berlin ${id}`,
				passwordHash: '__test__',
				zeitzone: 'Europe/Berlin',
			} as never);
		}
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);
		await seedSubscription(1, 'https://push.example.com/w1');
		await createTask({ title: 'Eins', priority: 1, userId: 1 });

		const frueh = await runDailyTopTasksPush(new Date('2026-07-07T03:59:00Z'), send); // 05:59 Berlin
		assert.equal(frueh.usersNotified, 0, '05:59 lokal liegt vor dem Fenster');
		const morgens = await runDailyTopTasksPush(new Date('2026-07-07T05:00:00Z'), send); // 07:00 Berlin
		assert.equal(morgens.usersNotified, 1, '07:00 lokal öffnet das Fenster');

		await seedSubscription(2, 'https://push.example.com/w2');
		await createTask({ title: 'Zwei', priority: 1, userId: 2 });
		const rand = await runDailyTopTasksPush(new Date('2026-07-07T06:59:00Z'), send); // 08:59 Berlin
		assert.equal(rand.usersNotified, 1, '08:59 lokal gehört noch zum Fenster');
		await seedSubscription(3, 'https://push.example.com/w3');
		await createTask({ title: 'Drei', priority: 1, userId: 3 });
		const zu = await runDailyTopTasksPush(new Date('2026-07-07T07:00:00Z'), send); // 09:00 Berlin
		assert.equal(zu.usersNotified, 0, '09:00 lokal liegt außerhalb des Fensters');
		assert.equal(calls.length, 2);
	});

	it('AK3: Fenster folgen der Empfängerzeitzone — New-York-Nutzer sendet zu 11:30Z (07:30 lokal), nicht zu 05:30Z', async () => {
		// Test-Pflege #2849: der Empfänger wurde referenziert, aber nie angelegt — nachgetragen;
		// die Id dynamisch vom erzeugten Datensatz (sync force startet die Autoinkrement-Ids bei 1).
		const ny = await User.create({
			email: 'top-ny@example.com',
			displayName: 'New York',
			passwordHash: '__test__',
			zeitzone: 'America/New_York',
		} as never);
		await seedSubscription(ny.id, 'https://push.example.com/w4');
		await createTask({ title: 'NY', priority: 1, userId: ny.id });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const nachts = await runDailyTopTasksPush(new Date('2026-07-07T05:30:00Z'), send); // 01:30 New York
		assert.equal(nachts.usersNotified, 0, '01:30 New York liegt außerhalb — die UTC-Stunde 5:30 zählt nicht');
		const morgens = await runDailyTopTasksPush(new Date('2026-07-07T11:30:00Z'), send); // 07:30 New York
		assert.equal(morgens.usersNotified, 1, '07:30 New York liegt im Fenster');
		assert.equal(calls.length, 1);
	});

	it('AK5: ohne Zeitzone gelten die Fenster in UTC — 05:30Z keiner, 07:30Z beide', async () => {
		await seedSubscription(5, 'https://push.example.com/w5');
		await createTask({ title: 'UTC', priority: 1, userId: 5 });
		await seedSubscription(6, 'https://push.example.com/w6');
		await createTask({ title: 'Mars', priority: 1, userId: 6 });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const frueh = await runDailyTopTasksPush(new Date('2026-07-07T05:30:00Z'), send);
		assert.equal(frueh.usersNotified, 0, 'UTC 05:30 liegt vor dem Fenster');
		const morgens = await runDailyTopTasksPush(new Date('2026-07-07T07:30:00Z'), send);
		assert.equal(morgens.usersNotified, 2, 'UTC 07:30 liegt im Fenster — beide Zone-losen Nutzer');
		assert.equal(calls.length, 2);
	});
});
