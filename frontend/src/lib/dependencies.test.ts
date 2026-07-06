import type { TaskTreeNode } from 'client';
import { describe, expect, it } from 'vitest';
import { buildDependencyMap } from './dependencies';

const node = (id: number, title: string, dependents: TaskTreeNode[] = []): TaskTreeNode => ({
	id,
	title,
	priority: 1,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value: 1,
	status: 'Open',
	dependents,
});

describe('buildDependencyMap', () => {
	it('liest die Vorgänger eines Tasks aus seinen Kindern (Unteraufgaben) im Wald (#336)', () => {
		// Wald-Kante A → B bedeutet seit #336: B ist Unteraufgabe/Vorgänger von A.
		const a = node(1, 'A', [node(2, 'B')]);
		const map = buildDependencyMap([a]);

		expect(map.get(1)).toEqual([{ id: 2, title: 'B' }]);
		expect(map.get(2)).toBeUndefined();
	});

	it('sammelt mehrere Vorgänger je Task und dedupliziert doppelte Kanten', () => {
		// A hat die Kinder B und C (beide Vorgänger von A); ein doppelt referenziertes Kind zählt einmal.
		const c = node(3, 'C');
		const map = buildDependencyMap([node(1, 'A', [node(2, 'B'), c, c])]);

		expect(map.get(1)).toEqual([
			{ id: 2, title: 'B' },
			{ id: 3, title: 'C' },
		]);
	});

	it('ist robust gegen Zyklen im Wald', () => {
		const a = node(1, 'A');
		const b = node(2, 'B', [a]);
		a.dependents = [b]; // künstlicher Zyklus A ↔ B

		expect(() => buildDependencyMap([a])).not.toThrow();
	});
});
