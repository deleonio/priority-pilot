import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
import { wouldCreateCycle } from './cycle.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

describe('wouldCreateCycle', () => {
	it('Kein Zyklus: unverbundene Tasks', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		const result = await wouldCreateCycle(a, b);
		assert.equal(result, false);
	});

	it('Direkter Zyklus: a hängt von b ab, b soll von a abhängen → Zyklus', async () => {
		// a.addDependency(b): a depends on b
		// Now adding b.addDependency(a) would create a cycle
		// wouldCreateCycle(b, a) checks: if we make b depend on a, does a→b→a arise?
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		await a.addDependency(b); // a depends on b
		// Now check: would making b depend on a create a cycle?
		const result = await wouldCreateCycle(b, a);
		assert.equal(result, true);
	});

	it('Selbst-Zyklus: Task soll von sich selbst abhängen', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const result = await wouldCreateCycle(a, a);
		assert.equal(result, true);
	});

	it('Transitiver Zyklus: a→b→c, c soll von a abhängen', async () => {
		// a.addDependency(b): a depends on b
		// b.addDependency(c): b depends on c
		// Check: would making c depend on a create cycle?
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		const c = await Task.create({ title: 'C', priority: 1, estimatedEffort: 1 });
		await a.addDependency(b);
		await b.addDependency(c);
		// If we try to make c depend on a: c→a→b→c would form a cycle
		const result = await wouldCreateCycle(c, a);
		assert.equal(result, true);
	});

	it('Nicht-Zyklus: a→b, c ist unabhängig von a', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		const c = await Task.create({ title: 'C', priority: 1, estimatedEffort: 1 });
		await a.addDependency(b);
		// Would making c depend on a create a cycle? No, a has no path to c
		const result = await wouldCreateCycle(c, a);
		assert.equal(result, false);
	});
});
