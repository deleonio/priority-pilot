import { describe, expect, it } from 'vitest';
import {
	activeTicks,
	buildArcs,
	buildHands,
	buildOrbs,
	buildPetals,
	buildRays,
	buildWedges,
	CENTER,
	FIGURE_MAX,
	orbAxes,
	petalRadiusAt,
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
 * Die Geometrie der Figuren und des gemeinsamen Zifferblatts.
 *
 * Der rote Faden dieser Datei: Alle Figuren bekommen **dieselben** Werte und müssen daraus
 * dieselbe Ordnung bauen — stärkste Säule zuerst. Und keine von ihnen darf ins Zifferblatt laufen.
 */

/** Kennzahlen von Hand, ohne den Umweg über `buildHeartBalance`. */
const metricsOf = (ratios: number[]): BalanceMetrics => {
	const scale = Math.max(1, ...ratios);
	const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
	return {
		pillars: ratios.map((ratio, index) => ({
			pillarId: index + 1,
			colorIndex: index,
			ratio,
			scaled: ratio / scale,
			actualShare: total > 0 ? ratio / total : 0,
		})),
		targetMark: 1 / scale,
		scale,
	};
};

describe('Ordnung über alle Figuren', () => {
	const metrics = metricsOf([0.4, 1.6, 1.0]);

	it('ordnet Blasen, Ringe, Strahlen und Lappen nach derselben Regel: stärkste Säule zuerst', () => {
		const erwartet = [2, 3, 1];
		expect(buildOrbs(metrics).map((orb) => orb.pillarId)).toEqual(erwartet);
		expect(buildArcs(metrics).map((arc) => arc.pillarId)).toEqual(erwartet);
		expect(buildRays(metrics).map((ray) => ray.pillarId)).toEqual(erwartet);
		expect(buildPetals(metrics).map((petal) => petal.pillarId)).toEqual(erwartet);
		expect(buildWedges(metrics).map((wedge) => wedge.pillarId)).toEqual(erwartet);
		expect(buildHands(metrics).map((hand) => hand.pillarId)).toEqual(erwartet);
	});

	it('gibt derselben Säule in jeder Figur dieselbe Bewegung', () => {
		const orb = buildOrbs(metrics)[0];
		const arc = buildArcs(metrics)[0];
		const ray = buildRays(metrics)[0];
		const petal = buildPetals(metrics)[0];
		const wedge = buildWedges(metrics)[0];
		const hand = buildHands(metrics)[0];

		for (const key of ['phase', 'swingPeriod', 'rotPeriod', 'rotDirection'] as const) {
			expect(arc[key]).toBe(orb[key]);
			expect(ray[key]).toBe(orb[key]);
			expect(petal[key]).toBe(orb[key]);
			expect(wedge[key]).toBe(orb[key]);
			expect(hand[key]).toBe(orb[key]);
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
		for (const petal of buildPetals(voll)) expect(petal.radius).toBeLessThanOrEqual(FIGURE_MAX);
		for (const wedge of buildWedges(voll)) expect(wedge.outer).toBeLessThanOrEqual(FIGURE_MAX);
		for (const hand of buildHands(voll)) expect(hand.length).toBeLessThanOrEqual(FIGURE_MAX);
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
		for (const petal of buildPetals(leer)) expect(petal.radius).toBe(R_MIN);
		// Segmente: das Mindeststück hält die Säule im Bild, der Radius bleibt auf dem Minimum.
		for (const wedge of buildWedges(leer)) {
			expect(wedge.span).toBeGreaterThan(0);
			expect(wedge.outer).toBe(R_MIN);
		}
		for (const hand of buildHands(leer)) expect(hand.length).toBe(R_MIN);
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

	it('liegt bei Blüte und Kristall auf dem Radius, die eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const petals = buildPetals(metrics);
		const aufZiel = petals.find((petal) => petal.pillarId === 2);

		expect(targetRadius(metrics)).toBeCloseTo(aufZiel?.radius ?? -1, 6);
	});

	it('liegt bei den Segmenten auf dem Radius, den eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const wedges = buildWedges(metrics);
		const aufZiel = wedges.find((wedge) => wedge.pillarId === 2);

		expect(wedges[0].targetRadius).toBeCloseTo(aufZiel?.outer ?? -1, 6);
	});

	it('liegt bei den Zeigern auf der Länge, die eine Säule auf Ziel hätte', () => {
		const metrics = metricsOf([2, 1]);
		const hands = buildHands(metrics);
		const aufZiel = hands.find((hand) => hand.pillarId === 2);

		expect(hands[0].targetLength).toBeCloseTo(aufZiel?.length ?? -1, 6);
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

describe('Figur „Segmente“', () => {
	/*
	 * Die Breite ist der Ist-Anteil: Sie muss dieselbe Reihenfolge wie die Kennzahl bauen und den
	 * Ring vollständig schließen — sonst klaffte eine Lücke und das Bild würde Anteile erfinden.
	 */
	it('teilt den Ring vollständig unter den Stücken auf, stärkste Säule zuerst', () => {
		const wedges = buildWedges(metricsOf([0.4, 1.6, 1.0]));

		expect(wedges).toHaveLength(3);
		expect(wedges.reduce((sum, wedge) => sum + wedge.span, 0)).toBeCloseTo(360, 6);
		expect(wedges[0].span).toBeGreaterThan(wedges[1].span);
		expect(wedges[1].span).toBeGreaterThan(wedges[2].span);
		// Ohne Lücke: Das Ende eines Stücks ist der Start des nächsten.
		expect(wedges[1].start).toBeCloseTo(wedges[0].start + wedges[0].span, 6);
	});

	it('beginnt das erste Stück auf 12 Uhr und behält zwischen allen eine Fuge', () => {
		const wedges = buildWedges(metricsOf([0.4, 1.6, 1.0]));

		expect(wedges[0].start).toBeGreaterThan(-90);
		for (const wedge of wedges) expect(wedge.end).toBeGreaterThan(wedge.start);
	});

	it('behält bei vielen Säulen ein sichtbares Mindeststück je Säule', () => {
		const wedges = buildWedges(metricsOf([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

		for (const wedge of wedges) {
			expect(wedge.span).toBeGreaterThan(0);
			expect(wedge.end).toBeGreaterThan(wedge.start);
		}
	});

	it('teilt den Ring im Leerzustand (keine Punkte vergeben) gleichmäßig auf statt auf Haarlinien zu schrumpfen', () => {
		const wedges = buildWedges(metricsOf([0, 0, 0]));

		const totalSpan = wedges.reduce((sum, wedge) => sum + wedge.span, 0);
		expect(totalSpan).toBeCloseTo(360, 5);
		for (const wedge of wedges) expect(wedge.span).toBeCloseTo(120, 5);
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
