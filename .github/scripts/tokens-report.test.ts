import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderReport, ticketTotals } from './tokens-report.ts';
import type { CostEntry } from './cost-record.ts';

/**
 * Der Report ist die Stelle, an der 50 Dateien zu EINER Aussage werden — falsch
 * summiert bleibt unbemerkt. Deshalb prüft dieser Test die stillen Fehlerfälle:
 * verlorene Dateien, verlorene Turns und die falsche Sortierung (die Ausreisser
 * müssen OBEN stehen, sonst sieht niemand die Schleifen-Tickets) — plus die
 * Rechenlogik der neuen Darstellungsformen (ISO-Wochen-Grenze, Berlin-Tages-Grenze,
 * Richtungs-Schwelle, Fenster-Ausschluss, Anteils-Balken).
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

describe('tokens-report', () => {
	it('summiert je Ticket und sortiert absteigend nach Wert (Ausreisser zuerst)', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-'));
		try {
			writeTicket(dir, '100', [
				entry({ issueId: '100', phase: 'review', valueCost: 1, turns: 10 }),
				entry({ issueId: '100', phase: 'fixup', valueCost: 0.5, turns: 5, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			writeTicket(dir, '200', [entry({ issueId: '200', phase: 'analyse', valueCost: 10, turns: 3 })]);

			const { tickets } = ticketTotals(dir);
			assert.equal(tickets.length, 2);
			assert.deepEqual(
				tickets.map((t) => t.issue),
				['200', '100'],
				'höchster Wert zuerst — sonst verschwinden die Schleifen-Tickets unten',
			);
			assert.equal(tickets[1].runs, 2);
			assert.equal(tickets[1].turns, 15);
			assert.ok(Math.abs(tickets[1].valueCost - 1.5) < 1e-9);
			assert.deepEqual(tickets[1].phases, ['review:1', 'fixup:1']);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('überspringt kaputte Dateien, statt den Report zu verlieren', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-broken-'));
		try {
			writeTicket(dir, '100', [entry({ issueId: '100' })]);
			writeFileSync(join(dir, 'kaputt.json'), '{ kein json', 'utf8');
			const { tickets, skipped } = ticketTotals(dir);
			assert.equal(tickets.length, 1);
			assert.deepEqual(skipped, ['kaputt.json']);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('rendert Phasen-Summen und weist Altdaten ohne Turns offen aus', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-md-'));
		try {
			writeTicket(dir, '300', [
				entry({ issueId: '300', phase: 'implement' }), // wert- und turnlos — macht das Ticket vollständig
				entry({ issueId: '300', phase: 'review', valueCost: 2, timestamp: '2026-08-24T11:00:00Z' }), // ohne turns
				entry({ issueId: '300', phase: 'documenter', timestamp: '2026-08-24T12:00:00Z' }),
			]);
			const report = renderReport(dir);
			assert.match(report, /1 vollständige Tickets · 3 Läufe/);
			assert.match(report, /\| review \| 1 \| — \|/);
			assert.match(report, /vor der Turns-Erfassung/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('mappt den 1.1. auf die Vorjahres-Woche und zeigt Anteile als Balken', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-iso-'));
		try {
			writeTicket(dir, '500', [
				entry({ issueId: '500', phase: 'implement', timestamp: '2027-01-01T11:00:00Z' }),
				entry({ issueId: '500', phase: 'review', valueCost: 1, timestamp: '2027-01-01T12:00:00Z' }),
				entry({ issueId: '500', phase: 'documenter', timestamp: '2027-01-01T13:00:00Z' }),
			]);
			const report = renderReport(dir);
			assert.match(
				report,
				/\| 2026-W53 \| 1 \| 1 \| \$1\.00 \| \$1\.00 \|/,
				'der 1.1.2027 gehört noch zur W53 von 2026 — ein Fehler am Jahreswechsel verschiebt die ganze Wochen-Tabelle (nur messende Läufe zählen, die wertlosen implement/documenter-Einträge nicht)',
			);
			assert.match(report, /█{10} 100 %/, 'voller Anteil = 10 gefüllte Balken-Zeichen');
			assert.match(report, /Top 5 Tickets\*\* stehen für 100 % des Gesamtwerts/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('zählt Trend-Tage in Berlin-Lokalzeit — UTC-Abend gehört zum Berliner Folgetag', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-tz-'));
		try {
			writeTicket(dir, '800', [
				entry({ issueId: '800', phase: 'implement', valueCost: 1, timestamp: '2026-09-02T21:00:00Z' }), // 23:00 Berlin, 02.09.
				entry({ issueId: '800', phase: 'review', valueCost: 2, timestamp: '2026-09-02T23:00:00Z' }), // 01:00 Berlin, 03.09.
				// Sonntag 23:00 UTC = Montag 01:00 Berlin (07.09., W37) — unter UTC-Ableitung
				// stünde noch W36 (Sonntag 06.09.); genau diesen Unterschied pinnt der Test.
				entry({ issueId: '800', phase: 'fixup', valueCost: 3, timestamp: '2026-09-06T23:00:00Z' }),
				entry({ issueId: '800', phase: 'documenter', valueCost: 0, timestamp: '2026-09-07T05:00:00Z' }), // Mo, W37
			]);
			const report = renderReport(dir);
			assert.match(
				report,
				/x-axis \["09-02", "09-03", "09-07"\]/,
				'der 23:00-UTC-Lauf ist in Berlin schon der Folgetag — ein UTC-Slice würde ihn dem Vortag zuschlagen',
			);
			assert.match(report, /Zeitraum 2026-09-02 bis 2026-09-07/);
			assert.match(report, /\| 2026-W36 \| 2 \| 1 \|/, 'beide Berlin-Tage liegen in derselben ISO-Woche');
			assert.match(
				report,
				/\| 2026-W37 \| 1 \| 1 \|/,
				'Sonntag 23:00 UTC ist in Berlin schon Montag und damit W37 — unter UTC-Woche stünde W36 (der wertlose documenter-Lauf zählt nicht als messend)',
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('entscheidet die ±10-%-Schwelle an der rohen Änderung, nicht am gerundeten Prozentwert', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-richtung-'));
		try {
			const alt = (phase: string, hour: number): CostEntry =>
				entry({ issueId: '600', phase, valueCost: 1, timestamp: `2026-08-17T${hour}:00:00Z` }); // 10 Tage alt
			const neu = (phase: string, hour: number, vc: number): CostEntry =>
				entry({ issueId: '600', phase, valueCost: vc, timestamp: `2026-08-27T${hour}:00:00Z` }); // Anker-Tag
			writeTicket(dir, '600', [
				alt('review', 10),
				alt('review', 11),
				neu('review', 10, 1.0995), // roh +9,95 % → rundet auf „10 %“
				neu('review', 11, 1.0995),
				alt('implement', 12),
				alt('implement', 13),
				neu('implement', 12, 1.25),
				neu('implement', 13, 1.25),
				entry({ issueId: '600', phase: 'documenter', valueCost: 0, timestamp: '2026-08-27T14:00:00Z' }),
			]);
			const report = renderReport(dir);
			assert.match(report, /\| review \| \$1\.00 → \$1\.10 \| → \|/, '9,95 % ist „unter ±10 %“, nicht „↑ 10 %“');
			assert.match(report, /\| implement \| \$1\.00 → \$1\.25 \| ↑ 25 % \|/, 'die Pfeil-Richtung bleibt erhalten');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('lässt Einträge jenseits von 14 Tagen weg und zeigt Fenster mit < 2 Runs als „—“', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-fenster-'));
		try {
			writeTicket(dir, '700', [
				entry({ issueId: '700', phase: 'analyse', valueCost: 5, timestamp: '2026-08-07T10:00:00Z' }), // 20 Tage alt
				entry({ issueId: '700', phase: 'fixup', valueCost: 1, timestamp: '2026-08-27T10:00:00Z' }), // 1 Run im Fenster
				entry({ issueId: '700', phase: 'implement', valueCost: 0, timestamp: '2026-08-27T11:00:00Z' }),
				entry({ issueId: '700', phase: 'documenter', valueCost: 0, timestamp: '2026-08-27T12:00:00Z' }),
			]);
			const report = renderReport(dir);
			const richtung = report.slice(report.indexOf('### Richtung'), report.indexOf('> Anker ist der jüngste'));
			assert.ok(richtung.length > 0, 'Richtungs-Tabelle fehlt komplett');
			assert.doesNotMatch(richtung, /\| analyse \|/, '20-Tage-Eintrag liegt ausserhalb beider Fenster');
			assert.match(richtung, /\| fixup \| — → \$1\.00 \| — \|/, 'ein einzelner Run ist zu wenig für einen Trend');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('schliesst unvollstaendige Tickets aus allen Kennzahlen aus und nennt ihre Summe', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-filter-'));
		try {
			// vollstaendig: zahlt
			writeTicket(dir, '910', [
				entry({ issueId: '910', phase: 'implement', valueCost: 4, turns: 10 }),
				entry({ issueId: '910', phase: 'documenter', valueCost: 1, turns: 2, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			// Fixup-Bein (kein implement): 100 $ duerfen den Ticket-OE nicht halbieren
			writeTicket(dir, '911', [
				entry({ issueId: '911', phase: 'fixup', valueCost: 100, turns: 50 }),
				entry({ issueId: '911', phase: 'documenter', valueCost: 1, turns: 3, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			// abgebrochen (kein documenter): reale Kosten, kein abgeschlossener Durchlauf
			writeTicket(dir, '912', [entry({ issueId: '912', phase: 'implement', valueCost: 7, turns: 9 })]);
			const report = renderReport(dir);
			assert.match(report, /1 vollständige Tickets · 2 Läufe/);
			assert.match(report, /Ausgeschlossen \(unvollständig[^)]*\): 2 Tickets — 1 Fixup-Beine, 1 abgebrochen/);
			assert.match(report, /3 Läufe · 62 Turns · \$108\.00 Wert/);
			assert.doesNotMatch(report, /\[#91[12]\]/, 'ausgeschlossene Tickets stehen nicht in der Ticket-Tabelle');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
