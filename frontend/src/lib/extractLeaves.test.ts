import type { TaskTreeNode } from 'client';
import { describe, expect, it } from 'vitest';
import { extractLeaves } from './extractLeaves';

/**
 * Roter TDD-Vertrag für #537 AK3: Die Blatt-Extraktion ersetzt die frühere Wald-Inversion
 * (`invertForest`). Statt den semantischen Wald umzudrehen (Blätter zu Wurzeln, Oberaufgaben als
 * aufklappbare Kinder), extrahiert `extractLeaves` **nur** die Blatt-Knoten (`dependents.length === 0`)
 * aus dem originalen `/forest`-Wald und sortiert sie nach Wertbeitrag absteigend (Status quo der
 * bisherigen Wurzel-Sortierung). Diese Spec ist rot, bis `extractLeaves` existiert und in
 * `TaskTree.tsx` anstelle von `invertForest` verwendet wird.
 */
const node = (id: number, title: string, value: number, dependents: TaskTreeNode[] = []): TaskTreeNode => ({
	id,
	title,
	priority: 1,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value,
	status: 'Open',
	dependents,
});

describe('extractLeaves (#537)', () => {
	it('AK1: liefert ausschließlich Blätter (dependents.length === 0) — Eltern fallen weg', () => {
		const forest = [node(1, 'Eltern', 5, [node(2, 'Blatt', 3)]), node(3, 'Solo-Blatt', 4)];
		const leaves = extractLeaves(forest);
		expect(leaves.map((n) => n.id)).toEqual([2, 3]);
		expect(leaves.every((n) => n.dependents.length === 0)).toBe(true);
	});

	it('AK1: tiefe Struktur — nur das echte Blatt, nicht die Zwischenebenen', () => {
		const forest = [node(1, 'Wurzel', 9, [node(2, 'Mitte', 7, [node(3, 'Blatt', 2)])])];
		const leaves = extractLeaves(forest);
		expect(leaves.map((n) => n.id)).toEqual([3]);
	});

	it('AK7: sortiert die Blätter nach Wertbeitrag absteigend', () => {
		const forest = [
			node(1, 'A', 2, [node(2, 'Blatt-niedrig', 1)]),
			node(3, 'Blatt-mittel', 5),
			node(4, 'Blatt-hoch', 9),
		];
		const leaves = extractLeaves(forest);
		expect(leaves.map((n) => n.id)).toEqual([4, 3, 2]);
	});

	it('AK7: bestehende Reihenfolge bei Wertgleichheit (stabil)', () => {
		const forest = [node(1, 'Eins', 5), node(2, 'Zwei', 5), node(3, 'Drei', 5)];
		const leaves = extractLeaves(forest);
		expect(leaves.map((n) => n.id)).toEqual([1, 2, 3]);
	});

	it('AK1: leerer Wald liefert leere Liste', () => {
		expect(extractLeaves([])).toEqual([]);
	});

	it('AK1: ein von mehreren Kindern geteilter Eltern-Knoten wird nicht zum Blatt', () => {
		const forest = [node(1, 'Eltern', 8, [node(2, 'Kind-1', 3), node(3, 'Kind-2', 6)])];
		const leaves = extractLeaves(forest);
		expect(leaves.map((n) => n.id)).toEqual([3, 2]);
	});
});
