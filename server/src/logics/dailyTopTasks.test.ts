import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { Task, PushSubscription, NotificationLog } from '../models/index.js';
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
 *  - Stunde: 06:00 Uhr — der Scheduler feuert den Trigger über `PUSH_REMINDERS_HOUR=6` (siehe
 *    scheduler/index.ts); das Gating selbst ist dort bereits grün abgedeckt.
 */

const NOW = new Date('2026-07-07T06:00:00Z');

type TaskOverrides = Partial<{
	title: string;
	status: 'Open' | 'In process' | 'Done';
	priority: number;
	userId: number | null;
}>;

const createTask = (overrides: TaskOverrides = {}) =>
	Task.create({
		title: overrides.title ?? 'Task',
		status: overrides.status ?? 'Open',
		priority: overrides.priority ?? 3,
		estimatedEffort: 0.5,
		userId: overrides.userId ?? null,
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
		await createTask({ title: 'Einzige', priority: 2, userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDailyTopTasksPush(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1, 'genau eine gebündelte Notification');
		const payload = JSON.parse(calls[0].body);
		assert.equal(payload.url, '/');
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
		// Zweiter Tick am selben Kalendertag (z. B. 23:00 Uhr) darf nicht erneut senden.
		const sameDay = await runDailyTopTasksPush(new Date('2026-07-07T23:00:00Z'), okSender(calls));
		// Erster Tick am Folgetag löst den täglichen Push erneut aus.
		const nextDay = await runDailyTopTasksPush(new Date('2026-07-08T06:00:00Z'), okSender(calls));

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
});
