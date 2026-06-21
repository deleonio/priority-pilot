import type { Pillar, PillarSuggestion, Task, TaskPillarContribution } from 'client';
import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import {
	ADD_PILLAR_PLACEHOLDER,
	addPillarOptions,
	buildPillarSummaries,
	isWeightSumValid,
	suggestionsToContributions,
	sumWeights,
} from './pillar';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, weight });

const task = (id: number, pillars: TaskPillarContribution[], estimatedEffort: number): Task => ({
	id,
	title: `T${id}`,
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort,
	actualEffort: null,
	description: null,
	deadline: null,
	pillars,
});

describe('addPillarOptions', () => {
	it('stellt die Platzhalter-Option voran und bildet die verfügbaren Säulen ab', () => {
		const options = addPillarOptions([pillar(1, 'Körper', 20), pillar(2, 'Sinn', 80)]);
		expect(options).toEqual([
			{ label: '— Säule hinzufügen —', value: ADD_PILLAR_PLACEHOLDER },
			{ label: 'Körper', value: 1 },
			{ label: 'Sinn', value: 2 },
		]);
	});

	it('liefert bei leerer Liste nur die Platzhalter-Option', () => {
		expect(addPillarOptions([])).toEqual([{ label: '— Säule hinzufügen —', value: ADD_PILLAR_PLACEHOLDER }]);
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

describe('suggestionsToContributions', () => {
	const validIds = new Set([1, 2, 3]);
	const suggestion = (pillarId: number, confidence: number): PillarSuggestion => ({ pillarId, confidence });

	it('übernimmt eine einzelne Säule mit vollem Anteil (100 %)', () => {
		expect(suggestionsToContributions([suggestion(2, 80)], validIds)).toEqual([
			{ pillarId: 2, share: 100, confidence: 80 },
		]);
	});

	it('verteilt die Anteile proportional zur Konfidenz und ergibt in Summe genau 100 %', () => {
		const result = suggestionsToContributions([suggestion(1, 75), suggestion(2, 25)], validIds);
		expect(result).toEqual([
			{ pillarId: 1, share: 75, confidence: 75 },
			{ pillarId: 2, share: 25, confidence: 25 },
		]);
		expect(isWeightSumValid(sumWeights(result.map((entry) => entry.share)))).toBe(true);
	});

	it('legt den Rundungsrest auf die letzte Säule, sodass die Summe exakt 100 % bleibt', () => {
		const result = suggestionsToContributions([suggestion(1, 33), suggestion(2, 33), suggestion(3, 33)], validIds);
		expect(sumWeights(result.map((entry) => entry.share))).toBe(100);
		expect(isWeightSumValid(sumWeights(result.map((entry) => entry.share)))).toBe(true);
	});

	it('ignoriert unbekannte Säulen und solche mit Konfidenz 0', () => {
		const result = suggestionsToContributions([suggestion(1, 60), suggestion(99, 90), suggestion(2, 0)], validIds);
		expect(result).toEqual([{ pillarId: 1, share: 100, confidence: 60 }]);
	});

	it('liefert eine leere Liste, wenn kein gültiger Vorschlag übrig bleibt', () => {
		expect(suggestionsToContributions([suggestion(99, 90), suggestion(2, 0)], validIds)).toEqual([]);
		expect(suggestionsToContributions([], validIds)).toEqual([]);
	});

	it('klemmt und rundet die Konfidenz auf [0, 100] passend zum Slider-Step', () => {
		const result = suggestionsToContributions([suggestion(1, 142.6)], validIds);
		expect(result).toEqual([{ pillarId: 1, share: 100, confidence: 100 }]);
	});
});

describe('buildPillarSummaries', () => {
	const koerper = pillar(1, 'Körper', 40);
	const sinn = pillar(2, 'Sinn', 60);

	it('teilt Aufwand und Wert anteilig (nach share) auf die Säulen auf', () => {
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2),
			task(
				11,
				[
					{ pillarId: 1, share: 50, confidence: 100 },
					{ pillarId: 2, share: 50, confidence: 100 },
				],
				4,
			),
			task(12, [], 9),
		];
		const valueByTaskId = new Map([
			[10, 5],
			[11, 8],
		]);

		const summaries = buildPillarSummaries([koerper, sinn], tasks, valueByTaskId);

		// Körper: T10 voll (Aufwand 2, Wert 5) + T11 zur Hälfte (Aufwand 2, Wert 4) ⇒ 2 Tasks, 4, 9.
		// Sinn:   nur T11 zur Hälfte (Aufwand 2, Wert 4) ⇒ 1 Task, 2, 4.
		expect(summaries).toEqual([
			{ pillar: koerper, taskCount: 2, totalEstimatedEffort: 4, totalValue: 9 },
			{ pillar: sinn, taskCount: 1, totalEstimatedEffort: 2, totalValue: 4 },
		]);
	});

	it('wertet fehlende Wert-Einträge (z. B. erledigte Tasks) als 0', () => {
		const tasks = [task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2)];

		const summaries = buildPillarSummaries([koerper], tasks, new Map());

		expect(summaries[0]).toEqual({ pillar: koerper, taskCount: 1, totalEstimatedEffort: 2, totalValue: 0 });
	});

	it('liefert für eine Säule ohne Tasks Nullwerte und erhält die Reihenfolge', () => {
		const summaries = buildPillarSummaries([koerper, sinn], [], new Map());

		expect(summaries.map((summary) => summary.pillar.id)).toEqual([1, 2]);
		expect(summaries.every((summary) => summary.taskCount === 0 && summary.totalValue === 0)).toBe(true);
	});
});
