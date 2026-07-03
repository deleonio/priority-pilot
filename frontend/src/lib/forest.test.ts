import type { TaskTreeNode } from 'client';
import { describe, expect, it } from 'vitest';
import { collectTaskValues } from './forest';

const node = (id: number, value: number, dependents: TaskTreeNode[] = []): TaskTreeNode => ({
	id,
	title: `T${id}`,
	priority: 1,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value,
	status: 'Open',
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
