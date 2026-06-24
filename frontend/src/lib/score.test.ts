import type { Pillar } from 'client';
import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#121): Die Dashboard-Aufbereitung des Balance-Stands existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/lib/score.ts` die Schnittstelle bereitstellt.
import { buildPillarBalances } from './score';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, weight });

/**
 * Vertrag für den „Balance-Stand pro Säule" im Dashboard (Konzept §4.4): aus den aggregierten
 * Gamification-Punkten je Säule wird je Säule der Punktestand und sein Anteil am Gesamtstand
 * aufbereitet — die sichtbare Balance der Säulen untereinander.
 */
describe('buildPillarBalances', () => {
	const pillars = [pillar(1, 'Körper', 20), pillar(2, 'Sinn', 20), pillar(3, 'Geist', 20)];

	it('bildet je Säule den Punktestand ab und behält die Reihenfolge', () => {
		const balances = buildPillarBalances(
			pillars,
			new Map([
				[1, 60],
				[2, 40],
			]),
		);
		expect(balances.map((entry) => entry.pillar.id)).toEqual([1, 2, 3]);
		expect(balances.map((entry) => entry.punkte)).toEqual([60, 40, 0]);
	});

	it('zählt eine Säule ohne Punkte als 0', () => {
		const balances = buildPillarBalances(pillars, new Map([[1, 100]]));
		expect(balances.find((entry) => entry.pillar.id === 3)?.punkte).toBe(0);
	});

	it('berechnet den Anteil jeder Säule am Gesamtstand', () => {
		const balances = buildPillarBalances(
			pillars,
			new Map([
				[1, 60],
				[2, 40],
			]),
		);
		expect(balances.find((entry) => entry.pillar.id === 1)?.anteil).toBeCloseTo(0.6);
		expect(balances.find((entry) => entry.pillar.id === 2)?.anteil).toBeCloseTo(0.4);
		expect(balances.find((entry) => entry.pillar.id === 3)?.anteil).toBeCloseTo(0);
	});

	it('liefert ohne Punkte für alle Säulen den Anteil 0 (keine Division durch 0)', () => {
		const balances = buildPillarBalances(pillars, new Map());
		for (const entry of balances) {
			expect(entry.punkte).toBe(0);
			expect(entry.anteil).toBe(0);
		}
	});
});
