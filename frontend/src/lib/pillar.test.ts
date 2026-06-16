import type { Pillar } from 'client';
import { describe, expect, it } from 'vitest';
import { NO_PILLAR_VALUE, isWeightSumValid, pillarSelectOptions, sumWeights } from './pillar';

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, weight });

describe('pillarSelectOptions', () => {
	it('stellt die „keine Säule"-Option voran und bildet alle Säulen ab', () => {
		const options = pillarSelectOptions([pillar(1, 'Körper', 20), pillar(2, 'Sinn', 80)]);
		expect(options).toEqual([
			{ label: '— Keine Säule —', value: NO_PILLAR_VALUE },
			{ label: 'Körper', value: 1 },
			{ label: 'Sinn', value: 2 },
		]);
	});

	it('liefert bei leerer Liste nur die „keine Säule"-Option', () => {
		expect(pillarSelectOptions([])).toEqual([{ label: '— Keine Säule —', value: NO_PILLAR_VALUE }]);
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
