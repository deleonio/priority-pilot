import { describe, expect, it } from 'vitest';
import { toSlots } from './BalanceFigureGL';
import { buildOrbs } from '../lib/balanceFigure';
import type { BalanceMetrics } from '../lib/balanceMetric';

/**
 * Die Brücke zwischen Rechnung und Shader: `toSlots` legt die Formen auf die acht Uniform-Plätze.
 * Zwei Dinge dürfen dabei nicht verrutschen — die Farbzuordnung (jede Säule bekommt ihren eigenen
 * Rang aus der Neon-Rampe, ab dem 8. Rang neutral) und die Reihenfolge: Slot 0 ist die **stärkste**
 * Säule. Kippte sie, läge bei den Blasen die stärkste Säule vorn und verdeckte alle anderen — die
 * Aussage des Bildes wäre die umgekehrte.
 *
 * Kein Render-Test: WebGL gibt es in jsdom nicht, die Bühne zeigt dort das SVG (siehe
 * `HeartBalance.test.tsx`).
 */

/** ThemeColors strukturell: 7 Rampenfarben, 5 Ring-Stützstellen, Kartenfarbe und Neutralfarbe. */
const colors = {
	pillars: Array.from({ length: 7 }, (_, i): [number, number, number] => [i / 7, 0.5, 1 - i / 7]),
	ring: Array.from({ length: 5 }, (_, i): [number, number, number] => [i / 5, 0, 0]),
	surface: [1, 1, 1] as [number, number, number],
	neutral: [0.1, 0.1, 0.1] as [number, number, number],
};

/** Kennzahlen von Hand, ohne den Umweg über `buildHeartBalance`. */
const metricsOf = (ratios: number[]): BalanceMetrics => {
	const scale = Math.max(1, ...ratios);
	return {
		pillars: ratios.map((ratio, index) => ({
			pillarId: index + 1,
			colorIndex: index,
			ratio,
			scaled: ratio / scale,
		})),
		targetMark: 1 / scale,
		scale,
	};
};

const stateOf = (metrics: BalanceMetrics, figure: 'blasen' | 'ringe' | 'strahlen') => ({
	figure,
	metrics,
	activeTicks: 50,
	beatSeconds: 2,
});

describe('BalanceFigureGL toSlots', () => {
	it('gibt jeder Säule ihre Rampenfarbe und behält die Reihenfolge stärkste → schwächste', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const slots = toSlots(stateOf(metrics, 'blasen'), colors);

		expect(slots.colors).toHaveLength(3);
		// Reihenfolge aus `buildOrbs`: Säule 2 (1.0), Säule 3 (0.6), Säule 1 (0.2).
		expect(slots.colors).toEqual([colors.pillars[1], colors.pillars[2], colors.pillars[0]]);
		expect(slots.orbRadius[0]).toBeGreaterThan(slots.orbRadius[2]);
	});

	it('übernimmt die Bewegung unverändert aus der Rechnung', () => {
		const metrics = metricsOf([0.4, 0.8]);
		const orbs = buildOrbs(metrics);
		const slots = toSlots(stateOf(metrics, 'blasen'), colors);

		slots.motions.forEach((motion, index) => {
			expect(motion.phase).toBe(orbs[index].phase);
			expect(motion.swingPeriod).toBe(orbs[index].swingPeriod);
			expect(motion.rotPeriod).toBe(orbs[index].rotPeriod);
			expect(motion.rotDirection).toBe(orbs[index].rotDirection);
		});
	});

	it('färbt ab dem 8. Rang neutral — wie das SVG, das dort nicht mehr einfärbt', () => {
		const slots = toSlots(stateOf(metricsOf(Array(8).fill(1)), 'blasen'), colors);

		slots.colors.slice(0, 7).forEach((color, index) => expect(color).toEqual(colors.pillars[index]));
		expect(slots.colors[7]).toEqual(colors.neutral);
	});

	/*
	 * Mehr Säulen als Plätze: Abgeschnitten wird hinten, bei den schwächsten. Die stärksten tragen
	 * das Bild; fehlten sie, stünde es auf dem Kopf.
	 */
	it('behält bei mehr als acht Säulen die acht stärksten Formen', () => {
		const metrics = metricsOf([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
		const slots = toSlots(stateOf(metrics, 'blasen'), colors);

		expect(slots.colors).toHaveLength(8);
		expect(slots.orbRadius).toEqual(
			buildOrbs(metrics)
				.slice(0, 8)
				.map((orb) => orb.radius),
		);
	});

	it('füllt je Figur nur deren eigene Felder', () => {
		const metrics = metricsOf([1, 0.5]);

		const blasen = toSlots(stateOf(metrics, 'blasen'), colors);
		expect(blasen.orbRadius).toHaveLength(2);
		expect(blasen.arcRadius).toHaveLength(0);
		expect(blasen.rayLength).toHaveLength(0);

		const ringe = toSlots(stateOf(metrics, 'ringe'), colors);
		expect(ringe.arcSweep).toEqual([1, 0.5]);
		expect(ringe.orbRadius).toHaveLength(0);

		const strahlen = toSlots(stateOf(metrics, 'strahlen'), colors);
		expect(strahlen.rayAngle[0]).toBe(-90);
		expect(strahlen.arcRadius).toHaveLength(0);
	});

	/* Die Soll-Marke kommt in der Einheit der jeweiligen Figur — Radius, Bogenanteil oder Länge. */
	it('liefert die Soll-Marke in der Einheit der jeweiligen Figur', () => {
		const metrics = metricsOf([2, 1]);

		// Blasen: der Radius, den die Säule auf Ziel hat.
		expect(toSlots(stateOf(metrics, 'blasen'), colors).target).toBeCloseTo(
			toSlots(stateOf(metrics, 'blasen'), colors).orbRadius[1],
			6,
		);
		// Ringe: der Bogenanteil (0,5 bei Skala 2).
		expect(toSlots(stateOf(metrics, 'ringe'), colors).target).toBeCloseTo(0.5, 6);
		// Strahlen: die Länge der Säule auf Ziel.
		const strahlen = toSlots(stateOf(metrics, 'strahlen'), colors);
		expect(strahlen.target).toBeCloseTo(strahlen.rayLength[1], 6);
	});
});
