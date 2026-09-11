import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#1360, Spec docs/spec/issue-1360.md): `berechneStreak` existiert noch nicht.
// Der Import schlägt fehl, bis `server/src/logics/streak.ts` die Funktion bereitstellt.
import { berechneStreak } from './streak.js';

/**
 * Vertrag für die Streak-Berechnung (AK1/AK2, #1360).
 *
 * `berechneStreak(erledigungsZeitpunkte, heute, zeitZone)` liefert `{ aktuell, best, aktiveTage }`:
 *  - `aktiveTage`: aufsteigend sortierte, duplikatfreie Liste der Kalendertage (`YYYY-MM-DD`) mit
 *    mindestens einer Erledigung — mehrere Erledigungen am selben Tag zählen als ein Tag (AK1).
 *  - `aktuell`: Länge der ununterbrochenen Tagesfolge, die auf „heute" oder „gestern" endet;
 *    endet die letzte Folge früher, ist `aktuell = 0` (AK2).
 *  - `best`: Länge der längsten ununterbrochenen Tagesfolge über alle Daten (AK2).
 */
describe('berechneStreak', () => {
	const heute = new Date('2026-09-11T12:00:00.000Z');
	const zeitZone = 'UTC';

	it('AK1/AK2: ohne Erledigungen sind aktuell/best 0 und aktiveTage leer', () => {
		const result = berechneStreak([], heute, zeitZone);
		assert.equal(result.aktuell, 0);
		assert.equal(result.best, 0);
		assert.deepEqual(result.aktiveTage, []);
	});

	it('AK1: zwei Erledigungen am selben Kalendertag zählen als ein aktiver Tag', () => {
		const result = berechneStreak(
			[new Date('2026-09-11T08:00:00.000Z'), new Date('2026-09-11T20:00:00.000Z')],
			heute,
			zeitZone,
		);
		assert.deepEqual(result.aktiveTage, ['2026-09-11']);
		assert.equal(result.aktuell, 1);
		assert.equal(result.best, 1);
	});

	it('AK2: drei zusammenhängende Tage bis heute ⇒ aktuell = 3', () => {
		const result = berechneStreak(
			[
				new Date('2026-09-09T10:00:00.000Z'),
				new Date('2026-09-10T10:00:00.000Z'),
				new Date('2026-09-11T10:00:00.000Z'),
			],
			heute,
			zeitZone,
		);
		assert.equal(result.aktuell, 3);
		assert.equal(result.best, 3);
	});

	it('AK2: Lücke gestern nach einer Folge davor ⇒ aktuell = 0, best bleibt aus der alten Folge', () => {
		const result = berechneStreak(
			[
				new Date('2026-09-05T10:00:00.000Z'),
				new Date('2026-09-06T10:00:00.000Z'),
				new Date('2026-09-07T10:00:00.000Z'),
				// 2026-09-08, -09, -10 fehlen (Lücke bis „gestern") — heute ist 2026-09-11.
			],
			heute,
			zeitZone,
		);
		assert.equal(result.aktuell, 0, 'Streak ist gebrochen, wenn die letzte Folge nicht bis gestern reicht');
		assert.equal(result.best, 3, 'die alte dreitägige Folge bleibt die Bestmarke');
	});

	it('AK2: letzte Folge endet gestern ⇒ aktuell zählt die Folge trotzdem (endet auf „heute" ODER „gestern")', () => {
		const result = berechneStreak(
			[new Date('2026-09-09T10:00:00.000Z'), new Date('2026-09-10T10:00:00.000Z')],
			heute,
			zeitZone,
		);
		assert.equal(result.aktuell, 2);
		assert.equal(result.best, 2);
	});

	it('AK2: best stammt aus einer alten, längeren Folge statt aus der aktuellen kürzeren', () => {
		const result = berechneStreak(
			[
				// alte Folge: 4 Tage
				new Date('2026-08-01T10:00:00.000Z'),
				new Date('2026-08-02T10:00:00.000Z'),
				new Date('2026-08-03T10:00:00.000Z'),
				new Date('2026-08-04T10:00:00.000Z'),
				// aktuelle Folge: 2 Tage bis heute
				new Date('2026-09-10T10:00:00.000Z'),
				new Date('2026-09-11T10:00:00.000Z'),
			],
			heute,
			zeitZone,
		);
		assert.equal(result.aktuell, 2);
		assert.equal(result.best, 4);
	});
});
