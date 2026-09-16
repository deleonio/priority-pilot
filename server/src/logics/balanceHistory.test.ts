import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneBalanceVerlauf } from './balanceHistory.js';

/**
 * Rote Spec-Tests für #1424 (Spec docs/spec/issue-1424.md), AK2/AK3/AK5 — Rechenkern
 * `berechneBalanceVerlauf`.
 *
 * Reine Logik, keine DB. Zwei Säulen mit gleichem Gewicht, ein Task pro Säule mit `estimatedEffort: 1`
 * und vollem Anteil (`share: 100`), damit der Füllstand pro erledigtem Task leicht nachrechenbar ist.
 *
 * Rot, bis `server/src/logics/balanceHistory.ts` existiert (heute: Modul fehlt). KEIN Produktivcode.
 */

interface Saeule {
	id: number;
	name: string;
	weight: number;
}

interface TaskFixture {
	status: 'Open' | 'In process' | 'Done';
	estimatedEffort: number;
	pillars: { pillarId: number; share: number }[];
	/** `null` = Done-Task ohne ScoreEntry, zählt ab Zeitraumbeginn (Spec, Abschnitt "Logik"). */
	zeitpunkt: Date | null;
}

const saeulen: Saeule[] = [
	{ id: 1, name: 'Körper', weight: 50 },
	{ id: 2, name: 'Geist', weight: 50 },
];

describe('berechneBalanceVerlauf (#1424)', () => {
	it('AK1: von === bis ergibt genau einen Eintrag für diesen Tag', () => {
		const tasks: TaskFixture[] = [];
		const verlauf = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-01', 'UTC');
		assert.equal(verlauf.length, 1);
		assert.equal(verlauf[0].tag, '2026-06-01');
	});

	it('AK1: liefert genau einen Eintrag je Kalendertag, aufsteigend sortiert', () => {
		const tasks: TaskFixture[] = [];
		const verlauf = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-04', 'UTC');
		assert.deepEqual(
			verlauf.map((tag) => tag.tag),
			['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'],
		);
	});

	it('AK2/AK3: eine Erledigung an Tag 1 hebt den Füllstand ab Tag 1, Folgetage tragen denselben Stand', () => {
		const tasks: TaskFixture[] = [
			{
				status: 'Done',
				estimatedEffort: 1,
				pillars: [{ pillarId: 1, share: 100 }],
				zeitpunkt: new Date('2026-06-01T10:00:00.000Z'),
			},
		];
		const verlauf = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-03', 'UTC');

		assert.equal(verlauf[0].hatPunkte, true, 'Tag 1 muss die Erledigung bereits sehen');
		const koerperTag1 = verlauf[0].saeulen.find((s) => s.id === 1);
		assert.ok(koerperTag1 && Math.abs(koerperTag1.punkte - 1) < 1e-9, 'Körper muss an Tag 1 bereits 1 Punkt tragen');

		// Kumulierte Rechnung ohne weitere Erledigung: Tag 2/3 identisch zu Tag 1.
		assert.deepEqual(verlauf[1].saeulen, verlauf[0].saeulen, 'Tag 2 ohne Erledigung muss Tag 1 spiegeln');
		assert.deepEqual(verlauf[2].saeulen, verlauf[0].saeulen, 'Tag 3 ohne Erledigung muss Tag 1 spiegeln');
		assert.equal(verlauf[0].fuellstandProzent, verlauf[1].fuellstandProzent);
	});

	it('AK2/AK3: eine Erledigung erst an Tag 3 lässt Tag 1/2 unverändert bei 0', () => {
		const tasks: TaskFixture[] = [
			{
				status: 'Done',
				estimatedEffort: 1,
				pillars: [{ pillarId: 1, share: 100 }],
				zeitpunkt: new Date('2026-06-03T10:00:00.000Z'),
			},
		];
		const verlauf = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-04', 'UTC');

		assert.equal(verlauf[0].hatPunkte, false, 'Tag 1 darf die spätere Erledigung noch nicht sehen');
		assert.equal(verlauf[1].hatPunkte, false, 'Tag 2 darf die spätere Erledigung noch nicht sehen');
		assert.equal(verlauf[2].hatPunkte, true, 'Tag 3 muss die Erledigung sehen');
		assert.deepEqual(verlauf[3].saeulen, verlauf[2].saeulen, 'Tag 4 ohne weitere Erledigung muss Tag 3 spiegeln');
	});

	it('AK2/AK3: ein Done-Task ohne ScoreEntry (zeitpunkt: null) zählt ab Zeitraumbeginn', () => {
		const tasks: TaskFixture[] = [
			{ status: 'Done', estimatedEffort: 1, pillars: [{ pillarId: 1, share: 100 }], zeitpunkt: null },
		];
		const verlauf = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-02', 'UTC');

		assert.equal(verlauf[0].hatPunkte, true, 'ein zeitpunkt-loser Done-Task muss bereits am ersten Tag zählen');
		assert.deepEqual(verlauf[1].saeulen, verlauf[0].saeulen);
	});

	it('AK5: eine Erledigung um 23:30 UTC fällt in Europe/Berlin bereits auf den Folgetag', () => {
		const tasks: TaskFixture[] = [
			{
				status: 'Done',
				estimatedEffort: 1,
				pillars: [{ pillarId: 1, share: 100 }],
				zeitpunkt: new Date('2026-06-01T23:30:00.000Z'),
			},
		];
		const berlin = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-02', 'Europe/Berlin');
		assert.equal(berlin[0].hatPunkte, false, 'in Europe/Berlin (UTC+2 im Juni) ist 23:30 UTC bereits der 2. Juni');
		assert.equal(berlin[1].hatPunkte, true);

		const utc = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-02', 'UTC');
		assert.equal(utc[0].hatPunkte, true, 'in UTC zählt dieselbe Erledigung noch am 1. Juni');
	});

	it('nicht erledigte Tasks (Open/In process) fließen nie ein', () => {
		const tasks: TaskFixture[] = [
			{ status: 'Open', estimatedEffort: 5, pillars: [{ pillarId: 1, share: 100 }], zeitpunkt: null },
			{ status: 'In process', estimatedEffort: 5, pillars: [{ pillarId: 2, share: 100 }], zeitpunkt: null },
		];
		const verlauf = berechneBalanceVerlauf(saeulen, tasks, '2026-06-01', '2026-06-01', 'UTC');
		assert.equal(verlauf[0].hatPunkte, false);
	});
});
