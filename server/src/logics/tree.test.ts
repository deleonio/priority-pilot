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
		const task = await Task.create({ title: 'Root', priority: 3, estimatedEffort: 2 });
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

	it('Task mit Abhängigkeit ist kein Wurzel-Knoten', async () => {
		// b.addDependency(a): b depends on a
		// So a has no dependency (a is root), b has a dependency (b is not root)
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 2, estimatedEffort: 1 });
		await b.addDependency(a);
		const forest = await buildTaskForest();
		// Only a is a root (no dependencies)
		assert.equal(forest.length, 1);
		assert.equal(forest[0].id, a.id);
		// a's dependents should contain b
		assert.equal(forest[0].dependents.length, 1);
		assert.equal(forest[0].dependents[0].id, b.id);
	});

	it('totalEstimatedEffort ist eigener Aufwand + transitiver Abhängigkeiten', async () => {
		// c.addDependency(b): c depends on b
		// b.addDependency(a): b depends on a
		// So a is root; a's dependencies (Vorgänger) = []
		// b's dependencies = [a]; c's dependencies = [b]
		// totalEstimatedEffort(a) = effort(a) + Σ transitive getDependencies()
		//   a has getDependencies() = [] → totalEstimatedEffort(a) = 2
		// totalEstimatedEffort(b) = effort(b) + effort(a) = 3 + 2 = 5
		// totalEstimatedEffort(c) = effort(c) + effort(b) + effort(a) ... but wait:
		//   getEstimatedEffort(c) = c.estimatedEffort + Σ getEstimatedEffort(dep in c.getDependencies())
		//   c.getDependencies() = [b]
		//   getEstimatedEffort(b) = b.estimatedEffort + Σ getEstimatedEffort(dep in b.getDependencies())
		//   b.getDependencies() = [a]
		//   getEstimatedEffort(a) = a.estimatedEffort + [] = 2
		//   getEstimatedEffort(b) = 3 + 2 = 5
		//   getEstimatedEffort(c) = 4 + 5 = 9
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 2 });
		const b = await Task.create({ title: 'B', priority: 3, estimatedEffort: 3 });
		const c = await Task.create({ title: 'C', priority: 3, estimatedEffort: 4 });
		await b.addDependency(a);
		await c.addDependency(b);
		const forest = await buildTaskForest();
		// a is root
		assert.equal(forest.length, 1);
		const rootNode = forest[0];
		assert.equal(rootNode.id, a.id);
		assert.equal(rootNode.totalEstimatedEffort, 2);
		// b is child of a
		const bNode = rootNode.dependents[0];
		assert.equal(bNode.id, b.id);
		assert.equal(bNode.totalEstimatedEffort, 5);
		// c is child of b
		const cNode = bNode.dependents[0];
		assert.equal(cNode.id, c.id);
		assert.equal(cNode.totalEstimatedEffort, 9);
	});

	it('Forest ist absteigend nach value sortiert', async () => {
		// Two independent trees; root with higher priority gets higher value (it's a leaf)
		const lo = await Task.create({ title: 'Low', priority: 2, estimatedEffort: 1 });
		const hi = await Task.create({ title: 'High', priority: 8, estimatedEffort: 1 });
		const forest = await buildTaskForest();
		assert.equal(forest.length, 2);
		// hi (value=8) should come before lo (value=2)
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
