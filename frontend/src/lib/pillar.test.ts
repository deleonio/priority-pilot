import type { Pillar, PillarSuggestion, Task, TaskPillarContribution } from 'client';
import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import {
	ADD_PILLAR_PLACEHOLDER,
	addPillarOptions,
	buildPillarSummaries,
	calculateMeterThreshold,
	getTaskPillarPoints,
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

// --- #219: Meter zeigt Ist-Anteil erledigter Tasks statt Zielgewichtung ---

describe('#219 buildPillarSummaries — actualShare (Ist-Anteil erledigter Tasks)', () => {
	const pillarA = pillar(1, 'Körper', 40);
	const pillarB = pillar(2, 'Sinn', 60);

	it('AK1: berechnet den Ist-Anteil proportional zum doneEstimatedEffort je Säule', () => {
		// Säule A: doneEffort = 3, Säule B: doneEffort = 1 → A = 75 %, B = 25 %
		const tasks = [
			task(1, [{ pillarId: 1, share: 100, confidence: 100 }], 3, TaskStatus.Done),
			task(2, [{ pillarId: 2, share: 100, confidence: 100 }], 1, TaskStatus.Done),
		];

		const [summaryA, summaryB] = buildPillarSummaries([pillarA, pillarB], tasks, new Map());

		expect(summaryA.actualShare).toBeCloseTo(0.75, 10);
		expect(summaryB.actualShare).toBeCloseTo(0.25, 10);
	});

	it('AK2: liefert actualShare = 0 für alle Säulen, wenn keine Task erledigt ist (kein Division-by-Zero)', () => {
		const tasks = [
			task(1, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.Open),
			task(2, [{ pillarId: 2, share: 100, confidence: 100 }], 5, TaskStatus.InProcess),
		];

		const [summaryA, summaryB] = buildPillarSummaries([pillarA, pillarB], tasks, new Map());

		expect(summaryA.actualShare).toBe(0);
		expect(summaryB.actualShare).toBe(0);
		expect(Number.isNaN(summaryA.actualShare)).toBe(false);
		expect(Number.isNaN(summaryB.actualShare)).toBe(false);
	});

	it('AK2: liefert actualShare = 0, wenn überhaupt keine Tasks vorhanden sind', () => {
		const [summaryA, summaryB] = buildPillarSummaries([pillarA, pillarB], [], new Map());

		expect(summaryA.actualShare).toBe(0);
		expect(summaryB.actualShare).toBe(0);
	});

	it('AK4: actualShare liegt stets im Bereich [0, 1] bei beliebigen Aufwandswerten', () => {
		// Verschiedene Effort-Werte, gemischte Stati
		const tasks = [
			task(1, [{ pillarId: 1, share: 70, confidence: 100 }], 7, TaskStatus.Done),
			task(2, [{ pillarId: 2, share: 30, confidence: 100 }], 3, TaskStatus.Done),
			task(3, [{ pillarId: 1, share: 100, confidence: 100 }], 5, TaskStatus.Open),
			task(4, [{ pillarId: 2, share: 100, confidence: 100 }], 2, TaskStatus.InProcess),
		];

		const summaries = buildPillarSummaries([pillarA, pillarB], tasks, new Map());

		for (const summary of summaries) {
			expect(summary.actualShare).toBeGreaterThanOrEqual(0);
			expect(summary.actualShare).toBeLessThanOrEqual(1);
		}
	});

	it('AK4: Summe der actualShare-Werte ist ≤ 1 (bzw. = 1, wenn mindestens ein Done-Task existiert)', () => {
		const tasks = [
			task(1, [{ pillarId: 1, share: 60, confidence: 100 }], 6, TaskStatus.Done),
			task(2, [{ pillarId: 2, share: 40, confidence: 100 }], 4, TaskStatus.Done),
		];

		const summaries = buildPillarSummaries([pillarA, pillarB], tasks, new Map());
		const totalShare = summaries.reduce((acc, s) => acc + s.actualShare, 0);

		expect(totalShare).toBeCloseTo(1, 10);
	});
});

// --- #228 (AK-2): Punkte je Säule für einen einzelnen (erledigten) Task ---

describe('getTaskPillarPoints', () => {
	const koerper = pillar(1, 'Körper', 40);
	const sinn = pillar(2, 'Sinn', 60);
	const geist = pillar(3, 'Geist', 0);

	it('AK-2: verteilt estimatedEffort × share/100 je Säule (60/40 bei Aufwand 10 ⇒ Körper 6, Sinn 4)', () => {
		const t = task(
			10,
			[
				{ pillarId: 1, share: 60, confidence: 100 },
				{ pillarId: 2, share: 40, confidence: 100 },
			],
			10,
			TaskStatus.Done,
		);

		const points = getTaskPillarPoints(t, [koerper, sinn]);

		expect(points.get(koerper.id)).toBeCloseTo(6, 10);
		expect(points.get(sinn.id)).toBeCloseTo(4, 10);
	});

	it('AK-2: Leerfall — Task ohne pillars liefert für jede Säule 0 (kein NaN)', () => {
		const t = task(11, [], 10, TaskStatus.Done);

		const points = getTaskPillarPoints(t, [koerper, sinn]);

		expect(points.get(koerper.id)).toBe(0);
		expect(points.get(sinn.id)).toBe(0);
		expect(Number.isNaN(points.get(koerper.id))).toBe(false);
		expect(Number.isNaN(points.get(sinn.id))).toBe(false);
	});

	it('AK-2: Säule ohne Beitrag (share 0 oder gar nicht im Task) ergibt 0 (kein NaN)', () => {
		// Geist mit share 0 (im Task enthalten), Sinn gar nicht im Task → beide 0.
		const t = task(
			12,
			[
				{ pillarId: 1, share: 100, confidence: 100 },
				{ pillarId: 3, share: 0, confidence: 100 },
			],
			10,
			TaskStatus.Done,
		);

		const points = getTaskPillarPoints(t, [koerper, sinn, geist]);

		expect(points.get(koerper.id)).toBeCloseTo(10, 10);
		expect(points.get(geist.id)).toBe(0);
		expect(points.get(sinn.id)).toBe(0);
		expect(Number.isNaN(points.get(sinn.id))).toBe(false);
		expect(Number.isNaN(points.get(geist.id))).toBe(false);
	});

	it('AK-2: Summen-Check — Σ Säulenwerte = estimatedEffort × (Σ shares / 100)', () => {
		const t = task(
			13,
			[
				{ pillarId: 1, share: 30, confidence: 100 },
				{ pillarId: 2, share: 70, confidence: 100 },
			],
			8,
			TaskStatus.Done,
		);

		const points = getTaskPillarPoints(t, [koerper, sinn]);
		const total = [...points.values()].reduce((acc, value) => acc + value, 0);

		const shareSum = t.pillars.reduce((acc, entry) => acc + entry.share, 0);
		expect(total).toBeCloseTo(t.estimatedEffort * (shareSum / 100), 10);
		// Bei vollständiger 100 %-Verteilung entspricht die Summe genau dem Gesamtaufwand.
		expect(total).toBeCloseTo(8, 10);
	});
});

// --- #410: Säulen-Meter optimieren — Schwellwert 75% des Zielwerts ---

describe('#410 calculateMeterThreshold — Schwellwert für Säulen-Meter', () => {
	it('AK1: berechnet den Schwellwert als 75% des Zielwerts (Gewichtung)', () => {
		// Zielwert 20% → Schwellwert 15%
		expect(calculateMeterThreshold(20)).toBeCloseTo(0.15, 10);
		// Zielwert 25% → Schwellwert 18.75%
		expect(calculateMeterThreshold(25)).toBeCloseTo(0.1875, 10);
		// Zielwert 10% → Schwellwert 7.5%
		expect(calculateMeterThreshold(10)).toBeCloseTo(0.075, 10);
	});

	it('AK2: der Schwellwert ist immer 75% des Zielwerts, unabhängig von der Gewichtung', () => {
		// Verschiedene Zielwerte, alle mit demselben Faktor 0.75
		expect(calculateMeterThreshold(40)).toBeCloseTo(0.3, 10);
		expect(calculateMeterThreshold(60)).toBeCloseTo(0.45, 10);
		expect(calculateMeterThreshold(100)).toBeCloseTo(0.75, 10);
	});

	it('AK3: der Schwellwert wird als Dezimalbruch (0–1) zurückgegeben, nicht als Prozent', () => {
		// Zielwert 20% → Schwellwert 0.15 (nicht 15)
		const threshold = calculateMeterThreshold(20);
		expect(threshold).toBeGreaterThanOrEqual(0);
		expect(threshold).toBeLessThanOrEqual(1);
		expect(threshold).not.toBeGreaterThan(1);
	});

	it('AK4: der Schwellwert liegt immer im Bereich [0, 1]', () => {
		// Szenario: 5 Säulen mit je 20% Gewicht
		expect(calculateMeterThreshold(20)).toBeCloseTo(0.15, 10);
		// Szenario: 4 Säulen mit je 25% Gewicht
		expect(calculateMeterThreshold(25)).toBeCloseTo(0.1875, 10);
		// Szenario: 2 Säulen mit je 50% Gewicht
		expect(calculateMeterThreshold(50)).toBeCloseTo(0.375, 10);
	});

	it('AK5: Bei Zielwert 0% ist auch der Schwellwert 0%', () => {
		expect(calculateMeterThreshold(0)).toBe(0);
	});

	it('AK6: Rundungsgenauigkeit — der Schwellwert ist auf 10 Dezimalstellen genau', () => {
		// Zielwert 33.33% → Schwellwert 0.249975 (33.33 * 0.75 / 100)
		expect(calculateMeterThreshold(33.33)).toBeCloseTo(0.249975, 10);
		// Zielwert 16.67% → Schwellwert 0.125025 (16.67 * 0.75 / 100)
		expect(calculateMeterThreshold(16.67)).toBeCloseTo(0.125025, 10);
	});
});
