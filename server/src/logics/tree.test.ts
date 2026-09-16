import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series, Task } from '../models/index.js';
import { buildTaskForest } from './tree.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

describe('buildTaskForest', () => {
	it('Leerer Forest wenn keine Tasks vorhanden', async () => {
		const forest = await buildTaskForest();
		assert.deepEqual(forest, []);
	});

	it('Einzelner Task ist Wurzel ohne Kinder', async () => {
		const task = await Task.create({ title: 'Root', priority: 3, estimatedEffort: 1 });
		const forest = await buildTaskForest();
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, task.id);
		assert.deepEqual(forest[0].dependents, []);
	});

	it('Done-Tasks werden ausgeschlossen', async () => {
		await Task.create({ title: 'Done', priority: 5, estimatedEffort: 1, status: 'Done' });
		const open = await Task.create({ title: 'Open', priority: 3, estimatedEffort: 1 });
		const forest = await buildTaskForest();
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, open.id);
	});

	it('Task mit Unteraufgabe: die abhängige Aufgabe ist Wurzel, ihr Vorgänger das Kind (#336)', async () => {
		// b.addDependency(a): b hängt von a ab → a ist Unteraufgabe (Vorgänger) von b.
		// Orientierung seit #336: Wurzeln sind Tasks ohne Dependents; Kinder = getDependencies().
		// b hat keine Dependents → b ist Wurzel; a ist Kind (Unteraufgabe) unter b.
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 2, estimatedEffort: 1 });
		await b.addDependency(a);
		const forest = await buildTaskForest();
		// Only b is a root (nothing depends on b)
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, b.id);
		// b's children (Unteraufgaben) should contain a
		assert.equal(forest[0].dependents.length, 1);
		assert.equal(forest[0].dependents[0].id, a.id);
	});

	it('Erledigte Unteraufgabe verschwindet aus dem Baum (#392)', async () => {
		const child = await Task.create({ title: 'Kind', priority: 3, estimatedEffort: 1 });
		const parent = await Task.create({ title: 'Eltern', priority: 3, estimatedEffort: 1 });
		await parent.addDependency(child);
		// Kind erledigen → parent sollte als Wurzel erscheinen, Kind nicht mehr im Baum
		await child.update({ status: 'Done' });
		const forest = await buildTaskForest();
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, parent.id);
		assert.deepEqual(forest[0].dependents, []);
	});

	it('Fortschritt zählt erledigte Unteraufgaben weiter, obwohl sie ausgeblendet sind (#392 ∩ #241)', async () => {
		// Regression-Schutz für den Konflikt #392 (erledigte Unteraufgaben aus dem Baum entfernt) vs.
		// #241 (Fortschritt „erledigt/gesamt"): `progress` wird über die UNGEFILTERTE Kette gezählt,
		// bleibt also korrekt, obwohl das erledigte Kind nicht mehr in `dependents` steht.
		const child = await Task.create({ title: 'Kind', priority: 3, estimatedEffort: 1 });
		const parent = await Task.create({ title: 'Eltern', priority: 3, estimatedEffort: 1 });
		await parent.addDependency(child);
		await child.update({ status: 'Done' });
		const forest = await buildTaskForest();
		// Kind ausgeblendet …
		assert.deepEqual(forest[0].dependents, []);
		// … aber der Fortschritt zählt es weiter: Eltern + Kind = 2 gesamt, 1 erledigt.
		assert.deepEqual(forest[0].progress, { done: 1, total: 2 });
	});

	it('Fortschritt ist null für einen Task ohne Unteraufgaben (#241)', async () => {
		await Task.create({ title: 'Solo', priority: 3, estimatedEffort: 1 });
		const forest = await buildTaskForest();
		assert.equal(forest[0].progress, null);
	});

	it('totalEstimatedEffort ist eigener Aufwand + transitiver Abhängigkeiten', async () => {
		// c.addDependency(b): c depends on b (b ist Unteraufgabe von c)
		// b.addDependency(a): b depends on a (a ist Unteraufgabe von b)
		// Orientierung seit #336: Wurzeln = Tasks ohne Dependents; Kinder = getDependencies().
		//   c hat keine Dependents → c ist Wurzel. c → b → a hängt darunter.
		// totalEstimatedEffort summiert weiterhin die getDependencies() (Unteraufgaben):
		//   getEstimatedEffort(a) = a.estimatedEffort + [] = 0.125
		//   getEstimatedEffort(b) = 0.25 + 0.125 = 0.375
		//   getEstimatedEffort(c) = 0.5 + 0.375 = 0.875
		// (exakte Binär-Brüche, damit die Summen ohne Float-Rundung aufgehen)
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 0.125 });
		const b = await Task.create({ title: 'B', priority: 3, estimatedEffort: 0.25 });
		const c = await Task.create({ title: 'C', priority: 3, estimatedEffort: 0.5 });
		await b.addDependency(a);
		await c.addDependency(b);
		const forest = await buildTaskForest();
		// c is root (nothing depends on c)
		assert.equal(forest.length, 1);
		const rootNode = forest[0];
		assert.equal(rootNode.id, c.id);
		assert.equal(rootNode.totalEstimatedEffort, 0.875);
		// b is child (Unteraufgabe) of c
		const bNode = rootNode.dependents[0];
		assert.equal(bNode.id, b.id);
		assert.equal(bNode.totalEstimatedEffort, 0.375);
		// a is child (Unteraufgabe) of b
		const aNode = bNode.dependents[0];
		assert.equal(aNode.id, a.id);
		assert.equal(aNode.totalEstimatedEffort, 0.125);
	});

	it('Forest ist absteigend nach value sortiert', async () => {
		// Two independent trees; root with higher priority gets higher value (it's a leaf)
		const lo = await Task.create({ title: 'Low', priority: 2, estimatedEffort: 1 });
		const hi = await Task.create({ title: 'High', priority: 5, estimatedEffort: 1 });
		const forest = await buildTaskForest();
		assert.equal(forest.length, 2);
		// hi (priority 5) should come before lo (priority 2)
		assert.ok(forest[0].value >= forest[1].value);
		assert.equal(forest[0].id, hi.id);
		assert.equal(forest[1].id, lo.id);
	});

	it('"In process"-Tasks erscheinen im Forest', async () => {
		const inProcess = await Task.create({ title: 'WIP', priority: 5, estimatedEffort: 1, status: 'In process' });
		const forest = await buildTaskForest();
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, inProcess.id);
	});
});

