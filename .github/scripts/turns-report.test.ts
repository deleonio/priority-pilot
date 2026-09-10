import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderTurnReport, turnTotals } from './turns-report.ts';
import type { CostEntry } from './cost-record.ts';

/**
 * Der Turn-Report ist die Grundlage der Abo-Betrachtung — falsch gemittelt fällt das
 * niemandem auf, die Zahl sieht nur plausibel aus. Geprüft werden deshalb die still
 * falschen Fälle: Alt-Läufe ohne `turns` dürfen weder als „0" erscheinen noch die
 * Durchschnitte verdünnen (Kern-Akzeptanzkriterium von Issue #1197), die Schleifen-Raten
 * brauchen eine Bezugsgröße, und die Wochen-Zuordnung entscheidet sich in Berliner Zeit.
 *
 * Seit dem Vollständigkeits-Filter gilt zusätzlich: UNVOLLSTÄNDIGE Tickets (Fixup-Beine
 * ohne implement, abgebrochene ohne documenter) dürfen in KEINER Kennzahl auftauchen —
 * sie blähen sonst genau die Schleifen-Raten auf, nach denen der Prompt-Audit priorisiert.
 * Fixtures brauchen deshalb implement + documenter, um zu zählen.
 */

const entry = (over: Partial<CostEntry> = {}): CostEntry => ({
	issueId: '1',
	timestamp: '2026-08-24T10:00:00Z',
	tokensIn: 1000,
	tokensOut: 100,
	cost: 0,
	...over,
});

const writeTicket = (dir: string, issue: string, entries: CostEntry[]): void =>
	writeFileSync(join(dir, `${issue}.json`), JSON.stringify(entries), 'utf8');

