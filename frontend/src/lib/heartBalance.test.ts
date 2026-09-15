import type { Pillar } from 'client';
import { describe, expect, it } from 'vitest';
import { buildHeartBalance, heartHealth } from './heartBalance';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

/**
 * Sichert die Aussagen ab, die das Herz-Bild überhaupt tragen: der Füllstand ist genau dann voll,
 * wenn Ist = Soll, und genau dann leer, wenn alles an einer Säule hängt; eine stark vernachlässigte
 * Säule wiegt schwerer als dieselbe Menge Defizit dünn verteilt (sonst lobt das Herz Schieflagen);
 * und die Farbvergabe hängt an der Säule, nicht an ihrer Position.
 */
describe('buildHeartBalance', () => {
	it('füllt das Herz vollständig, wenn die Ist-Verteilung der Gewichtung entspricht', () => {
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 30), pillar(3, 'Beziehung', 20)];
		const balance = buildHeartBalance(
			pillars,
			new Map([
				[1, 10],
				[2, 6],
				[3, 4],
			]),
		);

		expect(balance.fill).toBeCloseTo(1);
		expect(balance.hasPoints).toBe(true);
		expect(balance.segments.map((segment) => segment.level)).toEqual([1, 1, 1]);
	});

	it('leert das Herz vollständig, wenn eine Säule alle Punkte abzieht', () => {
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const balance = buildHeartBalance(pillars, new Map([[1, 10]]));

		// Schlechter geht es nicht: alles an einer Säule ist der Boden der Skala.
		expect(balance.fill).toBeCloseTo(0);
		expect(balance.segments[0].level).toBe(1);
		expect(balance.segments[1].level).toBe(0);
	});

	it('entspricht der normierten quadratischen Abweichung vom Soll', () => {
		const pillars = [pillar(1, 'A', 60), pillar(2, 'B', 30), pillar(3, 'C', 10)];
		const balance = buildHeartBalance(
			pillars,
			new Map([
				[1, 5],
				[2, 4],
				[3, 1],
			]),
		);

		// Formel unabhängig nachgerechnet (Modulkommentar heartBalance.ts).
		const spread = balance.segments.reduce((sum, s) => sum + s.targetShare * (1 - s.level) ** 2, 0);
		const worst = 1 - Math.min(...balance.segments.map((s) => s.targetShare));
		expect(balance.fill).toBeCloseTo(1 - Math.sqrt(spread / worst));
	});

	/*
	 * Der Ausgangsfall des Tickets mit hart erwarteter Zahl: 16/20/5/12/47 bei Soll je 20 ergibt
	 * `spread` 0,1525 und Maximum 0,8, also 1 − √0,190625 = 0,5634. Der Test oben sichert nur die
	 * innere Stimmigkeit der Formel; erst diese feste Zahl macht eine stille Verschiebung sichtbar.
	 */
	it('bewertet den Ausgangsfall 16/20/5/12/47 mit 56 Prozent', () => {
		const pillars = [1, 2, 3, 4, 5].map((id) => pillar(id, `S${id}`, 20));
		const balance = buildHeartBalance(
			pillars,
			new Map([
				[1, 16],
				[2, 20],
				[3, 5],
				[4, 12],
				[5, 47],
			]),
		);

		expect(balance.fill).toBeCloseTo(0.5634, 4);
	});

	/*
	 * `POST /pillars` legt jede neue Säule mit `weight: 0` an — eine gewichtslose Säule ist der
	 * Normalfall. Sie darf den Füllstand nicht verschieben, sonst hinge die Bewertung daran, wie
	 * viele Säulen jemand angelegt, aber noch nicht gewichtet hat.
	 */
	it('lässt eine Säule ohne Soll den Füllstand unberührt', () => {
		const gewichtet = [1, 2, 3, 4, 5].map((id) => pillar(id, `S${id}`, 20));
		const punkte = new Map([
			[1, 16],
			[2, 20],
			[3, 5],
			[4, 12],
			[5, 47],
		]);

		const ohne = buildHeartBalance(gewichtet, punkte);
		const mit = buildHeartBalance([...gewichtet, pillar(6, 'Frisch angelegt', 0)], punkte);

		expect(mit.fill).toBeCloseTo(ohne.fill, 10);

		// Auch der Boden der Skala bleibt erreichbar, statt bei 0,106 hängen zu bleiben.
		const allesAufEiner = buildHeartBalance([...gewichtet, pillar(6, 'Frisch angelegt', 0)], new Map([[1, 10]]));
		expect(allesAufEiner.fill).toBeCloseTo(0);
	});

	it('lässt das Herz leer, wenn aller Aufwand in Säulen ohne Soll liegt', () => {
		const pillars = [pillar(1, 'Mit Ziel', 100), pillar(2, 'Ohne Ziel', 0)];
		const balance = buildHeartBalance(pillars, new Map([[2, 10]]));

		expect(balance.fill).toBe(0);
		expect(balance.hasPoints).toBe(true);
	});

	it('bewertet eine vernachlässigte Säule schlechter als dasselbe Defizit dünn verteilt', () => {
		const pillars = [1, 2, 3, 4, 5].map((id) => pillar(id, `S${id}`, 20));
		// Beide Verteilungen haben dasselbe Gesamtdefizit von 20 Prozentpunkten gegenüber dem Soll.
		const vernachlaessigt = buildHeartBalance(
			pillars,
			new Map([
				[1, 25],
				[2, 25],
				[3, 25],
				[4, 25],
				[5, 0],
			]),
		);
		const gleichmaessig = buildHeartBalance(
			pillars,
			new Map([
				[1, 15],
				[2, 15],
				[3, 15],
				[4, 15],
				[5, 40],
			]),
		);

		expect(vernachlaessigt.fill).toBeLessThan(gleichmaessig.fill);
	});

	it('lässt das Herz ohne Punkte leer, statt durch 0 zu teilen', () => {
		const balance = buildHeartBalance([pillar(1, 'Körper', 100)], new Map());

		expect(balance.fill).toBe(0);
		expect(balance.hasPoints).toBe(false);
		expect(balance.segments[0].level).toBe(0);
	});

	it('nimmt Gleichverteilung als Soll an, wenn keine Gewichtung gepflegt ist', () => {
		const pillars = [pillar(1, 'A', 0), pillar(2, 'B', 0)];
		const balance = buildHeartBalance(
			pillars,
			new Map([
				[1, 5],
				[2, 5],
			]),
		);

		expect(balance.segments.map((segment) => segment.targetShare)).toEqual([0.5, 0.5]);
		expect(balance.fill).toBeCloseTo(1);
	});

	it('vergibt die Farbrampe nach Säulen-id, damit Umsortieren nicht umfärbt', () => {
		const a = pillar(7, 'Später angelegt', 50);
		const b = pillar(3, 'Früher angelegt', 50);

		const colorOf = (pillars: Pillar[], id: number): number =>
			buildHeartBalance(pillars, new Map()).segments.find((segment) => segment.pillar.id === id)?.colorIndex ?? -1;

		expect(colorOf([a, b], 3)).toBe(0);
		expect(colorOf([b, a], 3)).toBe(0);
		expect(colorOf([a, b], 7)).toBe(1);
		expect(colorOf([b, a], 7)).toBe(1);
	});
});

