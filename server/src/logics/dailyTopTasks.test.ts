import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, Series } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { collectDailyTopTasks } from './dailyTopTasks.js';

/**
 * Tests für den Sammler „3 wichtigste Aufgaben" (Issue #518) — die Ranking-Logik des
 * Morgen-Digests „Dein Tag" (#2853). Der frühere Eigentrigger `runDailyTopTasksPush` (Push,
 * Fenster, Tag-Deckel) ist mit der Bündelung entfallen; sein Verhalten lebt im Digest und wird in
 * `dailyDigest.test.ts` geprüft.
 *
 * Fachlicher Unterschied zu Issue #355 (`dueTaskReminders`): #355 löst auf nahe Deadlines aus
 * (`deadline <= now + 24h`); #518 bewertet **tagesunabhängig von Deadlines** nach `Task.priority`.
 *
 * Annahmen (offene Punkte aus dem Issue-Body, hier als falsifizierbarer Vertrag festgeschrieben):
 *  - Ranking-Feld ist `Task.priority`, **aufsteigend = wichtiger** (P1 am höchsten).
 *  - Leer-Fall (0 Aufgaben): keine Gruppe.
 */

// im UTC-Morgenfenster des Digests (lokale Stunde 7–9, #2849)
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

describe('logics/dailyTopTasks — „3 wichtigste Aufgaben" (Issue #518)', () => {
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

	it('AC1/T6: Tasks ohne userId erscheinen in keiner Gruppe — kein Broadcast an alle Subscriptions', async () => {
		await createTask({ title: 'ohne Nutzer', priority: 1, userId: null });

		const groups = await collectDailyTopTasks(NOW);

		assert.equal(groups.length, 0, 'Tasks ohne Eigentümer lösen keinen Daily-Push aus');
	});

	// #1518 (Spec docs/spec/issue-1518.md, Journey 2): der Morgen-Push nennt drei verschiedene Aufgaben,
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
