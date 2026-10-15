import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#2082, docs/spec/issue-2082.md): `balanceTrend` existiert noch nicht.
import { balanceTrend } from './balanceTrend';

const verlauf = (start: number, ende: number) =>
	[start, 50, ende].map((fuellstandProzent, i) => ({
		tag: `2026-10-${10 + i}`,
		fuellstandProzent,
		hatPunkte: true,
		saeulen: [],
	}));

describe('balanceTrend (#2082 AK2)', () => {
	it.each([
		[40, 46, 'aufwaerts'],
		[46, 40, 'abwaerts'],
		[40, 45, 'stabil'],
		[45, 40, 'stabil'],
		[50, 50, 'stabil'],
	])('Start %i → Ende %i ergibt %s', (start, ende, erwartet) => {
		expect(balanceTrend(verlauf(start, ende))).toBe(erwartet);
	});

	it('leere Liste ergibt stabil', () => {
		expect(balanceTrend([])).toBe('stabil');
	});
});
