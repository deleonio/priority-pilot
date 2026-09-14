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
		expect(leaves.map((n) => n.id)).toEqual([3, 2]);
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

/**
 * Roter TDD-Vertrag für #1345 AK2–AK4: `extractLeaves` bekommt eine Option `includeParents`.
 * Ohne die Option (oder `false`) bleibt das Verhalten unverändert (AK2, s. Tests oben). Mit
 * `includeParents: true` werden zusätzlich die Oberaufgaben (`dependents.length > 0`) im
 * gemeinsamen `value`-Ranking eingemischt, keine Duplikate (AK3, AK4).
 */
describe('extractLeaves mit includeParents (#1345)', () => {
	it('AK2: ohne includeParents unverändert nur Blätter', () => {
		const forest = [node(1, 'Eltern', 8, [node(2, 'Kind', 3)])];
		expect(extractLeaves(forest).map((n) => n.id)).toEqual([2]);
		expect(extractLeaves(forest, { includeParents: false }).map((n) => n.id)).toEqual([2]);
	});

	it('AK3: includeParents:true blendet Oberaufgaben mit offener Unteraufgabe zusätzlich ein', () => {
		const forest = [node(1, 'Eltern', 8, [node(2, 'Kind', 3)]), node(4, 'Solo-Blatt', 6)];
		const result = extractLeaves(forest, { includeParents: true });
		expect(result.map((n) => n.id)).toEqual([1, 4, 2]);
	});

	it('AK3: keine Duplikate — eine Oberaufgabe mit zwei Kindern erscheint genau einmal', () => {
		const forest = [node(1, 'Eltern', 9, [node(2, 'Kind-1', 3), node(3, 'Kind-2', 5)])];
		const result = extractLeaves(forest, { includeParents: true });
		expect(result.filter((n) => n.id === 1)).toHaveLength(1);
		expect(result.map((n) => n.id)).toEqual([1, 3, 2]);
	});

	it('AK4: gemeinsame value-Sortierung über Blätter und Oberaufgaben in einem Durchgang', () => {
		const forest = [
			node(1, 'Eltern-niedrig', 2, [node(2, 'Kind', 1)]),
			node(3, 'Blatt-mittel', 5),
			node(4, 'Eltern-hoch', 9, [node(5, 'Kind-2', 4)]),
		];
		const result = extractLeaves(forest, { includeParents: true });
		expect(result.map((n) => n.id)).toEqual([4, 3, 5, 1, 2]);
	});
});

/**
 * Roter TDD-Vertrag für #1449: `buildTaskForest` materialisiert eine Unteraufgabe, die
 * Vorgänger mehrerer Oberaufgaben ist, als mehrere frische Knoten-Objekte mit derselben `id`
 * (einmal pro Pfad). `extractLeaves` muss über `node.id` deduplizieren, nicht über
 * Objekt-Identität — sonst landet derselbe Task mehrfach in der flachen Liste.
 */
describe('extractLeaves dedupliziert geteilte Knoten (#1449)', () => {
	it('AK1: ein Blatt mit gleicher id unter zwei Oberaufgaben erscheint genau einmal', () => {
		// Gleiche id (2), aber zwei eigenständige Objekt-Referenzen — wie bei buildTaskForest.
		const sharedA = node(2, 'Geteiltes Blatt', 3);
		const sharedB = node(2, 'Geteiltes Blatt', 3);
		const forest = [node(1, 'Eltern-A', 8, [sharedA]), node(4, 'Eltern-B', 6, [sharedB])];

		const leaves = extractLeaves(forest);

		expect(leaves.filter((n) => n.id === 2)).toHaveLength(1);
		expect(leaves.map((n) => n.id)).toEqual([2]);
	});

	it('AK2: includeParents dedupliziert auch mehrfach materialisierte Oberaufgaben-Knoten', () => {
		// Oberaufgabe 1 hängt (mehrfach materialisiert) unter zwei Großeltern; Blatt 2 ebenfalls geteilt.
		const childA = node(2, 'Kind', 3);
		const childB = node(2, 'Kind', 3);
		const parentA = node(1, 'Eltern', 7, [childA]);
		const parentB = node(1, 'Eltern', 7, [childB]);
		const forest = [node(10, 'Großeltern-A', 9, [parentA]), node(11, 'Großeltern-B', 5, [parentB])];

		const result = extractLeaves(forest, { includeParents: true });

		expect(result.filter((n) => n.id === 1)).toHaveLength(1);
		expect(result.filter((n) => n.id === 2)).toHaveLength(1);
		expect(new Set(result.map((n) => n.id)).size).toBe(result.length);
	});

	it('AK3: bei Duplikaten gewinnt das erste Antreffen der Tiefen-Traversierung (Reihenfolge unverändert)', () => {
		const sharedLow = node(2, 'Geteilt-niedrig', 1);
		const sharedLowDup = node(2, 'Geteilt-niedrig', 1);
		const forest = [
			node(1, 'Eltern-hoch', 9, [sharedLow]),
			node(3, 'Solo-mittel', 5),
			node(4, 'Eltern-niedrig', 2, [sharedLowDup]),
		];

		const leaves = extractLeaves(forest);

		// Eindeutige Blätter nach Dedup: id 2 (value 1, erste Sichtung unter Eltern-hoch) und id 3
		// (value 5); sortiert nach value absteigend ergibt [3, 2]. Das Duplikat von id 2 unter
		// Eltern-niedrig entfällt.
		expect(leaves.map((n) => n.id)).toEqual([3, 2]);
		expect(leaves.filter((n) => n.id === 2)).toHaveLength(1);
	});
});
