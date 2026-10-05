import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#1360, Spec docs/spec/issue-1360.md): `berechneStreak` existiert noch nicht.
// Der Import schlägt fehl, bis `server/src/logics/streak.ts` die Funktion bereitstellt.
import { berechneStreak } from './streak.js';
// ROTE Spec-Tests (#1820, docs/spec/issue-1820.md): `streakZeitpunkte` existiert noch nicht.
import { streakZeitpunkte } from './streak.js';
// ROTE Spec-Tests (#1971, docs/spec/issue-1971.md): Ruhetag-Regel in `berechneStreak` und die neuen
// Exporte `berechneWochenAusgewogen` / `istHeuteRuhetag` fehlen noch.
import { berechneWochenAusgewogen, istHeuteRuhetag } from './streak.js';

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

/**
 * Vertrag #1971 (docs/spec/issue-1971.md): ein Ruhetag je Kalenderwoche (Mo–So, Nutzer-Zeitzone).
 * Ein einzelner erledigungsfreier Tag je Woche bricht die Tageskette nicht und zählt nicht mit
 * (`aktuell`/`best` = Anzahl aktiver Tage); ein zweiter in derselben Woche bricht sie. Ungenutzte
 * Ruhetage verfallen mit der Woche.
 */
describe('berechneStreak — Ruhetag (#1971)', () => {
	// Fr 2026-09-11; laufende Woche Mo 09-07 … So 09-13, Vorwoche Mo 08-31 … So 09-06.
	const heute = new Date('2026-09-11T12:00:00.000Z');
	const tage = (...isos: string[]): Date[] => isos.map((iso) => new Date(`${iso}T10:00:00.000Z`));

	it('AK1: ein erledigungsfreier Tag in der Woche hält die Kette, zählt aber nicht mit', () => {
		const result = berechneStreak(tage('2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11'), heute, 'UTC');
		assert.equal(result.aktuell, 4, 'Mi 09-09 ist Ruhetag: Kette hält, 4 aktive Tage');
		assert.equal(result.best, 4);
	});

	it('AK1: best wendet dieselbe Regel auf alte Folgen an', () => {
		const result = berechneStreak(
			tage('2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07', '2026-09-11'),
			heute,
			'UTC',
		);
		assert.equal(result.best, 4, 'alte Folge mit Ruhetag Mi 08-05 = 4 aktive Tage');
		assert.equal(result.aktuell, 1);
	});

	it('AK2: zwei erledigungsfreie Tage in derselben Woche brechen die Kette', () => {
		const result = berechneStreak(tage('2026-09-07', '2026-09-09', '2026-09-11'), heute, 'UTC');
		assert.equal(result.aktuell, 1, 'Di 09-08 ist Ruhetag, Do 09-10 bricht die Kette');
		assert.equal(result.best, 2);
	});

	it('AK2: ein ungenutzter Ruhetag der Vorwoche wird nicht übertragen', () => {
		const result = berechneStreak(
			tage(
				'2026-08-31',
				'2026-09-01',
				'2026-09-02',
				'2026-09-03',
				'2026-09-04',
				'2026-09-05',
				'2026-09-06',
				'2026-09-07',
				'2026-09-10',
				'2026-09-11',
			),
			heute,
			'UTC',
		);
		assert.equal(result.aktuell, 2, 'Di+Mi der laufenden Woche frei: nur ein Ruhetag gilt, die Kette bricht');
		assert.equal(result.best, 8);
	});

	it('AK2: erledigungsfreie Tage So und Mo (verschiedene Wochen) — je Woche ein Ruhetag, Kette hält', () => {
		const result = berechneStreak(
			tage('2026-09-03', '2026-09-04', '2026-09-05', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'),
			heute,
			'UTC',
		);
		assert.equal(result.aktuell, 7);
		assert.equal(result.best, 7);
	});

	it('AK2: Wochengrenze folgt der Nutzer-Zeitzone (Mo 00:00 lokal, nicht UTC)', () => {
		// Berlin (UTC+2): 2026-09-06T22:30Z ist bereits Mo 09-07 → Ruhetage So 09-06 (Vorwoche) und Mi 09-09.
		// In UTC läge der Zeitpunkt auf So 09-06; dann hätte die laufende Woche zwei freie Tage (Mo, Mi).
		const zeitpunkte = [
			new Date('2026-09-04T10:00:00.000Z'),
			new Date('2026-09-05T10:00:00.000Z'),
			new Date('2026-09-06T22:30:00.000Z'),
			new Date('2026-09-08T10:00:00.000Z'),
			new Date('2026-09-10T10:00:00.000Z'),
			new Date('2026-09-11T10:00:00.000Z'),
		];
		assert.equal(berechneStreak(zeitpunkte, heute, 'Europe/Berlin').aktuell, 6);
		assert.equal(berechneStreak(zeitpunkte, heute, 'UTC').aktuell, 2);
	});

	it('AK3: heute offen, gestern Ruhetag der laufenden Woche ⇒ aktuell bleibt > 0', () => {
		const result = berechneStreak(tage('2026-09-07', '2026-09-08', '2026-09-09'), heute, 'UTC');
		assert.equal(result.aktuell, 3, 'Do 09-10 ist Ruhetag, Fr 09-11 ist noch offen — keine Lücke');
	});

	it('AK3: war vor gestern schon ein Tag frei, ist der Ruhetag verbraucht — Kette gebrochen', () => {
		const result = berechneStreak(tage('2026-09-07', '2026-09-09'), heute, 'UTC');
		assert.equal(result.aktuell, 0, 'Di 09-08 und Do 09-10 frei: zwei erledigungsfreie Tage in der Woche');
	});

	it('AK9: nachträgliches Abhaken (#1820) füllt den Fälligkeitstag und zählt als aktiver Tag', () => {
		const zeitpunkte = streakZeitpunkte(
			[
				{ zeitpunkt: new Date('2026-09-07T10:00:00.000Z') },
				{ zeitpunkt: new Date('2026-09-11T09:00:00.000Z'), deadline: new Date('2026-09-09T15:00:00.000Z') },
				{ zeitpunkt: new Date('2026-09-10T10:00:00.000Z') },
			],
			'UTC',
		);
		const result = berechneStreak(zeitpunkte, heute, 'UTC');
		assert.deepEqual(result.aktiveTage, ['2026-09-07', '2026-09-09', '2026-09-10', '2026-09-11']);
		assert.equal(result.aktuell, 4, 'Di 09-08 bleibt der Ruhetag, der Fälligkeitstag Mi zählt als aktiv');
	});
});

/** `istHeuteRuhetag(aktiveTage, heute, zeitZone)`: heute ohne Erledigung UND kein früherer freier Tag in der laufenden Woche. */
describe('istHeuteRuhetag (#1971 AK6)', () => {
	const heute = new Date('2026-09-11T12:00:00.000Z');

	it('true, wenn heute frei ist und Mo–Do der Woche alle aktiv waren', () => {
		assert.equal(istHeuteRuhetag(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'], heute, 'UTC'), true);
	});

	it('false, wenn in der laufenden Woche vor heute schon ein Tag frei war', () => {
		assert.equal(istHeuteRuhetag(['2026-09-07', '2026-09-09', '2026-09-10'], heute, 'UTC'), false);
	});

	it('false, wenn heute bereits etwas erledigt ist', () => {
		assert.equal(istHeuteRuhetag(['2026-09-10', '2026-09-11'], heute, 'UTC'), false);
	});
});

/**
 * Vertrag #1971 AK4: `berechneWochenAusgewogen(eintraege, saeulen, heute, zeitZone)` — Anzahl
 * aufeinanderfolgender ausgewogener Kalenderwochen. Ausgewogen = jede der drei Säulen mit höchstem
 * `weight` (Gleichstand: kleinere id zuerst; weniger als drei Säulen: alle) hat in der Woche eine
 * Erledigung (`saeulenIds` = Säulen mit share > 0). Die laufende Woche zählt, sobald sie
 * ausgewogen ist, bricht die Folge aber nicht, solange sie offen ist.
 */
describe('berechneWochenAusgewogen (#1971 AK4)', () => {
	const heute = new Date('2026-09-11T12:00:00.000Z'); // Fr; laufende Woche ab Mo 09-07
	const gleich = [1, 2, 3, 4, 5].map((id) => ({ id, weight: 20 }));
	const e = (iso: string, ...saeulenIds: number[]) => ({ zeitpunkt: new Date(`${iso}T10:00:00.000Z`), saeulenIds });
	const aktuelleWoche = (...ids: number[]) => ids.map((id, i) => e(`2026-09-0${7 + i}`, id));
	const vorwoche = (...ids: number[]) => ids.map((id, i) => e(`2026-09-0${1 + i}`, id));
	const vorvorwoche = (...ids: number[]) => ids.map((id, i) => e(`2026-08-2${5 + i}`, id));

	it('ohne Einträge oder ohne Säulen 0', () => {
		assert.equal(berechneWochenAusgewogen([], gleich, heute, 'UTC'), 0);
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1, 2, 3), [], heute, 'UTC'), 0);
	});

	it('laufende Woche zählt, sobald alle drei Top-Säulen erledigt sind', () => {
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1, 2, 3), gleich, heute, 'UTC'), 1);
	});

	it('laufende Woche offen bricht die Folge nicht — Vorwochen zählen weiter', () => {
		const eintraege = [...aktuelleWoche(1), ...vorwoche(1, 2, 3), ...vorvorwoche(1, 2, 3)];
		assert.equal(berechneWochenAusgewogen(eintraege, gleich, heute, 'UTC'), 2);
	});

	it('laufende Woche offen und Vorwoche unausgewogen ⇒ 0', () => {
		assert.equal(berechneWochenAusgewogen([...aktuelleWoche(1), ...vorwoche(1, 2)], gleich, heute, 'UTC'), 0);
	});

	it('eine unausgewogene Woche beendet die Folge; frühere Wochen zählen nicht mit', () => {
		const eintraege = [...aktuelleWoche(1, 2, 3), ...vorwoche(1, 2), ...vorvorwoche(1, 2, 3)];
		assert.equal(berechneWochenAusgewogen(eintraege, gleich, heute, 'UTC'), 1);
	});

	it('Top-Säulen folgen dem Gewicht, nicht der id', () => {
		const nachGewicht = [
			{ id: 1, weight: 10 },
			{ id: 2, weight: 30 },
			{ id: 3, weight: 25 },
			{ id: 4, weight: 20 },
			{ id: 5, weight: 15 },
		];
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1, 2, 3), nachGewicht, heute, 'UTC'), 0);
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(2, 3, 4), nachGewicht, heute, 'UTC'), 1);
	});

	it('Gleichstand beim Gewicht: kleinere id zuerst (Top-3 = 1, 2, 3)', () => {
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1, 2, 4), gleich, heute, 'UTC'), 0);
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1, 2, 3), gleich, heute, 'UTC'), 1);
	});

	it('weniger als drei Säulen: alle Säulen müssen erledigt sein', () => {
		const zwei = gleich.slice(0, 2);
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1), zwei, heute, 'UTC'), 0);
		assert.equal(berechneWochenAusgewogen(aktuelleWoche(1, 2), zwei, heute, 'UTC'), 1);
	});

	it('eine Erledigung kann mehrere Säulen bedienen', () => {
		assert.equal(berechneWochenAusgewogen([e('2026-09-08', 1, 2, 3)], gleich, heute, 'UTC'), 1);
	});

	it('Wochengrenze folgt der Nutzer-Zeitzone (Berlin: Mo 00:30 gehört schon zur laufenden Woche)', () => {
		const eintraege = [e('2026-09-08', 1, 2), { zeitpunkt: new Date('2026-09-06T22:30:00.000Z'), saeulenIds: [3] }];
		assert.equal(berechneWochenAusgewogen(eintraege, gleich, heute, 'Europe/Berlin'), 1);
		assert.equal(berechneWochenAusgewogen(eintraege, gleich, heute, 'UTC'), 0);
	});
});
