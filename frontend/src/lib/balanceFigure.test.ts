import { describe, expect, it } from 'vitest';
import {
	activeTicks,
	buildHands,
	buildPetals,
	buildRays,
	CENTER,
	FIGURE_MAX,
	petalRadiusAt,
	RING_INNER,
	R_MIN,
	ringTicks,
	targetRadius,
	tickLine,
	TICK_COUNT,
} from './balanceFigure';
import type { BalanceMetrics } from './balanceMetric';

/**
 * Die Geometrie der Figuren und des gemeinsamen Zifferblatts.
 *
 * Der rote Faden dieser Datei: Alle Figuren bekommen **dieselben** Werte und müssen daraus
 * dieselbe Ordnung bauen — stärkste Säule zuerst. Und keine von ihnen darf ins Zifferblatt laufen.
 */

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

describe('Ordnung über alle Figuren', () => {
	const metrics = metricsOf([0.4, 1.6, 1.0]);

	it('ordnet Strahlen, Lappen und Zeiger nach derselben Regel: stärkste Säule zuerst', () => {
		const erwartet = [2, 3, 1];
		expect(buildRays(metrics).map((ray) => ray.pillarId)).toEqual(erwartet);
		expect(buildPetals(metrics).map((petal) => petal.pillarId)).toEqual(erwartet);
		expect(buildHands(metrics).map((hand) => hand.pillarId)).toEqual(erwartet);
	});

	it('gibt derselben Säule in jeder Figur dieselbe Bewegung', () => {
		const ray = buildRays(metrics)[0];
		const petal = buildPetals(metrics)[0];
		const hand = buildHands(metrics)[0];

		for (const key of ['phase', 'swingPeriod', 'rotPeriod', 'rotDirection'] as const) {
			expect(petal[key]).toBe(ray[key]);
			expect(hand[key]).toBe(ray[key]);
		}
	});

	it('ordnet bei Gleichstand nach Säulen-id — die Reihenfolge der Eingabe darf nichts ändern', () => {
		const gleich = metricsOf([1, 1, 1]);
		const gedreht: BalanceMetrics = { ...gleich, pillars: [...gleich.pillars].reverse() };

		expect(buildRays(gleich).map((ray) => ray.pillarId)).toEqual([1, 2, 3]);
		expect(buildRays(gedreht).map((ray) => ray.pillarId)).toEqual([1, 2, 3]);
	});

	/*
	 * Keine Figur darf ins Zifferblatt laufen — sonst schiebt sich Farbe unter die Skala und beide
	 * Aussagen vermischen sich.
	 */
	it('hält jede Figur innerhalb des Zifferblatts', () => {
		const voll = metricsOf([1]);
		expect(FIGURE_MAX).toBeLessThan(RING_INNER);

		for (const ray of buildRays(voll)) expect(ray.length).toBeLessThanOrEqual(FIGURE_MAX);
		for (const petal of buildPetals(voll)) expect(petal.radius).toBeLessThanOrEqual(FIGURE_MAX);
		for (const hand of buildHands(voll)) expect(hand.length).toBeLessThanOrEqual(FIGURE_MAX);
	});

	/*
	 * `POST /pillars` legt jede neue Säule mit `weight: 0` an — ihr Verhältnis ist dauerhaft 0. Sie
	 * muss trotzdem im Bild stehen, sonst verschwände eine gepflegte Säule spurlos.
	 */
	it('gibt einer Säule ohne Ziel die kleinste Form, nicht gar keine', () => {
		const leer = metricsOf([0, 0]);

		for (const ray of buildRays(leer)) expect(ray.length).toBeGreaterThan(0);
		for (const petal of buildPetals(leer)) expect(petal.radius).toBe(R_MIN);
		for (const hand of buildHands(leer)) expect(hand.length).toBe(R_MIN);
	});
});

