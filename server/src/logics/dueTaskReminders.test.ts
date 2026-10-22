import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, Series } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { collectDueTaskReminders } from './dueTaskReminders.js';

/**
 * Tests für den Sammler „fällige Aufgaben" (Issue #355) — die Auswahl- und Gruppierungslogik des
 * Morgen-Digests „Dein Tag" (#2853). Der frühere Eigentrigger `runDueTaskReminders` (Push +
 * Morgen-Mail #1426, Fenster, Tag-Deckel) ist mit der Bündelung entfallen; sein Verhalten lebt im
 * Digest und wird in `dailyDigest.test.ts` geprüft.
 */

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

describe('logics/dueTaskReminders — Sammler „fällige Aufgaben" (Issue #355)', () => {
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

	// #1518 AK7 (Spec docs/spec/issue-1518.md, Journey 2): je Serie höchstens eine Instanz in den fälligen Aufgaben.
	it('#1518 AK7: fünf fällige Instanzen derselben Serie ergeben genau einen Eintrag', async () => {
		const series = await Series.create({
			title: 'Täglich',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: NOW,
		});
		for (let offset = 0; offset < 5; offset += 1) {
			const occurrence = new Date(NOW.getTime() - offset * 60 * 60 * 1000);
			await Task.create({
				title: 'Täglich',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
				deadline: occurrence,
				seriesId: series.id,
				seriesOccurrence: occurrence,
				originSeriesId: series.id,
				userId: 1,
			});
		}
		await createTask({ title: 'Einzeln', deadline: NOW, userId: 1 });

		const groups = await collectDueTaskReminders(NOW);
		assert.equal(groups.length, 1);
		const titles = groups[0].tasks.map((task) => task.title).sort();
		assert.deepEqual(titles, ['Einzeln', 'Täglich'], 'die Serie erscheint genau einmal');
	});
});
