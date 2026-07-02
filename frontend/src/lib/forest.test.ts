import type { TaskTreeNode } from 'client';
import { describe, expect, it } from 'vitest';
import { collectTaskValues, flattenForest } from './forest';

const node = (id: number, value: number, dependents: TaskTreeNode[] = []): TaskTreeNode => ({
	id,
	title: `T${id}`,
	priority: 1,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value,
	dependents,
});

describe('collectTaskValues', () => {
	it('sammelt den Wert je Task über den gesamten Wald', () => {
		const values = collectTaskValues([node(1, 10, [node(2, 4)]), node(3, 7)]);

		expect(values.get(1)).toBe(10);
		expect(values.get(2)).toBe(4);
		expect(values.get(3)).toBe(7);
	});

	it('übernimmt je Task nur den ersten Wert bei Mehrfach-Erreichbarkeit', () => {
		// Derselbe Task (id 3) hängt von zwei Wurzeln ab und taucht im Wald doppelt auf.
		const values = collectTaskValues([node(1, 5, [node(3, 9)]), node(2, 6, [node(3, 9)])]);

		expect(values.get(3)).toBe(9);
		expect(values.size).toBe(3);
	});

	it('liefert eine leere Map für einen leeren Wald', () => {
		expect(collectTaskValues([]).size).toBe(0);
	});

	it('ist robust gegen Zyklen im Wald', () => {
		const a = node(1, 1);
		const b = node(2, 2, [a]);
		a.dependents = [b]; // künstlicher Zyklus A ↔ B

		expect(() => collectTaskValues([a])).not.toThrow();
	});
});

describe('flattenForest', () => {
	it('gibt eingeklappt nur die Wurzeln mit Tiefe 0 zurück', () => {
		const rows = flattenForest([node(1, 10, [node(2, 4)]), node(3, 7)], new Set<number>());

		expect(rows.map((row) => row.node.id)).toEqual([1, 3]);
		expect(rows.every((row) => row.depth === 0)).toBe(true);
	});

	it('markiert Knoten mit Unteraufgaben als aufklappbar', () => {
		const rows = flattenForest([node(1, 10, [node(2, 4)]), node(3, 7)], new Set<number>());
		const byId = new Map(rows.map((row) => [row.node.id, row]));

		expect(byId.get(1)?.hasChildren).toBe(true);
		expect(byId.get(3)?.hasChildren).toBe(false);
	});

	it('nimmt die Unteraufgaben eines aufgeklappten Knotens mit erhöhter Tiefe auf', () => {
		const rows = flattenForest([node(1, 10, [node(2, 4)])], new Set([1]));

		expect(rows.map((row) => row.node.id)).toEqual([1, 2]);
		expect(rows.find((row) => row.node.id === 2)?.depth).toBe(1);
	});

	it('flacht rekursiv über mehrere aufgeklappte Ebenen ab', () => {
		const forest = [node(1, 10, [node(2, 4, [node(3, 1)])])];

		expect(flattenForest(forest, new Set([1])).map((row) => row.node.id)).toEqual([1, 2]);
		expect(flattenForest(forest, new Set([1, 2])).map((row) => row.node.id)).toEqual([1, 2, 3]);
		expect(flattenForest(forest, new Set([1, 2])).find((row) => row.node.id === 3)?.depth).toBe(2);
	});

	it('ist robust gegen Zyklen im Wald', () => {
		const a = node(1, 1);
		const b = node(2, 2, [a]);
		a.dependents = [b]; // künstlicher Zyklus A ↔ B

		expect(() => flattenForest([a], new Set([1, 2]))).not.toThrow();
	});
});