describe('Die Soll-Marke', () => {
	it('liegt bei den Strahlen auf der Länge, die eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const rays = buildRays(metrics);
		const aufZiel = rays.find((ray) => ray.pillarId === 2);

		expect(rays[0].targetLength).toBeCloseTo(aufZiel?.length ?? -1, 6);
	});

	it('liegt bei Blüte und Kristall auf dem Radius, die eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const petals = buildPetals(metrics);
		const aufZiel = petals.find((petal) => petal.pillarId === 2);

		expect(targetRadius(metrics)).toBeCloseTo(aufZiel?.radius ?? -1, 6);
	});

	it('liegt bei den Zeigern auf der Länge, die eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const hands = buildHands(metrics);
		const aufZiel = hands.find((hand) => hand.pillarId === 2);

		expect(hands[0].targetLength).toBeCloseTo(aufZiel?.length ?? -1, 6);
	});
});

describe('Figur „Strahlen"', () => {
	it('stellt den längsten Strahl auf 12 Uhr und verteilt den Rest gleichmäßig', () => {
		const rays = buildRays(metricsOf([0.4, 1.6, 1.0]));

		expect(rays[0].angle).toBe(-90);
		expect(rays[1].angle).toBeCloseTo(-90 + 120, 6);
		expect(rays[2].angle).toBeCloseTo(-90 + 240, 6);
		expect(rays[0].length).toBeGreaterThan(rays[2].length);
	});

	it('hält die Strahlen schmaler als ihren Winkelabstand — sie dürfen sich nicht berühren', () => {
		const rays = buildRays(metricsOf([1, 1, 1, 1]));
		const step = 360 / rays.length;

		for (const ray of rays) expect(ray.spread * 2).toBeLessThan(step);
	});
});

describe('Figuren „Blüte" und „Kristall"', () => {
	it('stellt den weitesten Lappen auf 12 Uhr und verteilt den Rest gleichmäßig', () => {
		const petals = buildPetals(metricsOf([0.4, 1.6, 1.0]));

		expect(petals[0].angle).toBe(-90);
		expect(petals[1].angle).toBeCloseTo(-90 + 120, 6);
		expect(petals[2].angle).toBeCloseTo(-90 + 240, 6);
		expect(petals[0].radius).toBeGreaterThan(petals[2].radius);
	});

	/*
	 * Die Kontur muss die Spitze jeder Säule exakt treffen — nur dann ist der Abstand der Spitze vom
	 * Mittelpunkt wirklich der Wert, in beiden Materialien.
	 */
	it('trifft die Lappenspitzen exakt — weich wie kantig', () => {
		const petals = buildPetals(metricsOf([0.4, 1.6, 1.0]));

		for (const petal of petals) {
			expect(petalRadiusAt(petals, petal.angle, true)).toBeCloseTo(petal.radius, 6);
			expect(petalRadiusAt(petals, petal.angle, false)).toBeCloseTo(petal.radius, 6);
		}
	});

	it('bleibt zwischen zwei Stützpunkten innerhalb ihrer Radien — Blüte weicher als Kristall', () => {
		const petals = buildPetals(metricsOf([0.4, 1.6]));
		const zwischen = -90 + 45; // Ein Viertel des Abstands hinter dem ersten Stützpunkt.
		const tief = Math.min(...petals.map((petal) => petal.radius));
		const hoch = Math.max(...petals.map((petal) => petal.radius));
		const weich = petalRadiusAt(petals, zwischen, true);
		const kantig = petalRadiusAt(petals, zwischen, false);

		expect(weich).toBeGreaterThanOrEqual(tief);
		expect(weich).toBeLessThanOrEqual(hoch);
		// Kristall mischt linear (ein Viertel des Wegs zum Nachbarn), die Blüte schiebt die Mischung zur Spitze.
		expect(kantig).toBeCloseTo(0.75 * hoch + 0.25 * tief, 6);
		expect(weich).toBeGreaterThan(kantig);
	});

	/* Im Gleichstand ist die Silhouette ein Kreis — die Bewegung hält die Lappen trotzdem auseinander. */
	it('gibt gleich großen Lappen paarweise verschiedene Bewegung (Gleichstand)', () => {
		const petals = buildPetals(metricsOf([1, 1, 1, 1, 1]));

		expect(new Set(petals.map((petal) => petal.radius)).size).toBe(1);
		expect(new Set(petals.map((petal) => petal.phase)).size).toBe(petals.length);
		expect(new Set(petals.map((petal) => petal.swingPeriod)).size).toBe(petals.length);
	});
});