// Rote Spec-Tests für #1518 (Spec docs/spec/issue-1518.md, Journey 1): der Wald (`GET /forest`, speist die
// Aufgabenliste und „Wichtigste Tasks") zeigt je Serie nur die früheste offene Instanz ab heute; wird
// sie erledigt, rückt die nächste nach (AK9). KEIN Produktivcode.
describe('buildTaskForest — eine Instanz je Serie (#1518)', () => {
	const dayFromToday = (offset: number): Date => {
		const day = new Date();
		day.setUTCHours(0, 0, 0, 0);
		day.setUTCDate(day.getUTCDate() + offset);
		return day;
	};

	const seedDailySeries = async (): Promise<{ seriesId: number; instances: Task[] }> => {
		const series = await Series.create({
			title: 'Täglich',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: dayFromToday(0),
		});
		const instances: Task[] = [];
		for (let offset = 0; offset < 5; offset += 1) {
			const occurrence = dayFromToday(offset);
			instances.push(
				await Task.create({
					title: 'Täglich',
					priority: 3,
					estimatedEffort: 0.5,
					deadline: occurrence,
					seriesId: series.id,
					seriesOccurrence: occurrence,
					originSeriesId: series.id,
				}),
			);
		}
		return { seriesId: series.id, instances };
	};

	it('AK4: fünf offene Instanzen erscheinen als genau eine Wurzel — die mit Deadline heute', async () => {
		const { instances } = await seedDailySeries();
		await Task.create({ title: 'Einzeln', priority: 3, estimatedEffort: 1 });

		const forest = await buildTaskForest();
		const seriesRoots = forest.filter((node) => node.title === 'Täglich');
		assert.equal(seriesRoots.length, 1, 'genau eine Zeile je Serie');
		assert.equal(seriesRoots[0].id, instances[0].id, 'die Instanz mit Deadline heute');
		assert.equal(forest.length, 2, 'die Einzelaufgabe bleibt unverändert');
	});

	it('AK9: wird die gezeigte Instanz erledigt, rückt die nächste Instanz derselben Serie nach', async () => {
		const { instances } = await seedDailySeries();
		await instances[0].update({ status: 'Done' });

		const forest = await buildTaskForest();
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, instances[1].id, 'die Instanz mit Deadline heute+1');
	});
});