describe('heartHealth', () => {
	it('unterscheidet „noch nichts getan" von „unausgewogen"', () => {
		expect(heartHealth({ fill: 0, hasPoints: false, segments: [] }).state).toBe('leer');
		expect(heartHealth({ fill: 0, hasPoints: true, segments: [] }).state).toBe('schwach');
	});

	it('stuft den Füllstand über die vier Zustände hinweg auf', () => {
		const stateAt = (fill: number): string => heartHealth({ fill, hasPoints: true, segments: [] }).state;

		expect(stateAt(0.95)).toBe('stark');
		expect(stateAt(0.7)).toBe('gut');
		expect(stateAt(0.5)).toBe('wackelig');
		expect(stateAt(0.2)).toBe('schwach');
	});

	it('nennt die zurückliegende und die davonziehende Säule beim Namen', () => {
		const pillars = [pillar(1, 'Sinn', 20), pillar(2, 'Wirksamkeit', 20), pillar(3, 'Körper', 20)];
		const balance = buildHeartBalance(
			pillars,
			new Map([
				[1, 5],
				[2, 60],
				[3, 35],
			]),
		);

		const { hint } = heartHealth(balance);
		expect(hint).toContain('Sinn');
		expect(hint).toContain('Wirksamkeit');
	});

	it('hält im Zustand „In Balance" den Stufentext, statt ihm eine Säule entgegenzusetzen', () => {
		const pillars = [pillar(1, 'A', 20), pillar(2, 'B', 20), pillar(3, 'C', 20)];
		const balance = buildHeartBalance(
			pillars,
			new Map([
				[1, 28],
				[2, 36],
				[3, 36],
			]),
		);

		const health = heartHealth(balance);
		expect(health.state).toBe('stark');
		expect(health.hint).toBe('Deine Säulen liegen dicht am Soll.');
	});
});
