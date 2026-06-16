import type { Pillar, Task } from 'client';
import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import { buildPillarSummaries, isWeightSumValid, NO_PILLAR_VALUE, pillarSelectOptions, sumWeights } from './pillar';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, weight });

const task = (id: number, pillarId: number | null, estimatedEffort: number): Task => ({
	id,
	title: `T${id}`,
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort,
	actualEffort: null,
	description: null,
	deadline: null,
	pillarId,
});

describe('pillarSelectOptions', () => {
	it('stellt die „keine Säule"-Option voran und bildet alle Säulen ab', () => {
		const options = pillarSelectOptions([pillar(1, 'Körper', 20), pillar(2, 'Sinn', 80)]);
		expect(options).toEqual([
			{ label: '— Keine Säule —', value: NO_PILLAR_VALUE },
			{ label: 'Körper', value: 1 },
			{ label: 'Sinn', value: 2 },
		]);
	});

	it('liefert bei leerer Liste nur die „keine Säule"-Option', () => {
		expect(pillarSelectOptions([])).toEqual([{ label: '— Keine Säule —', value: NO_PILLAR_VALUE }]);
	});
});

describe('sumWeights', () => {
	it('summiert die Gewichte und zählt null als 0', () => {
		expect(sumWeights([20, 20, null, 40])).toBe(80);
	});

	it('liefert 0 für eine leere Liste', () => {
		expect(sumWeights([])).toBe(0);
	});
});

describe('isWeightSumValid', () => {
	it('akzeptiert exakt 100', () => {
		expect(isWeightSumValid(100)).toBe(true);
	});

	it('akzeptiert Float-Rundungsfehler innerhalb der Toleranz', () => {
		expect(isWeightSumValid(33.33 + 33.33 + 33.34)).toBe(true);
	});

	it('lehnt eine abweichende Summe ab', () => {
		expect(isWeightSumValid(99)).toBe(false);
		expect(isWeightSumValid(101)).toBe(false);
	});
});

describe('buildPillarSummaries', () => {
	const koerper = pillar(1, 'Körper', 40);
	const sinn = pillar(2, 'Sinn', 60);

	it('zählt Tasks je Säule und summiert Aufwand und Wert', () => {
		const tasks = [task(10, 1, 2), task(11, 1, 0.5), task(12, 2, 3), task(13, null, 9)];
		const valueByTaskId = new Map([
			[10, 5],
			[11, 1.5],
			[12, 4],
		]);

		const summaries = buildPillarSummaries([koerper, sinn], tasks, valueByTaskId);

		expect(summaries).toEqual([
			{ pillar: koerper, taskCount: 2, totalEstimatedEffort: 2.5, totalValue: 6.5 },
			{ pillar: sinn, taskCount: 1, totalEstimatedEffort: 3, totalValue: 4 },
		]);
	});

	it('wertet fehlende Wert-Einträge (z. B. erledigte Tasks) als 0', () => {
		const tasks = [task(10, 1, 2)];

		const summaries = buildPillarSummaries([koerper], tasks, new Map());

		expect(summaries[0]).toEqual({ pillar: koerper, taskCount: 1, totalEstimatedEffort: 2, totalValue: 0 });
	});

	it('liefert für eine Säule ohne Tasks Nullwerte und erhält die Reihenfolge', () => {
		const summaries = buildPillarSummaries([koerper, sinn], [], new Map());

		expect(summaries.map((summary) => summary.pillar.id)).toEqual([1, 2]);
		expect(summaries.every((summary) => summary.taskCount === 0 && summary.totalValue === 0)).toBe(true);
	});
});
