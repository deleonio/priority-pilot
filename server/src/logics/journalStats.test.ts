import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneJournalFenster, fensterListe } from './journalStats.js';

/**
 * Vertrag der Journal-Statistik-Logik (#2213, docs/spec/issue-2213.md): reine Funktion ohne
 * DB-Zugriff (Muster `balanceHistory.ts`) — Tages-/Wochenfenster (Montag-Beginn, auf den
 * Zeitraum geschnitten) und Eintragszählung je Säule, ohne Säule und gesamt. Rot, bis
 * `journalStats.ts` existiert.
 */
describe('journalStats (#2213)', () => {
	describe('fensterListe', () => {
		it('AK1 — Granularität Tag: je Kalendertag genau ein Fenster, auch ohne Einträge', () => {
			assert.deepEqual(fensterListe('2026-10-01', '2026-10-03', 'tag'), [
				{ von: '2026-10-01', bis: '2026-10-01' },
				{ von: '2026-10-02', bis: '2026-10-02' },
				{ von: '2026-10-03', bis: '2026-10-03' },
			]);
		});

		it('AK2 — Granularität Woche: Montag-Beginn, Randwochen auf den Zeitraum geschnitten', () => {
			// 2026-09-30 ist ein Mittwoch, 2026-10-04 Sonntag, 2026-10-05 Montag.
			assert.deepEqual(fensterListe('2026-09-30', '2026-10-06', 'woche'), [
				{ von: '2026-09-30', bis: '2026-10-04' },
				{ von: '2026-10-05', bis: '2026-10-06' },
			]);
		});

		it('AK1 — von == bis: genau ein Fenster, auch wochenweise', () => {
			assert.deepEqual(fensterListe('2026-10-01', '2026-10-01', 'tag'), [{ von: '2026-10-01', bis: '2026-10-01' }]);
			assert.deepEqual(fensterListe('2026-10-01', '2026-10-01', 'woche'), [{ von: '2026-10-01', bis: '2026-10-01' }]);
		});
	});

	describe('berechneJournalFenster', () => {
		const saeulenIds = [1, 2];
		const eintraege = [
			{ date: '2026-10-01', pillarId: 1 },
			{ date: '2026-10-01', pillarId: 1 },
			{ date: '2026-10-01', pillarId: null },
			{ date: '2026-10-02', pillarId: 2 },
			{ date: '2026-09-20', pillarId: 1 }, // außerhalb des Zeitraums
		];

		it('AK1 — zählt je Säule, ohne Säule und gesamt; Säulen mit 0 bleiben gelistet', () => {
			assert.deepEqual(berechneJournalFenster(eintraege, saeulenIds, fensterListe('2026-10-01', '2026-10-02', 'tag')), [
				{
					von: '2026-10-01',
					bis: '2026-10-01',
					proSaeule: [
						{ pillarId: 1, anzahl: 2 },
						{ pillarId: 2, anzahl: 0 },
					],
					ohneSaeule: 1,
					gesamt: 3,
				},
				{
					von: '2026-10-02',
					bis: '2026-10-02',
					proSaeule: [
						{ pillarId: 1, anzahl: 0 },
						{ pillarId: 2, anzahl: 1 },
					],
					ohneSaeule: 0,
					gesamt: 1,
				},
			]);
		});

		it('AK2 — Wochensummen stimmen mit den Tagessummen überein', () => {
			const tage = fensterListe('2026-09-28', '2026-10-04', 'tag');
			const wochen = fensterListe('2026-09-28', '2026-10-04', 'woche');
			const tageweise = berechneJournalFenster(eintraege, saeulenIds, tage);
			const wochenweise = berechneJournalFenster(eintraege, saeulenIds, wochen);

			assert.equal(wochenweise.length, 1);
			const gesamt = tageweise.reduce((summe, fenster) => summe + fenster.gesamt, 0);
			const ohneSaeule = tageweise.reduce((summe, fenster) => summe + fenster.ohneSaeule, 0);
			const jeSaeule = saeulenIds.map((id) =>
				tageweise.reduce(
					(summe, fenster) => summe + (fenster.proSaeule.find((s) => s.pillarId === id)?.anzahl ?? 0),
					0,
				),
			);
			assert.equal(wochenweise[0]!.gesamt, gesamt);
			assert.equal(wochenweise[0]!.ohneSaeule, ohneSaeule);
			assert.deepEqual(
				wochenweise[0]!.proSaeule.map((s) => s.anzahl),
				jeSaeule,
			);
		});

		it('AK1 — leere Eingabeliste: alle Fenster mit 0', () => {
			assert.deepEqual(berechneJournalFenster([], saeulenIds, fensterListe('2026-10-01', '2026-10-02', 'tag')), [
				{
					von: '2026-10-01',
					bis: '2026-10-01',
					proSaeule: [
						{ pillarId: 1, anzahl: 0 },
						{ pillarId: 2, anzahl: 0 },
					],
					ohneSaeule: 0,
					gesamt: 0,
				},
				{
					von: '2026-10-02',
					bis: '2026-10-02',
					proSaeule: [
						{ pillarId: 1, anzahl: 0 },
						{ pillarId: 2, anzahl: 0 },
					],
					ohneSaeule: 0,
					gesamt: 0,
				},
			]);
		});
	});
});
