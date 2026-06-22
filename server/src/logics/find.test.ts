import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
import { findNextImportantTask } from './find.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

describe('findNextImportantTask', () => {
	it('Leerfall: keine Tasks → null', async () => {
		const result = await findNextImportantTask();
		assert.equal(result, null);
	});

	it('Gibt einzigen offenen Task zurück', async () => {
		const task = await Task.create({ title: 'Solo', priority: 3, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, task.id);
	});

	it('Ignoriert Done-Tasks', async () => {
		await Task.create({ title: 'Done task', priority: 5, estimatedEffort: 1, status: 'Done' });
		const open = await Task.create({ title: 'Open task', priority: 2, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, open.id);
	});

	it('Wählt Task mit höchster Priorität', async () => {
		await Task.create({ title: 'Low', priority: 2, estimatedEffort: 1 });
		const high = await Task.create({ title: 'High', priority: 5, estimatedEffort: 1 });
		await Task.create({ title: 'Mid', priority: 4, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, high.id);
	});

	it('Überspringt Tasks mit nicht-abgeschlossenen Abhängigkeiten', async () => {
		// b depends on a (a is not Done), so b should be excluded
		const a = await Task.create({ title: 'Blocker', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'Blocked', priority: 5, estimatedEffort: 1 });
		await b.addDependency(a); // b depends on a; a status = Open → blocks b
		const c = await Task.create({ title: 'Free', priority: 5, estimatedEffort: 1 });
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, c.id);
	});

	it('Wählt Task wenn alle Abhängigkeiten Done sind', async () => {
		const done = await Task.create({ title: 'Done dep', priority: 1, estimatedEffort: 1, status: 'Done' });
		const b = await Task.create({ title: 'Unblocked', priority: 5, estimatedEffort: 1 });
		await b.addDependency(done); // b depends on done (status=Done) → b is free
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, b.id);
	});

	it('"In process"-Tasks werden berücksichtigt', async () => {
		const inProcess = await Task.create({
			title: 'In progress',
			priority: 5,
			estimatedEffort: 1,
			status: 'In process',
		});
		const result = await findNextImportantTask();
		assert.ok(result !== null);
		assert.equal(result.id, inProcess.id);
	});
});
