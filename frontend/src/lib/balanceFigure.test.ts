import { describe, expect, it } from 'vitest';
import {
	activeTicks,
	buildArcs,
	buildOrbs,
	buildRays,
	CENTER,
	FIGURE_MAX,
	orbAxes,
	RING_INNER,
	R_MIN,
	ringTicks,
	SWING,
	targetRadius,
	tickLine,
	TICK_COUNT,
} from './balanceFigure';
import type { BalanceMetrics } from './balanceMetric';

/**
 * Die Geometrie der drei Figuren und des gemeinsamen Zifferblatts.
 *
 * Der rote Faden dieser Datei: Alle drei Figuren bekommen **dieselben** Werte und müssen daraus
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

	it('ordnet Blasen, Ringe und Strahlen nach derselben Regel: stärkste Säule zuerst', () => {
		const erwartet = [2, 3, 1];
		expect(buildOrbs(metrics).map((orb) => orb.pillarId)).toEqual(erwartet);
		expect(buildArcs(metrics).map((arc) => arc.pillarId)).toEqual(erwartet);
		expect(buildRays(metrics).map((ray) => ray.pillarId)).toEqual(erwartet);
	});

	it('gibt derselben Säule in jeder Figur dieselbe Bewegung', () => {
		const orb = buildOrbs(metrics)[0];
		const arc = buildArcs(metrics)[0];
		const ray = buildRays(metrics)[0];

		for (const key of ['phase', 'swingPeriod', 'rotPeriod', 'rotDirection'] as const) {
			expect(arc[key]).toBe(orb[key]);
			expect(ray[key]).toBe(orb[key]);
		}
	});

	it('ordnet bei Gleichstand nach Säulen-id — die Reihenfolge der Eingabe darf nichts ändern', () => {
		const gleich = metricsOf([1, 1, 1]);
		const gedreht: BalanceMetrics = { ...gleich, pillars: [...gleich.pillars].reverse() };

		expect(buildOrbs(gleich).map((orb) => orb.pillarId)).toEqual([1, 2, 3]);
		expect(buildOrbs(gedreht).map((orb) => orb.pillarId)).toEqual([1, 2, 3]);
	});

	/*
	 * Der Kern des Entwurfs: Liegen alle Säulen gleich, sind alle Formen gleich groß. Ohne
	 * unterschiedliche Bewegung lägen die Blasen deckungsgleich übereinander und der Gleichstand
	 * zeigte eine einzige Blase.
	 */
	it('bewegt gleich große Formen paarweise verschieden (Gleichstand)', () => {
		const orbs = buildOrbs(metricsOf([1, 1, 1, 1, 1]));

		expect(new Set(orbs.map((orb) => orb.radius)).size).toBe(1);
		expect(new Set(orbs.map((orb) => orb.phase)).size).toBe(orbs.length);
		expect(new Set(orbs.map((orb) => orb.swingPeriod)).size).toBe(orbs.length);
		const axes = orbs.map((orb) => orbAxes(orb, orb.radius, 0).rx.toFixed(4));
		expect(new Set(axes).size).toBe(orbs.length);
	});

	/*
	 * Keine Figur darf ins Zifferblatt laufen — sonst schiebt sich Farbe unter die Skala und beide
	 * Aussagen vermischen sich. Für die Blasen gilt das inklusive Schwingungsscheitel.
	 */
	it('hält jede Figur samt Schwingung innerhalb des Zifferblatts', () => {
		const voll = metricsOf([1]);
		expect(FIGURE_MAX * (1 + SWING)).toBeLessThan(RING_INNER);

		for (const arc of buildArcs(voll)) expect(arc.radius + arc.width / 2).toBeLessThanOrEqual(FIGURE_MAX);
		for (const ray of buildRays(voll)) expect(ray.length).toBeLessThanOrEqual(FIGURE_MAX);
		for (const orb of buildOrbs(voll)) expect(orb.radius).toBeLessThanOrEqual(FIGURE_MAX);
	});

	/*
	 * `POST /pillars` legt jede neue Säule mit `weight: 0` an — ihr Verhältnis ist dauerhaft 0. Sie
	 * muss trotzdem im Bild stehen, sonst verschwände eine gepflegte Säule spurlos.
	 */
	it('gibt einer Säule ohne Ziel die kleinste Form, nicht gar keine', () => {
		const leer = metricsOf([0, 0]);

		for (const orb of buildOrbs(leer)) expect(orb.radius).toBe(R_MIN);
		for (const ray of buildRays(leer)) expect(ray.length).toBeGreaterThan(0);
		for (const arc of buildArcs(leer)) expect(arc.width).toBeGreaterThan(0);
	});

	it('schwingt gegenläufig — die Fläche atmet, sie wächst nicht', () => {
		const [orb] = buildOrbs(metricsOf([1]));
		const viertel = orb.swingPeriod / 4;

		for (const time of [0, viertel, 2 * viertel, 3 * viertel]) {
			const { rx, ry } = orbAxes(orb, orb.radius, time);
			expect(rx + ry).toBeCloseTo(2 * orb.radius, 6);
		}
	});
});

describe('Die Soll-Marke', () => {
	it('liegt bei den Blasen auf dem Radius, den eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const aufZiel = buildOrbs(metrics).find((orb) => orb.pillarId === 2);

		expect(targetRadius(metrics)).toBeCloseTo(aufZiel?.radius ?? -1, 6);
	});

	it('liegt bei den Ringen auf dem Bogenanteil, den eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const arcs = buildArcs(metrics);
		const aufZiel = arcs.find((arc) => arc.pillarId === 2);

		expect(arcs[0].target).toBeCloseTo(aufZiel?.sweep ?? -1, 6);
	});

	it('liegt bei den Strahlen auf der Länge, die eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const rays = buildRays(metrics);
		const aufZiel = rays.find((ray) => ray.pillarId === 2);

		expect(rays[0].targetLength).toBeCloseTo(aufZiel?.length ?? -1, 6);
	});
});

describe('Figur „Ringe"', () => {
	it('legt die stärkste Säule auf die äußerste Spur und staffelt nach innen', () => {
		const arcs = buildArcs(metricsOf([0.4, 1.6, 1.0]));

		expect(arcs[0].radius).toBeGreaterThan(arcs[1].radius);
		expect(arcs[1].radius).toBeGreaterThan(arcs[2].radius);
	});

	it('teilt das Feld unter den Säulen auf — mehr Säulen heißt dünnere Ringe', () => {
		expect(buildArcs(metricsOf([1, 1])).map((arc) => arc.width)[0]).toBeGreaterThan(
			buildArcs(metricsOf([1, 1, 1, 1, 1])).map((arc) => arc.width)[0],
		);
	});

	it('legt die Bogenlänge auf den Wert der Säule (0–1)', () => {
		const arcs = buildArcs(metricsOf([2, 1, 0]));

		expect(arcs.map((arc) => Number(arc.sweep.toFixed(3)))).toEqual([1, 0.5, 0]);
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
