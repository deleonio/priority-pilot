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
	it('kehrt dependents-Kanten zu Vorgänger-Listen um', () => {
		// Wurzel A hat den Dependent B (B hängt von A ab) → A ist Vorgänger von B.
		const a = node(1, 'A', [node(2, 'B')]);
		const map = buildDependencyMap([a]);

		expect(map.get(2)).toEqual([{ id: 1, title: 'A' }]);
		expect(map.get(1)).toBeUndefined();
	});

	it('dedupliziert mehrfach erreichbare Vorgänger', () => {
		// A → C und B → C; C wird über beide Wurzeln erreicht, soll aber je Vorgänger nur einmal auftauchen.
		const shared = node(3, 'C');
		const map = buildDependencyMap([node(1, 'A', [shared]), node(2, 'B', [shared])]);

		expect(map.get(3)).toEqual([
			{ id: 1, title: 'A' },
			{ id: 2, title: 'B' },
		]);
	});

	it('ist robust gegen Zyklen im Wald', () => {
		const a = node(1, 'A');
		const b = node(2, 'B', [a]);
		a.dependents = [b]; // künstlicher Zyklus A ↔ B

		expect(() => buildDependencyMap([a])).not.toThrow();
	});
});
