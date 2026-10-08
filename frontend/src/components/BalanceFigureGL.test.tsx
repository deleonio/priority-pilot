import { describe, expect, it } from 'vitest';
import { toSlots } from './BalanceFigureGL';
import { buildRays } from '../lib/balanceFigure';
import type { BalanceMetrics } from '../lib/balanceMetric';

/**
 * Die Brücke zwischen Rechnung und Shader: `toSlots` legt die Formen auf die acht Uniform-Plätze.
 * Zwei Dinge dürfen dabei nicht verrutschen — die Farbzuordnung (jede Säule bekommt ihren eigenen
 * Rang aus der Neon-Rampe, ab dem 8. Rang neutral) und die Reihenfolge: Slot 0 ist die **stärkste**
 * Säule. Kippte sie, stünde die schwächste Säule auf 12 Uhr — die Aussage des Bildes wäre die
 * umgekehrte.
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

const stateOf = (metrics: BalanceMetrics, figure: 'strahlen' | 'bluete' | 'kristall' | 'zeiger') => ({
	figure,
	metrics,
	activeTicks: 50,
	beatSeconds: 2,
});

describe('BalanceFigureGL toSlots', () => {
	it('gibt jeder Säule ihre Rampenfarbe und behält die Reihenfolge stärkste → schwächste', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const slots = toSlots(stateOf(metrics, 'strahlen'), colors);

		expect(slots.colors).toHaveLength(3);
		// Reihenfolge aus `buildRays`: Säule 2 (1.0), Säule 3 (0.6), Säule 1 (0.2).
		expect(slots.colors).toEqual([colors.pillars[1], colors.pillars[2], colors.pillars[0]]);
		expect(slots.rayLength[0]).toBeGreaterThan(slots.rayLength[2]);
	});

	it('übernimmt die Bewegung unverändert aus der Rechnung', () => {
		const metrics = metricsOf([0.4, 0.8]);
		const rays = buildRays(metrics);
		const slots = toSlots(stateOf(metrics, 'strahlen'), colors);

		slots.motions.forEach((motion, index) => {
			expect(motion.phase).toBe(rays[index].phase);
			expect(motion.swingPeriod).toBe(rays[index].swingPeriod);
			expect(motion.rotPeriod).toBe(rays[index].rotPeriod);
			expect(motion.rotDirection).toBe(rays[index].rotDirection);
		});
	});

	it('färbt ab dem 8. Rang neutral — wie das SVG, das dort nicht mehr einfärbt', () => {
		const slots = toSlots(stateOf(metricsOf(Array(8).fill(1)), 'strahlen'), colors);

		slots.colors.slice(0, 7).forEach((color, index) => expect(color).toEqual(colors.pillars[index]));
		expect(slots.colors[7]).toEqual(colors.neutral);
	});

	/*
	 * Mehr Säulen als Plätze: Abgeschnitten wird hinten, bei den schwächsten. Die stärksten tragen
	 * das Bild; fehlten sie, stünde es auf dem Kopf.
	 */
	it('behält bei mehr als acht Säulen die acht stärksten Formen', () => {
		const metrics = metricsOf([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
		const slots = toSlots(stateOf(metrics, 'strahlen'), colors);

		expect(slots.colors).toHaveLength(8);
		expect(slots.rayLength).toEqual(
			buildRays(metrics)
				.slice(0, 8)
				.map((ray) => ray.length),
		);
	});

	/* Blüte und Kristall teilen sich die Stützpunkte — nur das Material trennt sie. */
	it('belegt die Slots für Kristall genau wie für die Blüte', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const bluete = toSlots(stateOf(metrics, 'bluete'), colors);
		const kristall = toSlots(stateOf(metrics, 'kristall'), colors);

		expect(kristall.rayAngle).toEqual(bluete.rayAngle);
		expect(kristall.rayLength).toEqual(bluete.rayLength);
		expect(kristall.colors).toEqual(bluete.colors);
		expect(kristall.target).toBe(bluete.target);
	});

	/* Die Soll-Marke kommt in der Einheit der jeweiligen Figur — Lappen-Radius oder Länge. */
	it('liefert die Soll-Marke in der Einheit der jeweiligen Figur', () => {
		const metrics = metricsOf([2, 1]);

		// Strahlen: die Länge der Säule auf Ziel.
		const strahlen = toSlots(stateOf(metrics, 'strahlen'), colors);
		expect(strahlen.target).toBeCloseTo(strahlen.rayLength[1], 6);
		// Blüte und Kristall: der Radius der Lappenspitze auf Ziel.
		const bluete = toSlots(stateOf(metrics, 'bluete'), colors);
		expect(bluete.target).toBeCloseTo(bluete.rayLength[1], 6);
	});

	/* Zeiger belegen die Strahlen-Plätze — aber mit ihrer eigenen, schmaleren Geometrie. */
	it('belegt die Slots für Zeiger auf den Strahlen-Plätzen, schmaler als Strahlen', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const hands = toSlots(stateOf(metrics, 'zeiger'), colors);
		const rays = toSlots(stateOf(metrics, 'strahlen'), colors);
		// Winkel wie die Strahlen, Länge und Öffnung aber aus der eigenen Geometrie.
		expect(hands.rayAngle).toEqual(rays.rayAngle);
		expect(hands.rayLength[0]).toBeGreaterThan(hands.rayLength[2]);
		expect(hands.raySpread[0]).toBeLessThan(rays.raySpread[0]);
	});
});
