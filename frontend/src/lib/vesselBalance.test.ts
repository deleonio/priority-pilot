import type { Pillar } from 'client';
import { describe, expect, it } from 'vitest';
import { buildVesselBalance, vesselHealth } from './vesselBalance';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

/**
 * Sichert die drei Aussagen ab, die das Gefäß-Bild überhaupt trägt: der Füllstand ist genau dann
 * voll, wenn Ist = Soll; er ist das gewichtete Mittel der Wassersäulen (Bild und Prozentzahl dürfen
 * sich nie widersprechen); und die Farbvergabe hängt an der Säule, nicht an ihrer Position.
 */
describe('buildVesselBalance', () => {
	it('füllt das Gefäß vollständig, wenn die Ist-Verteilung der Gewichtung entspricht', () => {
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 30), pillar(3, 'Beziehung', 20)];
		const balance = buildVesselBalance(
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

	it('senkt Füllstand und Wassersäulen, wenn eine Säule alle Punkte abzieht', () => {
		const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const balance = buildVesselBalance(pillars, new Map([[1, 10]]));

		// Überlappung von Ist (1 / 0) und Soll (0,5 / 0,5) ist 0,5 — die halbe Füllung.
		expect(balance.fill).toBeCloseTo(0.5);
		expect(balance.segments[0].level).toBe(1);
		expect(balance.segments[1].level).toBe(0);
	});

	it('hält den Füllstand als soll-gewichtetes Mittel der Wassersäulen', () => {
		const pillars = [pillar(1, 'A', 60), pillar(2, 'B', 30), pillar(3, 'C', 10)];
		const balance = buildVesselBalance(
			pillars,
			new Map([
				[1, 5],
				[2, 4],
				[3, 1],
			]),
		);

		const weightedMean = balance.segments.reduce((sum, s) => sum + s.targetShare * s.level, 0);
		expect(balance.fill).toBeCloseTo(weightedMean);
	});

	it('lässt das Gefäß ohne Punkte leer, statt durch 0 zu teilen', () => {
		const balance = buildVesselBalance([pillar(1, 'Körper', 100)], new Map());

		expect(balance.fill).toBe(0);
		expect(balance.hasPoints).toBe(false);
		expect(balance.segments[0].level).toBe(0);
	});

	it('nimmt Gleichverteilung als Soll an, wenn keine Gewichtung gepflegt ist', () => {
		const pillars = [pillar(1, 'A', 0), pillar(2, 'B', 0)];
		const balance = buildVesselBalance(
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
			buildVesselBalance(pillars, new Map()).segments.find((segment) => segment.pillar.id === id)?.colorIndex ?? -1;

		expect(colorOf([a, b], 3)).toBe(0);
		expect(colorOf([b, a], 3)).toBe(0);
		expect(colorOf([a, b], 7)).toBe(1);
		expect(colorOf([b, a], 7)).toBe(1);
	});
});

describe('vesselHealth', () => {
	it('unterscheidet „noch nichts getan" von „unausgewogen"', () => {
		expect(vesselHealth({ fill: 0, hasPoints: false, segments: [] }).state).toBe('leer');
		expect(vesselHealth({ fill: 0, hasPoints: true, segments: [] }).state).toBe('schwach');
	});

	it('stuft den Füllstand über die vier Zustände hinweg auf', () => {
		const stateAt = (fill: number): string => vesselHealth({ fill, hasPoints: true, segments: [] }).state;

		expect(stateAt(0.95)).toBe('stark');
		expect(stateAt(0.75)).toBe('gut');
		expect(stateAt(0.5)).toBe('wackelig');
		expect(stateAt(0.2)).toBe('schwach');
	});
});
