import type { Pillar } from 'client';
import { describe, expect, it } from 'vitest';
import { balanceMetrics } from './balanceMetric';
import { buildHeartBalance } from './heartBalance';

/**
 * Die Kennzahl, die alle Bilder zeichnen. Geprüft wird vor allem das, was sie von `level`
 * unterscheidet: Sie ist **nicht** bei 1 gedeckelt. Wer sein Ziel überschreitet, muss im Bild
 * größer werden als wer es genau trifft — sonst sähe „zieht alles an sich" aus wie „passt".
 */

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

/** Kürzel: Säulen mit Gewicht, Punkte je Säule → Kennzahlen. */
const metricsOf = (weights: number[], points: number[]) =>
	balanceMetrics(
		buildHeartBalance(
			weights.map((weight, index) => pillar(index + 1, `Säule ${index + 1}`, weight)),
			new Map(points.map((value, index) => [index + 1, value])),
		),
	);

describe('balanceMetrics', () => {
	it('gibt je Säule das Verhältnis Ist zu Soll', () => {
		// Soll je 20 %, Ist 10/20/30/20/20 % → Verhältnisse 0,5 / 1 / 1,5 / 1 / 1.
		const metrics = metricsOf([20, 20, 20, 20, 20], [10, 20, 30, 20, 20]);

		expect(metrics.pillars.map((p) => Number(p.ratio.toFixed(3)))).toEqual([0.5, 1, 1.5, 1, 1]);
	});

	it('deckelt nicht bei 1 — wer sein Ziel überschreitet, wird größer', () => {
		const metrics = metricsOf([50, 50], [9, 1]);

		// Ist 90/10 gegen Soll 50/50 → 1,8 und 0,2.
		expect(metrics.pillars[0].ratio).toBeCloseTo(1.8, 6);
		expect(metrics.pillars[1].ratio).toBeCloseTo(0.2, 6);
		expect(metrics.pillars[0].scaled).toBeCloseTo(1, 6);
	});

	it('normiert auf den größten vorkommenden Wert', () => {
		const metrics = metricsOf([50, 50], [9, 1]);

		expect(metrics.scale).toBeCloseTo(1.8, 6);
		expect(metrics.pillars.map((p) => p.scaled)).toEqual(metrics.pillars.map((p) => p.ratio / 1.8));
	});

	/*
	 * Der Boden der Skala ist die 1. Ohne ihn wanderte die Soll-Marke an den Rand, sobald alle Säulen
	 * unter ihrem Ziel liegen — „alle zu kurz" sähe dann aus wie „alle auf Ziel".
	 */
	it('lässt die Skala nicht unter das Soll fallen', () => {
		// Zwei Säulen mit Ziel, alle Punkte in einer dritten ohne Ziel → beide Verhältnisse 0.
		const metrics = balanceMetrics(
			buildHeartBalance(
				[pillar(1, 'Körper', 50), pillar(2, 'Geist', 50), pillar(3, 'Ohne Ziel', 0)],
				new Map([[3, 10]]),
			),
		);

		expect(metrics.scale).toBe(1);
		expect(metrics.targetMark).toBe(1);
		expect(metrics.pillars.map((p) => p.ratio)).toEqual([0, 0, 0]);
	});

	it('setzt die Soll-Marke dorthin, wo ein Verhältnis von 1 läge', () => {
		const metrics = metricsOf([50, 50], [9, 1]);

		expect(metrics.targetMark).toBeCloseTo(1 / 1.8, 6);
		// Die Säule auf Soll läge genau auf der Marke.
		const aufSoll = metricsOf([50, 50], [5, 5]);
		expect(aufSoll.pillars[0].scaled).toBeCloseTo(aufSoll.targetMark, 6);
	});

	/* `POST /pillars` legt jede Säule mit `weight: 0` an — der Normalfall, nicht die Ausnahme. */
	it('gibt einer Säule ohne Ziel das Verhältnis 0, nicht Unendlich', () => {
		const metrics = balanceMetrics(
			buildHeartBalance([pillar(1, 'Körper', 50), pillar(2, 'Frisch angelegt', 0)], new Map([[2, 10]])),
		);

		expect(metrics.pillars[1].ratio).toBe(0);
		expect(Number.isFinite(metrics.scale)).toBe(true);
	});

	it('übernimmt Reihenfolge und Farbrang der Säulen unverändert', () => {
		const metrics = metricsOf([20, 20, 20], [1, 1, 1]);

		expect(metrics.pillars.map((p) => p.pillarId)).toEqual([1, 2, 3]);
		expect(metrics.pillars.map((p) => p.colorIndex)).toEqual([0, 1, 2]);
	});
});
