import type { Pillar, PillarSuggestion, Task, TaskPillarContribution } from 'client';
import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import {
	ADD_PILLAR_PLACEHOLDER,
	addPillarOptions,
	buildPillarSummaries,
	isRawDistributionValid,
	isWeightSumValid,
	normalizeToTotalWeight,
	suggestionsToContributions,
	sumWeights,
	weightToRaw,
} from './pillar';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

const task = (
	id: number,
	pillars: TaskPillarContribution[],
	estimatedEffort: number,
	status: Task['status'] = TaskStatus.Open,
): Task => ({
	id,
	title: `T${id}`,
	status,
	priority: 3,
	estimatedEffort,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
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

describe('weightToRaw', () => {
	it('rechnet den gespeicherten Prozentwert (0–100) auf den Rohwert (0,0–1,0) zurück', () => {
		expect(weightToRaw(20)).toBe(0.2);
		expect(weightToRaw(100)).toBe(1);
		expect(weightToRaw(0)).toBe(0);
	});
});

describe('normalizeToTotalWeight', () => {
	it('normiert gleiche Rohwerte auf eine Gleichverteilung (5 × 1 ⇒ je 20 %)', () => {
		const result = normalizeToTotalWeight([1, 1, 1, 1, 1]);
		expect(result).toEqual([20, 20, 20, 20, 20]);
		expect(isWeightSumValid(sumWeights(result))).toBe(true);
	});

	it('ist skaleninvariant: 5 × 0,1 ergibt dieselbe Verteilung wie 5 × 1', () => {
		expect(normalizeToTotalWeight([0.1, 0.1, 0.1, 0.1, 0.1])).toEqual(normalizeToTotalWeight([1, 1, 1, 1, 1]));
	});

	it('verteilt gemischte Rohwerte proportional und ergibt in Summe 100 %', () => {
		// 2 × 0,5 + 3 × 1 ⇒ Σroh = 4 ⇒ 12,5 / 12,5 / 25 / 25 / 25.
		const result = normalizeToTotalWeight([0.5, 0.5, 1, 1, 1]);
		expect(result).toEqual([12.5, 12.5, 25, 25, 25]);
		expect(isWeightSumValid(sumWeights(result))).toBe(true);
	});

	it('normiert einen einzelnen positiven Wert auf 100 %', () => {
		expect(normalizeToTotalWeight([0.3])).toEqual([100]);
	});
});

describe('isRawDistributionValid', () => {
	it('akzeptiert eine Verteilung mit mindestens einem Wert > 0', () => {
		expect(isRawDistributionValid([0, 0.5, 1])).toBe(true);
	});

	it('lehnt eine reine Null-Verteilung ab (nicht auf 100 % normierbar)', () => {
		expect(isRawDistributionValid([0, 0, 0])).toBe(false);
		expect(isRawDistributionValid([])).toBe(false);
	});

	it('lehnt fehlende oder negative Werte ab', () => {
		expect(isRawDistributionValid([0.5, null])).toBe(false);
		expect(isRawDistributionValid([0.5, -0.1])).toBe(false);
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

	it('verteilt den Rundungsrest (Largest Remainder), sodass die Summe exakt 100 % bleibt', () => {
		const result = suggestionsToContributions([suggestion(1, 33), suggestion(2, 33), suggestion(3, 33)], validIds);
		expect(sumWeights(result.map((entry) => entry.share))).toBe(100);
		expect(isWeightSumValid(sumWeights(result.map((entry) => entry.share)))).toBe(true);
	});

	it('erzeugt nie einen negativen Anteil, wenn mehrere Anteile aufrunden (Hamilton statt „Rest auf letzte")', () => {
		// Regression: naives „runden + Rest auf die letzte Säule" ergäbe hier für die letzte Säule
		// 100 − 101 = −1. Largest-Remainder hält jeden Anteil ≥ 0 bei exakt 100 % Summe.
		const ids = new Set([1, 2, 3, 4, 5]);
		const result = suggestionsToContributions(
			[suggestion(1, 24.5), suggestion(2, 24.5), suggestion(3, 24.5), suggestion(4, 25.5), suggestion(5, 1)],
			ids,
		);
		expect(result.every((entry) => entry.share >= 0)).toBe(true);
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
		// `toMatchObject` statt `toEqual`, da die Status-Aufschlüsselung (#124) zusätzliche Felder ergänzt.
		expect(summaries).toMatchObject([
			{ pillar: koerper, taskCount: 2, totalEstimatedEffort: 4, totalValue: 9 },
			{ pillar: sinn, taskCount: 1, totalEstimatedEffort: 2, totalValue: 4 },
		]);
	});

	it('wertet fehlende Wert-Einträge (z. B. erledigte Tasks) als 0', () => {
		const tasks = [task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2)];

		const summaries = buildPillarSummaries([koerper], tasks, new Map());

		expect(summaries[0]).toMatchObject({ pillar: koerper, taskCount: 1, totalEstimatedEffort: 2, totalValue: 0 });
	});

	it('liefert für eine Säule ohne Tasks Nullwerte und erhält die Reihenfolge', () => {
		const summaries = buildPillarSummaries([koerper, sinn], [], new Map());

		expect(summaries.map((summary) => summary.pillar.id)).toEqual([1, 2]);
		expect(summaries.every((summary) => summary.taskCount === 0 && summary.totalValue === 0)).toBe(true);
	});

	// --- Status-Aufschlüsselung erledigt/offen je Säule (#124) ---

	it('AK1: trennt die Aufgabenzahl je Säule nach offen (Open/In process) und erledigt (Done)', () => {
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.Open),
			task(11, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.InProcess),
			task(12, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.Done),
		];

		const [summary] = buildPillarSummaries([koerper], tasks, new Map());

		// 2 offen (Open + In process), 1 erledigt (Done).
		expect(summary.openCount).toBe(2);
		expect(summary.doneCount).toBe(1);
	});

	it('AK2: ordnet den anteiligen (share) Aufwand eines Done-Tasks dem erledigt-Aufwand zu, nicht dem offenen', () => {
		// share 50 % auf Körper, Status Done, Aufwand 4 ⇒ erledigt-Aufwand 2, offen-Aufwand 0.
		const tasks = [
			task(
				10,
				[
					{ pillarId: 1, share: 50, confidence: 100 },
					{ pillarId: 2, share: 50, confidence: 100 },
				],
				4,
				TaskStatus.Done,
			),
		];

		const [koerperSummary] = buildPillarSummaries([koerper], tasks, new Map());

		expect(koerperSummary.doneEstimatedEffort).toBe(2);
		expect(koerperSummary.openEstimatedEffort).toBe(0);
	});

	it('AK3: Summenkonsistenz — offen + erledigt ergibt je Säule wieder Anzahl bzw. Gesamtaufwand', () => {
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.Open),
			task(
				11,
				[
					{ pillarId: 1, share: 50, confidence: 100 },
					{ pillarId: 2, share: 50, confidence: 100 },
				],
				3,
				TaskStatus.Done,
			),
			task(12, [{ pillarId: 2, share: 100, confidence: 100 }], 5, TaskStatus.InProcess),
		];

		const summaries = buildPillarSummaries([koerper, sinn], tasks, new Map());

		for (const summary of summaries) {
			expect(summary.openCount + summary.doneCount).toBe(summary.taskCount);
			expect(summary.openEstimatedEffort + summary.doneEstimatedEffort).toBeCloseTo(summary.totalEstimatedEffort, 6);
		}
	});

	it('AK5: Leerfall — eine Säule ohne einzahlende Tasks weist offen=0 und erledigt=0 aus (kein NaN)', () => {
		const [summary] = buildPillarSummaries([koerper], [], new Map());

		expect(summary.openCount).toBe(0);
		expect(summary.doneCount).toBe(0);
		expect(summary.openEstimatedEffort).toBe(0);
		expect(summary.doneEstimatedEffort).toBe(0);
		expect(Number.isNaN(summary.openEstimatedEffort)).toBe(false);
		expect(Number.isNaN(summary.doneEstimatedEffort)).toBe(false);
	});
});
