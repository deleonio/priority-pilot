import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, Task } from '../models/index.js';
import { calculateValueContribution } from './value.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

describe('calculateValueContribution', () => {
	it('Blatt-Task: Wert = priority', async () => {
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1 });
		const value = await calculateValueContribution(task);
		assert.equal(value, 5);
	});

	it('Blatt-Task mit priority 1: Wert = 1', async () => {
		const task = await Task.create({ title: 'Leaf2', priority: 1, estimatedEffort: 0.5 });
		const value = await calculateValueContribution(task);
		assert.equal(value, 1);
	});

	it('Ein Dependent mit default weight 1: (childValue * 1 + priority) / 2', async () => {
		// parent.getDependents() = [child]
		// child is leaf: value = child.priority / 1 = 3
		// parent value = (3 * 1 + 10) / (1 + 1) = 13/2 = 6.5
		const parent = await Task.create({ title: 'Parent', priority: 10, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1 });
		// child depends on parent: child.addDependency(parent) => parent has child as dependent
		await child.addDependency(parent);
		const value = await calculateValueContribution(parent);
		assert.equal(value, 6.5);
	});

	it('Gewichteter Dependent: Kantengewicht wird berücksichtigt', async () => {
		// parent.getDependents() = [child with weight 2]
		// child value = 4
		// parent value = (4 * 2 + 8) / (1 + 1) = (8 + 8) / 2 = 8
		const parent = await Task.create({ title: 'P', priority: 8, estimatedEffort: 1 });
		const child = await Task.create({ title: 'C', priority: 4, estimatedEffort: 1 });
		await child.addDependency(parent, { through: { weight: 2 } });
		const value = await calculateValueContribution(parent);
		assert.equal(value, 8);
	});

	it('Konkreter Zahlenfall: zwei dependents', async () => {
		// root is leaf with priority 2 → value = 2
		// mid1 depends on root (weight 1), mid1 priority = 4
		//   mid1 getDependents = [] (no one depends on mid1), wait — getDependents is children in tree
		//
		// Let's be precise:
		// A is the task under test
		// B and C are tasks that depend on A (B.addDependency(A), C.addDependency(A))
		// so A.getDependents() = [B, C]
		// B is leaf: value(B) = B.priority = 6
		// C is leaf: value(C) = C.priority = 2
		// value(A) = (value(B)*weight(B) + value(C)*weight(C) + A.priority) / (2 + 1)
		//          = (6*1 + 2*1 + 3) / 3 = 11/3
		const a = await Task.create({ title: 'A', priority: 3, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 6, estimatedEffort: 1 });
		const c = await Task.create({ title: 'C', priority: 2, estimatedEffort: 1 });
		await b.addDependency(a);
		await c.addDependency(a);
		const value = await calculateValueContribution(a);
		assert.ok(Math.abs(value - 11 / 3) < 1e-10, `Expected ${11 / 3} but got ${value}`);
	});

	it('Säule mit Gleichverteilung (weight 20): neutral, Wert = priority', async () => {
		const pillar = await Pillar.create({ name: 'Neutral', weight: 20 });
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1, pillarId: pillar.id });
		const value = await calculateValueContribution(task);
		assert.equal(value, 5);
	});

	it('Höher gewichtete Säule (weight 40): Faktor 2, Wert = priority * 2', async () => {
		const pillar = await Pillar.create({ name: 'Hoch', weight: 40 });
		const task = await Task.create({ title: 'Leaf', priority: 5, estimatedEffort: 1, pillarId: pillar.id });
		const value = await calculateValueContribution(task);
		assert.equal(value, 10);
	});

	it('Niedriger gewichtete Säule (weight 10): Faktor 0.5, Wert = priority * 0.5', async () => {
		const pillar = await Pillar.create({ name: 'Niedrig', weight: 10 });
		const task = await Task.create({ title: 'Leaf', priority: 6, estimatedEffort: 1, pillarId: pillar.id });
		const value = await calculateValueContribution(task);
		assert.equal(value, 3);
	});

	it('Task ohne Säule: Faktor 1 (unverändert)', async () => {
		const task = await Task.create({ title: 'Leaf', priority: 7, estimatedEffort: 1 });
		const value = await calculateValueContribution(task);
		assert.equal(value, 7);
	});

	it('Säulen-Faktor wirkt auf jeden Task im Baum (Dependent mit höher gewichteter Säule)', async () => {
		// parent.getDependents() = [child], child mit Säule weight 40 ⇒ Faktor 2
		// child (Blatt) value = child.priority * 2 = 3 * 2 = 6
		// parent ohne Säule ⇒ Faktor 1: value = (6 * 1 + 10) / (1 + 1) = 8
		const pillar = await Pillar.create({ name: 'Hoch', weight: 40 });
		const parent = await Task.create({ title: 'Parent', priority: 10, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1, pillarId: pillar.id });
		await child.addDependency(parent);
		const value = await calculateValueContribution(parent);
		assert.equal(value, 8);
	});
});
