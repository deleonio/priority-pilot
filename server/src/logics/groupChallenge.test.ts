import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#1992, docs/spec/issue-1992.md, AK2/AK3): `groupChallenge.ts` existiert noch nicht.
import { berechneRangfolge, challengeStatus } from './groupChallenge.js';

const SAEULEN = [
	{ id: 1, name: 'A', weight: 50 },
	{ id: 2, name: 'B', weight: 50 },
];
const task = (pillarId: number, effort: number) => ({
	status: 'Done',
	estimatedEffort: effort,
	pillars: [{ pillarId, share: 100 }],
});

describe('berechneRangfolge (#1992 AK3)', () => {
	it('ausgewogen mit weniger Tasks rangiert vor einseitig mit mehr Tasks', () => {
		const res = berechneRangfolge([
			{ name: 'Einseitig', saeulen: SAEULEN, tasks: [task(1, 5), task(1, 5), task(1, 5), task(1, 5)] },
			{ name: 'Ausgewogen', saeulen: SAEULEN, tasks: [task(1, 3), task(2, 3)] },
		]);
		assert.deepEqual(
			res.map((r) => [r.name, r.rang]),
			[
				['Ausgewogen', 1],
				['Einseitig', 2],
			],
		);
	});

	it('Gleichstand → gleicher Rang', () => {
		const res = berechneRangfolge([
			{ name: 'X', saeulen: SAEULEN, tasks: [task(1, 3), task(2, 3)] },
			{ name: 'Y', saeulen: SAEULEN, tasks: [task(1, 3), task(2, 3)] },
		]);
		assert.equal(res[0].rang, 1);
		assert.equal(res[1].rang, 1);
	});

	it('ohne Punkte → balance null, am Ende, keine 0', () => {
		const res = berechneRangfolge([
			{ name: 'Leer', saeulen: SAEULEN, tasks: [] },
			{ name: 'Aktiv', saeulen: SAEULEN, tasks: [task(1, 3), task(2, 3)] },
		]);
		assert.equal(res[0].name, 'Aktiv');
		assert.equal(res[1].name, 'Leer');
		assert.equal(res[1].balance, null);
	});

	it('liefert nur name, rang, balance', () => {
		const [eintrag] = berechneRangfolge([{ name: 'X', saeulen: SAEULEN, tasks: [task(1, 3)] }]);
		assert.deepEqual(Object.keys(eintrag).sort(), ['balance', 'name', 'rang']);
	});
});

describe('challengeStatus (#1992 AK2)', () => {
	const ende = new Date('2026-10-12T10:00:00Z');
	it('laufend vor endsAt, beendet ab endsAt', () => {
		assert.equal(challengeStatus(ende, new Date('2026-10-12T09:59:59Z')), 'laufend');
		assert.equal(challengeStatus(ende, ende), 'beendet');
	});
});