const inTmp = (name: string, run: (dir: string) => void): void => {
	const dir = mkdtempSync(join(tmpdir(), `${name}-`));
	try {
		run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

describe('turns-report', () => {
	it('summiert Turns je Ticket und Phase und sortiert die Turn-Fresser nach oben', () => {
		inTmp('turns-report-sum', (dir) => {
			writeTicket(dir, '100', [
				entry({ issueId: '100', phase: 'implement', turns: 10 }),
				entry({ issueId: '100', phase: 'review', turns: 5, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '100', phase: 'documenter', turns: 3, timestamp: '2026-08-24T12:00:00Z' }),
			]);
			// abgebrochen (kein documenter) — bleibt in turnTotals sichtbar, fliegt aus dem Report
			writeTicket(dir, '200', [entry({ issueId: '200', phase: 'analyse', turns: 40 })]);

			const { tickets, measured } = turnTotals(dir);
			assert.deepEqual(
				tickets.map((t) => t.issue),
				['200', '100'],
				'turnTotals sortiert die meisten Turns zuerst — der Report filtert dann auf Vollständige',
			);
			assert.equal(tickets[1].turns, 18);
			assert.deepEqual(tickets[1].phases, ['implement:10', 'review:5', 'documenter:3']);
			assert.equal(measured.length, 4);

			const report = renderTurnReport(dir, { interventions: [] });
			assert.match(report, /\| implement \| 1 \| 1 \| 10 \| 10,0 \| 10,0 \|/);
			assert.match(report, /\| Ø Turns je Lauf \(alle Läufe\) \| 6,0 \|/, '18 Turns über 3 messende Läufe');
			assert.match(report, /\| Turns je Ticket Pipeline — Median \| 18 \|/, 'nur das vollständige Ticket zählt');
			assert.match(report, /Ausgeschlossen \(unvollständig[^)]*\): 1 Tickets — 0 Fixup-Beine, 1 abgebrochen/);
			assert.doesNotMatch(report, /\[#200\]/, 'das abgebrochene Ticket steht nicht in der Auswertung');
		});
	});

	it('schließt Fixup-Beine aus (fixup nach dem Siegel) — extern umgesetzte Erstdurchläufe zählen als eigene Herkunft', () => {
		inTmp('turns-report-bein', (dir) => {
			writeTicket(dir, '900', [
				entry({ issueId: '900', phase: 'implement', turns: 10 }),
				entry({ issueId: '900', phase: 'documenter', turns: 3, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			// Fixup-Bein: Nacharbeit NACH dem Siegel, kein implement
			writeTicket(dir, '901', [
				entry({ issueId: '901', phase: 'documenter', turns: 2 }),
				entry({ issueId: '901', phase: 'fixup', turns: 99, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '901', phase: 'review', turns: 9, timestamp: '2026-08-24T12:00:00Z' }),
			]);
			// extern umgesetzt: review → fixup → Siegel ohne implement — vollständig, Herkunft extern
			writeTicket(dir, '902', [
				entry({ issueId: '902', phase: 'review', turns: 5 }),
				entry({ issueId: '902', phase: 'fixup', turns: 7, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '902', phase: 'documenter', turns: 1, timestamp: '2026-08-24T12:00:00Z' }),
			]);
			const report = renderTurnReport(dir, { interventions: [] });
			assert.match(report, /2 vollständige Tickets \(1 Pipeline · 1 extern\)/);
			assert.match(report, /Ausgeschlossen \(unvollständig[^)]*\): 1 Tickets — 1 Fixup-Beine, 0 abgebrochen/);
			assert.match(
				report,
				/\| Turns je Ticket Pipeline — Median \| 13 \|/,
				'10+3 — die 110 Turns des Beins zählen nicht',
			);
			assert.match(
				report,
				/\| Turns je Ticket extern — Median \| 13 \|/,
				'5+7+1 — das externe Ticket hat seine eigene Zeile',
			);
			assert.match(
				report,
				/Fixup ÷ Implement \| 0,00 \| 0,00 \|/,
				'weder das Bein noch der externe fixup-Lauf trägt in die Pipeline-Rate ein — Bezugsgröße implement bleibt',
			);
			assert.match(
				report,
				/\| extern umgesetzt \(Review-only\) \| 1 \| 1 \| 1\/1 = 100 % \|/,
				'Herkunfts-Tabelle zählt den externen Fixup',
			);
		});
	});

	it('zeigt Läufe ohne turns-Feld als „—", nicht als 0 — und mittelt sie nicht mit', () => {
		inTmp('turns-report-legacy', (dir) => {
			writeTicket(dir, '300', [
				entry({ issueId: '300', phase: 'implement', turns: 20 }),
				entry({ issueId: '300', phase: 'documenter', turns: 4, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			writeTicket(dir, '400', [
				entry({ issueId: '400', phase: 'implement', turns: 12 }),
				entry({ issueId: '400', phase: 'review' }), // Altlauf vor #984, kein turns-Feld
				entry({ issueId: '400', phase: 'documenter', turns: 2, timestamp: '2026-08-24T12:00:00Z' }),
			]);

			const report = renderTurnReport(dir, { interventions: [] });
			assert.match(report, /4 von 5 Läufen \(80 %\) haben Turns erfasst/);
			assert.match(
				report,
				/\| \[#400\]\([^)]+\) \| vollständig \| 3 \| 14 \| 7,0 \|/,
				'Klasse + Turns, Altlauf hebt den Ø',
			);
			assert.match(
				report,
				/\| Ø Turns je Lauf \(alle Läufe\) \| 9,5 \|/,
				'38 Turns über 4 messende Läufe — ohne die 5 Messlücken',
			);
			assert.match(report, /1 Lauf ohne `turns`-Feld/);
			assert.doesNotMatch(
				report,
				/\| review \|/,
				'eine Phase ganz ohne Messung taucht in der Phasen-Tabelle nicht auf',
			);
		});
	});

	it('meldet fehlende Vollständigkeit offen, statt eine leere Tabelle zu rendern', () => {
		inTmp('turns-report-empty', (dir) => {
			writeTicket(dir, '500', [entry({ issueId: '500', phase: 'review', turns: 7 })]);
			const report = renderTurnReport(dir, { interventions: [] });
			assert.match(report, /Keine vollständigen Datensätze/);
			assert.doesNotMatch(report, /Ø Turns je Lauf/, 'ohne vollständige Tickets gibt es nichts zu mitteln');
		});
	});

	it('rechnet die Schleifen-Raten in Turns UND Läufen — ohne implement-Bezug „—"', () => {
		inTmp('turns-report-loops', (dir) => {
			writeTicket(dir, '600', [
				entry({ issueId: '600', phase: 'implement', turns: 10 }),
				entry({ issueId: '600', phase: 'implement', turns: 10, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '600', phase: 'fixup', turns: 30, timestamp: '2026-08-24T12:00:00Z' }),
				entry({ issueId: '600', phase: 'review', turns: 5, timestamp: '2026-08-24T13:00:00Z' }),
				entry({ issueId: '600', phase: 'review', turns: 5, timestamp: '2026-08-24T14:00:00Z' }),
				entry({ issueId: '600', phase: 'review', turns: 10, timestamp: '2026-08-24T15:00:00Z' }),
				entry({ issueId: '600', phase: 'documenter', turns: 3, timestamp: '2026-08-24T16:00:00Z' }),
			]);
			const report = renderTurnReport(dir, { interventions: [] });
			// Fixup: 30 Turns gegen 20 (1,50) in nur 1 von 2 Läufen (0,50) — genau der Fall,
			// den eine einzelne Rate verwechselt: seltener, aber teurer als die Erstumsetzung.
			assert.match(report, /\| Fixup ÷ Implement \| 1,50 \| 0,50 \|/);
			assert.match(report, /\| Review ÷ Implement \| 1,00 \| 1,50 \|/);
		});
	});

	it('sieht review-Runs abgebrochener Tickets als nicht vorhanden — kein falsches „—"', () => {
		inTmp('turns-report-noimpl', (dir) => {
			writeTicket(dir, '701', [
				entry({ issueId: '701', phase: 'implement', turns: 14 }),
				entry({ issueId: '701', phase: 'documenter', turns: 2, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			// 700 ist abgebrochen (kein documenter): sein review-Lauf darf die Bezugsgröße
			// nicht kaputt machen — die Rate ist 0, nicht „—" und nicht 0,5.
			writeTicket(dir, '700', [entry({ issueId: '700', phase: 'review', turns: 7 })]);
			const report = renderTurnReport(dir, { interventions: [] });
			assert.match(report, /\| Review ÷ Implement \| 0,00 \| 0,00 \|/);
		});
	});

	it('bucketet den Wochen-Trend in Berliner Zeit und ordnet Erstgrün der Abschlusswoche zu', () => {
		inTmp('turns-report-week', (dir) => {
			writeTicket(dir, '800', [
				entry({ issueId: '800', phase: 'implement', turns: 4, timestamp: '2026-09-02T21:00:00Z' }), // Mi, W36
				entry({ issueId: '800', phase: 'review', turns: 6, timestamp: '2026-09-06T23:00:00Z' }), // So 23:00 UTC = Mo, W37
				entry({ issueId: '800', phase: 'documenter', turns: 2, timestamp: '2026-09-07T10:00:00Z' }), // Mo, W37 (Abschluss)
			]);
			const report = renderTurnReport(dir, { interventions: [] });
			assert.match(
				report,
				/\| 2026-W36 \| 1 \| 4 \| 4,0 \| 0 % \| 0 % \|/,
				'Lauf-Woche W36: ein implement-Lauf, kein Loop-Anteil',
			);
			assert.match(
				report,
				/\| 2026-W37\* \| 2 \| 8 \| 4,0 \| 75 % \| 0 % \|/,
				'Sonntag 23:00 UTC ist in Berlin schon Montag (W37); laufende Woche markiert',
			);
			assert.match(
				report,
				/\| 2026-W37\* \| 1† \/ 0 \| — \| — \| — \| — \| 1\/1 = 100 % \|/,
				'Erstgrün zählt in der Abschlusswoche — unter Annahme der Startwoche stünde es in W36; n = 1 ist zu klein für Median und Intervall',
			);
			assert.doesNotMatch(report, /\| 2026-W36 \| 0 \/ 0/, 'W36 hat keine Kohorte und bekommt keine Kohorten-Zeile');
			assert.match(report, /x-axis \["2026-W36", "2026-W37\*"\]/);
		});
	});

	it('vergleicht je Intervention die Pipeline-Tickets davor und danach — mit Intervall, ohne Test', () => {
		inTmp('turns-report-intervention', (dir) => {
			// 6 Tickets vor dem 01.09. (Median 100 Turns, 3/6 grün), 6 danach (Median 50, 6/6 grün);
			// ein externes Ticket danach darf die Pipeline-Sicht nicht verwässern.
			const mk = (issue: string, day: string, turns: number, fixup: boolean): void =>
				writeTicket(dir, issue, [
					entry({ issueId: issue, phase: 'implement', turns, valueCost: turns / 10, timestamp: `${day}T08:00:00Z` }),
					...(fixup ? [entry({ issueId: issue, phase: 'fixup', turns: 1, timestamp: `${day}T09:00:00Z` })] : []),
					entry({ issueId: issue, phase: 'documenter', turns: 1, timestamp: `${day}T10:00:00Z` }),
				]);
			for (let i = 0; i < 6; i++) mk(`1${i}`, `2026-08-2${i + 1}`, 100 + i, i % 2 === 0);
			for (let i = 0; i < 6; i++) mk(`2${i}`, `2026-09-0${i + 1}`, 50 + i, false);
			writeTicket(dir, '99', [
				entry({ issueId: '99', phase: 'review', turns: 999, timestamp: '2026-09-02T08:00:00Z' }),
				entry({ issueId: '99', phase: 'documenter', turns: 1, timestamp: '2026-09-02T10:00:00Z' }),
			]);
			const report = renderTurnReport(dir, {
				interventions: [
					{ date: '2026-09-01', label: 'Severity-Gating', issue: 1234 },
					{ date: '2026-08-01', label: 'zu früh', issue: null },
				],
			});
			assert.match(
				report,
				/\| 2026-09-01 \| Severity-Gating \(#1234\) \| 6\/6 \| 104 → 54 ↓ 48 % \| \$10\.30 → \$5\.30 ↓ 49 % \| 3\/6 = 50 % → 6\/6 = 100 % \| 2 h → 2 h → \|/,
				'Median je Seite (unteres Element), Erstgrün als k/n ohne Intervall unter n = 8, Lead-Time unverändert',
			);
			assert.match(
				report,
				/\| 2026-08-01 \| zu früh \| 0\/12 \| — \| — \| — \| — \|/,
				'ohne 5 Tickets auf einer Seite kein Vergleich',
			);
			assert.match(
				report,
				/\| First-Pass-Grün Pipeline \(kein Fixup\) \| 9\/12 = 75 % \(47–91 %\) \|/,
				'Wilson-Intervall ab n ≥ 8',
			);
		});
	});
});
