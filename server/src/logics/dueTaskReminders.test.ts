import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { Task, PushSubscription, NotificationLog } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { collectDueTaskReminders, runDueTaskReminders } from './dueTaskReminders.js';
import type { PushSender } from './push.js';

const NOW = new Date('2026-07-07T08:00:00Z');

type TaskOverrides = Partial<{
	title: string;
	status: 'Open' | 'In process' | 'Done';
	deadline: Date | null;
	userId: number | null;
}>;

const createTask = (overrides: TaskOverrides = {}) =>
	Task.create({
		title: overrides.title ?? 'Task',
		status: overrides.status ?? 'Open',
		priority: 3,
		estimatedEffort: 0.5,
		deadline: overrides.deadline ?? null,
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

describe('logics/dueTaskReminders — fachlicher Push-Trigger „fällige Aufgaben" (Issue #355)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('erfasst fällige/überfällige offene Tasks, ignoriert ferne Deadlines und erledigte Tasks', async () => {
		await createTask({ title: 'bald fällig', deadline: new Date(NOW.getTime() + 2 * 60 * 60 * 1000), userId: 1 });
		await createTask({ title: 'überfällig', deadline: new Date(NOW.getTime() - 60 * 60 * 1000), userId: 1 });
		await createTask({
			title: 'noch weit weg',
			deadline: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000),
			userId: 1,
		});
		await createTask({
			title: 'erledigt',
			status: 'Done',
			deadline: new Date(NOW.getTime() - 60 * 60 * 1000),
			userId: 1,
		});
		await createTask({ title: 'ohne Deadline', deadline: null, userId: 1 });

		const groups = await collectDueTaskReminders(NOW);

		assert.equal(groups.length, 1);
		const titles = groups[0].tasks.map((task) => task.title).sort();
		assert.deepEqual(titles, ['bald fällig', 'überfällig']);
	});

	it('isoliert nach userId — jeder Nutzer bekommt nur seine eigenen fälligen Tasks', async () => {
		await createTask({ title: 'A fällig', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'B fällig', deadline: new Date(NOW.getTime() - 1000), userId: 2 });

		const groups = await collectDueTaskReminders(NOW);

		assert.equal(groups.length, 2);
		const byUser = new Map(groups.map((group) => [group.userId, group.tasks.map((task) => task.title)]));
		assert.deepEqual(byUser.get(1), ['A fällig']);
		assert.deepEqual(byUser.get(2), ['B fällig']);
	});

	it('bündelt mehrere fällige Tasks eines Nutzers in eine Gruppe (keine Notification je Task)', async () => {
		await createTask({ title: 'Task 1', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'Task 2', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'Task 3', deadline: new Date(NOW.getTime() - 1000), userId: 1 });

		const groups = await collectDueTaskReminders(NOW);

		assert.equal(groups.length, 1);
		assert.equal(groups[0].tasks.length, 3);
	});

	it('versendet eine gebündelte Payload je Nutzer über sendPushToUser', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Rechnung zahlen', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1);
		const payload = JSON.parse(calls[0].body);
		assert.equal(payload.title, 'Fällige Aufgabe');
		assert.equal(payload.body, 'Rechnung zahlen');
		assert.equal(payload.url, '/');
	});

	it('bündelt bei mehreren fälligen Tasks eine zusammenfassende Payload mit Anzahl', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Task 1', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'Task 2', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(calls.length, 1, 'genau eine Notification statt einer je Task');
		const payload = JSON.parse(calls[0].body);
		assert.equal(payload.title, 'Fällige Aufgaben');
		assert.match(payload.body, /2/);
	});

	it('ist idempotent — ein zweiter Lauf ohne neue fällige Termine sendet nichts erneut', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Rechnung zahlen', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const first = await runDueTaskReminders(NOW, okSender(calls));
		const second = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(first.usersNotified, 1);
		assert.equal(second.usersNotified, 0, 'zweiter Lauf ohne neue fällige Termine meldet niemanden erneut');
		assert.equal(calls.length, 1, 'der Versand wurde nicht wiederholt');
		assert.equal(await NotificationLog.count(), 1);
	});

	it('erinnert erneut, wenn sich die Deadline eines bereits gemeldeten Tasks verschiebt', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		const task = await createTask({ title: 'verschoben', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		await runDueTaskReminders(NOW, okSender(calls));
		await task.update({ deadline: new Date(NOW.getTime() + 1000) });
		const second = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(second.usersNotified, 1, 'eine geänderte Deadline löst die Erinnerung erneut aus');
		assert.equal(calls.length, 2);
	});

	it('ohne fällige Tasks bleibt der Lauf ein No-op (kein Versand, kein Log-Eintrag)', async () => {
		await createTask({ title: 'weit weg', deadline: new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('ignoriert Tasks mit userId = null — kein Broadcast an alle Subscriptions', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Aufgabe ohne Nutzer', deadline: new Date(NOW.getTime() - 1000), userId: null });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'Tasks ohne userId dürfen keine Push-Nachricht auslösen');
		assert.equal(calls.length, 0);
	});
});