describe('Figur „Zeiger“', () => {
	it('stellt den längsten Zeiger auf 12 Uhr und verteilt den Rest gleichmäßig', () => {
		const hands = buildHands(metricsOf([0.4, 1.6, 1.0]));

		expect(hands[0].angle).toBe(-90);
		expect(hands[1].angle).toBeCloseTo(-90 + 120, 6);
		expect(hands[2].angle).toBeCloseTo(-90 + 240, 6);
		expect(hands[0].length).toBeGreaterThan(hands[2].length);
	});

	it('hält die Zeiger schmaler als die Strahlen — die Skala bleibt lesbar', () => {
		const metrics = metricsOf([1, 1, 1, 1]);
		const hands = buildHands(metrics);
		const step = 360 / hands.length;

		expect(hands[0].spread).toBeLessThan(buildRays(metrics)[0].spread);
		for (const hand of hands) expect(hand.spread * 2).toBeLessThan(step);
	});
});

describe('ringTicks — das Zifferblatt', () => {
	it('hat immer 100 Striche, einen je Prozentpunkt', () => {
		expect(ringTicks(0)).toHaveLength(TICK_COUNT);
		expect(ringTicks(0.5)).toHaveLength(TICK_COUNT);
		expect(ringTicks(1)).toHaveLength(TICK_COUNT);
	});

	it('leuchtet genau so weit, wie die Prozentzahl unter dem Bild sagt', () => {
		for (const fill of [0, 0.01, 0.374, 0.5, 0.996, 1]) {
			const lit = ringTicks(fill).filter((tick) => tick.active).length;
			expect(lit).toBe(Math.round(fill * 100));
			expect(lit).toBe(activeTicks(fill));
		}
	});

	it('lässt bei leerem Bild keinen und bei voller Balance jeden Strich leuchten', () => {
		expect(ringTicks(0).some((tick) => tick.active)).toBe(false);
		expect(ringTicks(1).every((tick) => tick.active)).toBe(true);
	});

	it('beginnt bei 12 Uhr und läuft einmal im Uhrzeigersinn herum', () => {
		const ticks = ringTicks(1);
		expect(ticks[0].angle).toBe(-90);
		expect(ticks[25].angle).toBe(0);
		expect(ticks[99].angle).toBeCloseTo(266.4, 6);

		// 12 Uhr: senkrecht über der Mitte (y kleiner als der Mittelpunkt, x auf ihm).
		const zwölf = tickLine(ticks[0]);
		expect(zwölf.x1).toBeCloseTo(CENTER, 6);
		expect(zwölf.y1).toBeLessThan(CENTER);
		// Ein Viertel weiter: rechts von der Mitte — also im Uhrzeigersinn.
		expect(tickLine(ticks[25]).x1).toBeGreaterThan(CENTER);
	});

	it('markiert jeden zehnten Strich als Zehner-Marke und hält alle Striche in der Zeichenfläche', () => {
		const ticks = ringTicks(0.5);
		expect(ticks.filter((tick) => tick.major)).toHaveLength(10);

		for (const tick of ticks) {
			const { x2, y2 } = tickLine(tick);
			expect(Math.hypot(x2 - CENTER, y2 - CENTER)).toBeLessThan(CENTER);
		}
	});

	/* Die Farbrampe wird nicht als fertiger Wert geliefert, sondern als Stützstelle plus Mischanteil
	 * — die Zuordnung muss trotzdem an beiden Enden exakt auf einer Stützstelle liegen. */
	it('beginnt auf der ersten und endet auf der letzten Stützstelle der Farbrampe', () => {
		const ticks = ringTicks(1);
		expect(ticks[0]).toMatchObject({ stop: 0, mix: 0 });
		expect(ticks[99].stop).toBe(75);
		expect(ticks[99].mix).toBeCloseTo(1, 6);

		for (const tick of ticks) {
			expect([0, 25, 50, 75]).toContain(tick.stop);
			expect(tick.mix).toBeGreaterThanOrEqual(0);
			expect(tick.mix).toBeLessThanOrEqual(1);
		}
	});
});
