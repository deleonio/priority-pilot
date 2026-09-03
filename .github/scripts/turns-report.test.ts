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
			]);
			writeTicket(dir, '200', [entry({ issueId: '200', phase: 'analyse', turns: 40 })]);

			const { tickets, measured } = turnTotals(dir);
			assert.deepEqual(
				tickets.map((t) => t.issue),
				['200', '100'],
				'die meisten Turns zuerst — sonst versinken die Schleifen-Tickets unten',
			);
			assert.equal(tickets[1].turns, 15);
			assert.deepEqual(tickets[1].phases, ['implement:10', 'review:5']);
			assert.equal(measured.length, 3);

			const report = renderTurnReport(dir);
			assert.match(report, /\| implement \| 1 \| 1 \| 10 \| 10,0 \| 10,0 \|/);
			assert.match(report, /\| Ø Turns je Lauf \| 18,3 \|/);
			assert.match(report, /\| Ø Turns je Ticket \| 27,5 \|/);
		});
	});

	it('zeigt Läufe ohne turns-Feld als „—", nicht als 0 — und mittelt sie nicht mit', () => {
		inTmp('turns-report-legacy', (dir) => {
			writeTicket(dir, '300', [entry({ issueId: '300', phase: 'implement', turns: 20 })]);
			writeTicket(dir, '400', [
				entry({ issueId: '400', phase: 'review' }), // Altlauf vor #984, kein turns-Feld
				entry({ issueId: '400', phase: 'fixup', timestamp: '2026-08-24T11:00:00Z' }),
			]);

			const { tickets } = turnTotals(dir);
			const alt = tickets.find((t) => t.issue === '400');
			assert.ok(alt);
			assert.equal(alt.measured, 0, 'ein Lauf ohne Feld ist ungemessen, nicht turn-frei');
			assert.equal(tickets[tickets.length - 1].issue, '400', 'ungemessene Tickets stehen am Ende');

			const report = renderTurnReport(dir);
			assert.match(report, /1 von 3 Läufen \(33,3 %\) haben Turns erfasst/);
			assert.match(report, /\| \[#400\]\([^)]+\) \| 2 \| — \| — \| — \| — \|/, 'Altdaten-Zeile zeigt durchgehend „—"');
			assert.match(report, /\| Ø Turns je Lauf \| 20,0 \|/, 'die zwei Altläufe dürfen den Ø nicht auf 6,7 drücken');
			assert.match(report, /2 Läufe ohne `turns`-Feld/);
			assert.doesNotMatch(
				report,
				/\| review \|/,
				'eine Phase ganz ohne Messung taucht in der Phasen-Tabelle nicht auf',
			);
		});
	});

	it('meldet fehlende Messung offen, statt eine leere Tabelle zu rendern', () => {
		inTmp('turns-report-empty', (dir) => {
			writeTicket(dir, '500', [entry({ issueId: '500', phase: 'review' })]);
			const report = renderTurnReport(dir);
			assert.match(report, /Kein einziger Lauf hat Turns erfasst/);
			assert.doesNotMatch(report, /Ø Turns je Lauf/, 'ohne Messwerte gibt es nichts zu mitteln');
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
			]);
			const report = renderTurnReport(dir);
			// Fixup: 30 Turns gegen 20 (1,50) in nur 1 von 2 Läufen (0,50) — genau der Fall,
			// den eine einzelne Rate verwechselt: seltener, aber teurer als die Erstumsetzung.
			assert.match(report, /\| Fixup ÷ Implement \| 1,50 \| 0,50 \|/);
			assert.match(report, /\| Review ÷ Implement \| 1,00 \| 1,50 \|/);
		});
	});

	it('gibt „—" statt einer Division durch 0, wenn keine implement-Läufe gemessen sind', () => {
		inTmp('turns-report-noimpl', (dir) => {
			writeTicket(dir, '700', [entry({ issueId: '700', phase: 'review', turns: 7 })]);
			const report = renderTurnReport(dir);
			assert.match(report, /\| Review ÷ Implement \| — \| — \|/);
		});
	});

	it('bucketet den Wochen-Trend in Berliner Zeit — Sonntag 23:00 UTC ist schon die Folgewoche', () => {
		inTmp('turns-report-week', (dir) => {
			writeTicket(dir, '800', [
				entry({ issueId: '800', phase: 'implement', turns: 4, timestamp: '2026-09-02T21:00:00Z' }), // Mi, W36
				entry({ issueId: '800', phase: 'review', turns: 6, timestamp: '2026-09-06T23:00:00Z' }), // So 23:00 UTC = Mo, W37
			]);
			const report = renderTurnReport(dir);
			assert.match(report, /\| 2026-W36 \| 1 \| 1 \| 4 \| 4,0 \| 4,0 \|/);
			assert.match(
				report,
				/\| 2026-W37 \| 1 \| 1 \| 6 \| 6,0 \| 6,0 \|/,
				'unter UTC-Woche stünde der Lauf noch in W36 — die ganze Trend-Tabelle verschöbe sich',
			);
			assert.match(report, /x-axis \["2026-W36", "2026-W37"\]/);
		});
	});

	it('zeigt die Phasen in Pipeline-Reihenfolge, unabhängig davon, wer zuerst gelaufen ist', () => {
		inTmp('turns-report-order', (dir) => {
			// Datei-/Zeitreihenfolge bewusst verdreht: repo-weit laufen Tickets parallel, das
			// erste Auftreten in den Daten ist also NICHT der Ablauf der Kette.
			writeTicket(dir, '810', [
				entry({ issueId: '810', phase: 'documenter', turns: 1 }),
				entry({ issueId: '810', phase: 'mentor', turns: 1, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '810', phase: 'implement', turns: 1, timestamp: '2026-08-24T12:00:00Z' }),
				entry({ issueId: '810', phase: 'analyse', turns: 1, timestamp: '2026-08-24T13:00:00Z' }),
			]);
			const report = renderTurnReport(dir);
			const table = report.slice(report.indexOf('### Turns je Phase'), report.indexOf('### Wochen-Trend'));
			assert.deepEqual(
				[...table.matchAll(/^\| (\w+) \| \d/gm)].map((m) => m[1]),
				['analyse', 'implement', 'documenter', 'mentor'],
				'unbekannte/Neben-Phasen (mentor) hängen hinten an, die Kette bleibt lesbar',
			);
		});
	});

	it('überspringt kaputte Dateien, statt den Report zu verlieren', () => {
		inTmp('turns-report-broken', (dir) => {
			writeTicket(dir, '900', [entry({ issueId: '900', phase: 'implement', turns: 3 })]);
			writeFileSync(join(dir, 'kaputt.json'), '{ kein json', 'utf8');
			const report = renderTurnReport(dir);
			assert.match(report, /1 Tickets · 1 Läufe · 3 Turns/);
			assert.match(report, /1 Datei\(en\) nicht lesbar und übersprungen: kaputt\.json/);
		});
	});
});
