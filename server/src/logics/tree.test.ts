import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
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
