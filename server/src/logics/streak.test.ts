import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#1360, Spec docs/spec/issue-1360.md): `berechneStreak` existiert noch nicht.
// Der Import schlägt fehl, bis `server/src/logics/streak.ts` die Funktion bereitstellt.
import { berechneStreak } from './streak.js';
// ROTE Spec-Tests (#1820, docs/spec/issue-1820.md): `streakZeitpunkte` existiert noch nicht.
import { streakZeitpunkte } from './streak.js';

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

/**
 * Vertrag #1820: verspätet erledigte Aufgaben füllen ihren Fälligkeitstag.
 * `streakZeitpunkte(eintraege, zeitZone)` liefert je Eintrag `zeitpunkt` plus — nur bei Verspätung
 * (`tagIn(deadline) < tagIn(zeitpunkt)`) — die `deadline`; das Ergebnis geht in `berechneStreak`.
 */
describe('streakZeitpunkte (#1820)', () => {
	const heute = new Date('2026-09-11T12:00:00.000Z');
	const streakVon = (eintraege: { zeitpunkt: Date; deadline?: Date | null }[], zeitZone = 'UTC') =>
		berechneStreak(streakZeitpunkte(eintraege, zeitZone), heute, zeitZone);

	it('AK1: vorgestern aktiv, gestern fällig, heute erledigt ⇒ aktuell = 3, gestern ist aktiver Tag', () => {
		const result = streakVon([
			{ zeitpunkt: new Date('2026-09-09T10:00:00.000Z') },
			{ zeitpunkt: new Date('2026-09-11T09:00:00.000Z'), deadline: new Date('2026-09-10T15:00:00.000Z') },
		]);
		assert.deepEqual(result.aktiveTage, ['2026-09-09', '2026-09-10', '2026-09-11']);
		assert.equal(result.aktuell, 3);
	});

	it('AK2: Fälligkeitstag ohne eigene Erledigung erscheint in aktiveTage, Zeitzone zählt (Berlin-Mitternacht)', () => {
		// Deadline 2026-09-09T22:30Z = 2026-09-10 00:30 in Europe/Berlin (in UTC noch der 9.).
		const eintraege = [
			{ zeitpunkt: new Date('2026-09-11T09:00:00.000Z'), deadline: new Date('2026-09-09T22:30:00.000Z') },
		];
		assert.deepEqual(streakVon(eintraege, 'Europe/Berlin').aktiveTage, ['2026-09-10', '2026-09-11']);
		assert.deepEqual(streakVon(eintraege, 'UTC').aktiveTage, ['2026-09-09', '2026-09-11']);
	});

	it('AK3: echter Bruch lässt aktuell auf 0 fallen, best bleibt', () => {
		const result = streakVon([
			{ zeitpunkt: new Date('2026-09-01T10:00:00.000Z') },
			{ zeitpunkt: new Date('2026-09-02T10:00:00.000Z') },
			{ zeitpunkt: new Date('2026-09-03T10:00:00.000Z'), deadline: new Date('2026-09-03T08:00:00.000Z') },
		]);
		assert.equal(result.best, 3);
		assert.equal(result.aktuell, 0);
	});

	it('AK4: pünktlich (Fälligkeit später oder gleicher Tag) und ohne deadline ändern aktiveTage nicht', () => {
		const result = streakVon([
			{ zeitpunkt: new Date('2026-09-09T10:00:00.000Z'), deadline: new Date('2026-09-09T20:00:00.000Z') },
			{ zeitpunkt: new Date('2026-09-10T10:00:00.000Z'), deadline: new Date('2026-09-14T10:00:00.000Z') },
			{ zeitpunkt: new Date('2026-09-11T10:00:00.000Z'), deadline: null },
		]);
		assert.deepEqual(result.aktiveTage, ['2026-09-09', '2026-09-10', '2026-09-11']);
	});
});
