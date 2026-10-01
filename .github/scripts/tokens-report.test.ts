import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { classifyTicket, loadGoals, renderFocusReport, renderReport, ticketTotals } from './tokens-report.ts';
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
			assert.match(report, /1 vollständige Tickets \(1 Pipeline · 0 extern\) · 3 Läufe/);
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
				/\| 2026-W53\*? \| 1 \| \$1\.00 \|[^|]*\| — \| — \| — \|/,
				'der 1.1.2027 gehört noch zur W53 von 2026 — ein Fehler am Jahreswechsel verschiebt die ganze Wochen-Tabelle (nur messende Läufe zählen, die wertlosen implement/documenter-Einträge nicht; eine Zeile zwischen Wert und Provider-Zellen = Δ-Soll-Spalte)',
			);
			assert.match(
				report,
				/\| 2026-W53\* \| 1† \/ 0 \| — \|/,
				'Kohorte = Abschlusswoche des Siegels; n = 1 ist zu klein für einen Median',
			);
			assert.match(report, /█{10} 100 %/, 'voller Anteil = 10 gefüllte Balken-Zeichen');
			assert.match(report, /stehen für 100 % des Gesamtwerts/);
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
			assert.match(report, /\| 2026-W36 \| 2 \| \$3\.00 \|/, 'beide Berlin-Tage liegen in derselben ISO-Woche');
			assert.match(
				report,
				/\| 2026-W37\* \| 1 \| \$3\.00 \|/,
				'Sonntag 23:00 UTC ist in Berlin schon Montag und damit W37 — unter UTC-Woche stünde W36 (der wertlose documenter-Lauf zählt nicht als messend); die laufende Woche trägt den Stern',
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

	it('schliesst unvollstaendige Tickets aus allen Kennzahlen aus und listet sie einzeln', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-filter-'));
		try {
			// vollstaendig: zahlt
			writeTicket(dir, '910', [
				entry({ issueId: '910', phase: 'implement', valueCost: 4, turns: 10 }),
				entry({ issueId: '910', phase: 'documenter', valueCost: 1, turns: 2, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			// Fixup-Bein (kein implement, fixup NACH dem Siegel): 100 $ duerfen den Ticket-OE nicht halbieren
			writeTicket(dir, '911', [
				entry({ issueId: '911', phase: 'documenter', valueCost: 1, turns: 3 }),
				entry({ issueId: '911', phase: 'fixup', valueCost: 100, turns: 50, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			// abgebrochen (kein documenter): reale Kosten, kein abgeschlossener Durchlauf
			writeTicket(dir, '912', [entry({ issueId: '912', phase: 'implement', valueCost: 7, turns: 9 })]);
			const report = renderReport(dir);
			assert.match(report, /1 vollständige Tickets \(1 Pipeline · 0 extern\) · 2 Läufe/);
			assert.match(report, /### Ausgeschlossene Tickets — nicht in Kennzahlen enthalten \(2\)/);
			assert.match(report, /\[#911\]\([^)]*\) \| Fixup-Bein \| 2 \| 53 \| \$101\.00 \|/);
			assert.match(report, /\[#912\]\([^)]*\) \| abgebrochen \| 1 \| 9 \| \$7\.00 \|/);
			assert.match(report, /3 Läufe · 62 Turns · \$108\.00 Wert/);
			const hauptTabelle = report.slice(0, report.indexOf('### Ausgeschlossene Tickets'));
			assert.doesNotMatch(
				hauptTabelle,
				/\[#91[12]\]/,
				'ausgeschlossene Tickets stehen nur in der Exklusions-Sektion, nicht in der Ticket-Tabelle',
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('Fokus-Modus: listet die Läufe der gewählten Tickets und vergleicht sie je Phase mit dem Rest', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-fokus-'));
		try {
			// Fokus-Ticket: ein documenter-Lauf auf „freiem" Modell (valueCost 0) neben einem
			// implement-Lauf mit Bewertung — genau der Setup-Vergleich ist der Anwendungsfall.
			writeTicket(dir, '920', [
				entry({
					issueId: '920',
					phase: 'documenter',
					model: 'openrouter/nemotron-3-nano',
					provider: 'openrouter',
					turns: 8,
					valueCost: 0,
				}),
				entry({
					issueId: '920',
					phase: 'implement',
					model: 'claude-opus',
					provider: 'claude',
					turns: 30,
					valueCost: 9,
					timestamp: '2026-08-24T11:00:00Z',
				}),
			]);
			// Rest: zwei documenter-Läufe anderer Tickets (inkl. unvollständiger Tickets —
			// im Fokus-Modus zählt der Lauf, nicht die Ticket-Kohorte).
			writeTicket(dir, '921', [
				entry({ issueId: '921', phase: 'documenter', turns: 20, valueCost: 4 }),
				entry({ issueId: '921', phase: 'documenter', turns: 30, valueCost: 6, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			const report = renderFocusReport(dir, ['920', '999']);
			assert.match(report, /## 🔎 Fokus-Report — #920, #999/);
			assert.match(report, /Keine Daten für: #999/);
			assert.match(
				report,
				/\| \[#920\]\([^)]*\) \| documenter \| .* \| openrouter\/nemotron-3-nano \| openrouter \| 8 \|/,
			);
			assert.match(
				report,
				/\| documenter \| 1 \| \$0\.00 \| 8,0 \| 0,00 \| 2 \| \$5\.00 \| 25,0 \| 0,20 \|/,
				'Ø Wert schließt 0-Werte ein (:free-Modell), Rest zählt Läufe unabhängig von der Ticket-Vollständigkeit',
			);
			assert.doesNotMatch(report, /Token- & Kosten-Übersicht/, 'Fokus-Modus ersetzt den Wochen-Report');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('Ampel-Trend: Wochen als Spalten, 🟢/🟡/🔴 je Zelle gegen die Vorwoche', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-ampel-'));
		try {
			writeTicket(dir, '930', [
				// W35: analyse $1, review $2 — W36: analyse $2 (🔴 teurer), review $1 (🟢 billiger)
				entry({ issueId: '930', phase: 'analyse', valueCost: 1, timestamp: '2026-08-24T10:00:00Z' }),
				entry({ issueId: '930', phase: 'review', valueCost: 2, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '930', phase: 'documenter', timestamp: '2026-08-24T12:00:00Z' }),
				entry({ issueId: '930', phase: 'analyse', valueCost: 2, timestamp: '2026-08-31T10:00:00Z' }),
				entry({ issueId: '930', phase: 'review', valueCost: 1, timestamp: '2026-08-31T11:00:00Z' }),
				entry({ issueId: '930', phase: 'documenter', timestamp: '2026-08-31T12:00:00Z' }),
			]);
			const report = renderReport(dir);
			assert.match(report, /### Ampel-Trend — Ø Wert je Run, gegen Vorwoche/);
			assert.match(report, /\| analyse \| · \$1\.00 \| 🔴 \$2\.00 \|/, 'Anstieg ≥ 10 % = rot');
			assert.match(report, /\| review \| · \$2\.00 \| 🟢 \$1\.00 \|/, 'Rückgang ≥ 10 % = grün');
			assert.match(report, /\| \*\*Alle Phasen\*\* \| · \$1\.50 \| 🟡 \$1\.50 \|/, '±10 % = gelb (Geld bleibt)');
			assert.match(report, /W35 \| W36/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('Status-Dashboard und Wochen-Änderungsbericht: Ziele und Siegelwoche auf einen Blick', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-status-'));
		try {
			writeTicket(dir, '940', [
				entry({ issueId: '940', phase: 'implement', valueCost: 2, timestamp: '2026-08-24T09:00:00Z' }),
				entry({ issueId: '940', phase: 'documenter', timestamp: '2026-08-24T10:00:00Z' }),
			]);
			const report = renderReport(dir);
			// Status-Dashboard: nur die Ziel-KPIs — Pipeline-Kosten unter Ziel = 🟢, die übrigen
			// Ziele ohne Daten (kein Review/Cache/Modell/Turns in den Fixtures) bleiben „—"
			// (8 Ziel-Zeilen: Review-Runden je Herkunft, Turns- und Erstgrün-Ziel ohne Fenster)
			assert.match(report, /### Status — Ziele auf einen Blick/);
			assert.match(report, /\*\*1 von 8 Zielen erfüllt\*\*/);
			assert.match(report, /\| Kosten je Ticket Pipeline — Median \(messende\) \| \$2\.00 \| <= \$3\.00 \|.*🟢 \|/);
			// Änderungsbericht: Siegelwoche (laufende Woche mit „*") und das versiegelte Ticket
			assert.match(report, /### Was hat sich verändert — letzte Woche/);
			assert.match(report, /\*\*2026-W35\*: 1 Tickets versiegelt · \$2\.00 gesamt · \$2\.00 je Ticket\*\*/);
			assert.match(report, /\[#940\]\([^)]*\) \| Pipeline \| \$2\.00 \| über Median \(\$2\.00\) \|/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('Direktvergleich ab zwei Tickets: Kennzahlen mit Δ und Phasen nebeneinander', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-vergleich-'));
		try {
			writeTicket(dir, '920', [
				entry({ issueId: '920', phase: 'documenter', turns: 8, valueCost: 0 }),
				entry({ issueId: '920', phase: 'implement', turns: 30, valueCost: 9, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			writeTicket(dir, '921', [
				entry({ issueId: '921', phase: 'documenter', turns: 20, valueCost: 4 }),
				entry({ issueId: '921', phase: 'documenter', turns: 30, valueCost: 6, timestamp: '2026-08-24T11:00:00Z' }),
			]);
			const report = renderFocusReport(dir, ['920', '921']);
			assert.match(report, /### Direktvergleich/);
			assert.match(report, /\| Wert \(USD\) \| \$9\.00 \| \$10\.00 \| \+11,1 % \|/);
			assert.match(report, /\| Turns \| 38 \| 50 \| \+31,6 % \|/);
			assert.match(
				report,
				/\| implement \| \$9\.00 · 30 T · 0 Mio · — · — · — \| — \|/,
				'Phase, die nur das erste Ticket hat',
			);
			assert.match(
				report,
				/\| documenter \| \$0\.00 · 8 T · 0 Mio · — · — · — \| \$10\.00 · 50 T · 0 Mio · — · — · — \|/,
			);
			assert.match(
				report,
				/\| \*\*Summe\*\* \| \$9\.00 · 38 T · 0 Mio · — · — · — \| \$10\.00 · 50 T · 0 Mio · — · — · — \|/,
			);
			// Ohne Cache/MCP/Dauer-Felder bleiben nur die drei klassischen Charts übrig.
			assert.equal(report.match(/```mermaid/g)?.length, 3, 'drei xychart-Blöcke (Wert, Token, Turns)');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('N-Wege-Phasenvergleich: drei Tickets grafisch über Kosten, Token, Turns, Cache, MCP und Dauer', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-n-wege-'));
		try {
			writeTicket(dir, '900', [
				entry({
					issueId: '900',
					phase: 'analyse',
					turns: 10,
					valueCost: 2,
					cacheReadTokens: 800_000,
					cacheCreationTokens: 400_000,
					mcpCalls: 3,
					durationSeconds: 300,
				}),
				entry({
					issueId: '900',
					phase: 'review',
					turns: 5,
					valueCost: 1,
					cacheReadTokens: 600_000,
					mcpCalls: 1,
					durationSeconds: 120,
				}),
			]);
			writeTicket(dir, '901', [
				entry({
					issueId: '901',
					phase: 'analyse',
					turns: 20,
					valueCost: 4,
					cacheReadTokens: 1_000_000,
					mcpCalls: 7,
					durationSeconds: 90,
				}),
			]);
			writeTicket(dir, '902', [entry({ issueId: '902', phase: 'analyse', turns: 4, valueCost: 0.5 })]);
			const report = renderFocusReport(dir, ['900', '901', '902']);
			// Matrix: Cache, MCP und Dauer als eigene Zellanteile; #902 ohne Felder zeigt „—"
			assert.match(
				report,
				/\| analyse \| \$2\.00 · 10 T · [0-9,]+ Mio · 1,2 Mio C · 3 MCP · 5\.0 min \| \$4\.00 · 20 T · [0-9,]+ Mio · 1 Mio C · 7 MCP · 1\.5 min \| \$0\.50 · 4 T · [0-9,]+ Mio · — · — · — \|/,
			);
			// Sechs Kennzahlen als xychart, eine je Kennzahl; Balken je Phase nebeneinander
			// (Slot je Ticket + Ø-Slot), #902 ohne Felder bleibt als Serie nur in den
			// klassischen Charts — MCP/Dauer fahren ohne ihn (Serie ohne jeden Wert entfällt)
			assert.equal(report.match(/```mermaid/g)?.length, 6, 'sechs xychart-Blöcke, eine je Kennzahl');
			assert.match(
				report,
				/#### MCP-Calls je Phase[\s\S]*?bar "#900" \[3, 0, 0, 0, 1, 0, 0, 0\][\s\S]*?bar "#901" \[0, 7, 0, 0, 0, 0, 0, 0\][\s\S]*?bar "Ø \(3\)" \[0, 0, 0, 5, 0, 0, 0, 1\]/,
				'Ø je Phase nur über Tickets mit Daten',
			);
			assert.doesNotMatch(
				report,
				/#### MCP-Calls je Phase[\s\S]*?bar "#902"/,
				'Alt-Ticket ohne mcpCalls entfällt als Serie',
			);
			assert.match(
				report,
				/#### Dauer je Phase \(Minuten\)[\s\S]*?bar "#900" \[5\.0, 0\.0, 0\.0, 0\.0, 2\.0, 0\.0, 0\.0, 0\.0\][\s\S]*?bar "#901" \[0\.0, 1\.5, 0\.0, 0\.0, 0\.0, 0\.0, 0\.0, 0\.0\]/,
			);
			assert.match(
				report,
				/#### Turns je Phase[\s\S]*?bar "#900" \[10, 0, 0, 0, 5, 0, 0, 0\][\s\S]*?bar "#901" \[0, 20, 0, 0, 0, 0, 0, 0\][\s\S]*?bar "#902" \[0, 0, 4, 0, 0, 0, 0, 0\][\s\S]*?bar "Ø \(3\)" \[0, 0, 0, 11, 0, 0, 0, 5\]/,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('Kennzahl mit nur einem tragenden Ticket bekommt keinen Chart', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-einserie-'));
		try {
			writeTicket(dir, '910', [entry({ issueId: '910', phase: 'spec', turns: 3, valueCost: 1, mcpCalls: 2 })]);
			writeTicket(dir, '911', [entry({ issueId: '911', phase: 'spec', turns: 4, valueCost: 2 })]);
			const report = renderFocusReport(dir, ['910', '911']);
			assert.doesNotMatch(report, /#### MCP-Calls je Phase/, 'eine Serie allein ist kein Vergleich');
			assert.match(
				report,
				/\| spec \| \$1\.00 · 3 T · [0-9,]+ Mio · — · 2 MCP · — \| \$2\.00 · 4 T · [0-9,]+ Mio · — · — · — \|/,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('klassifiziert chronologisch: extern umgesetzte Erstdurchläufe sind vollständig, Nacharbeit nach dem Siegel ein Bein', () => {
		const at = (phase: string, hour: number, over: Partial<CostEntry> = {}): CostEntry =>
			entry({ phase, timestamp: `2026-08-24T${String(hour).padStart(2, '0')}:00:00Z`, ...over });
		assert.equal(classifyTicket([at('implement', 10), at('documenter', 12)]), 'vollstaendig');
		assert.equal(
			classifyTicket([at('review', 10), at('fixup', 11), at('documenter', 12)]),
			'extern-vollstaendig',
			'review → fixup → Siegel ohne implement ist ein extern umgesetzter PR, kein Fixup-Bein',
		);
		assert.equal(classifyTicket([at('review', 10), at('documenter', 12)]), 'extern-vollstaendig');
		assert.equal(
			classifyTicket([at('documenter', 10), at('fixup', 11), at('documenter', 12)]),
			'fixup-bein',
			'fixup erst nach dem ersten Siegel = Nacharbeit eines versiegelten Tickets',
		);
		assert.equal(
			classifyTicket([at('team', 10), at('documenter', 12)]),
			'extern-vollstaendig',
			'ein lokaler Team-Lauf setzt das Ticket ausserhalb der Pipeline um — ohne diese Zeile fiele er als „sonstiges" aus jeder Auswertung',
		);
		assert.equal(classifyTicket([at('review', 10)]), 'abgebrochen');
		assert.equal(classifyTicket([at('analyse', 10), at('documenter', 12)]), 'sonstiges');
		assert.equal(
			classifyTicket([at('documenter', 12), at('review', 10), at('fixup', 11)]),
			'extern-vollstaendig',
			'Reihenfolge kommt aus den Zeitstempeln, nicht aus der Datei-Reihenfolge',
		);
	});

	it('rechnet Kohorten je Abschlusswoche und den Index gegen die Baseline je Herkunft', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-kohorte-'));
		try {
			// 5 Pipeline-Tickets in W35 (Kosten 1..5, Median 3), 5 in W36 (Kosten 2..10, Median 6);
			// ein W35-Ticket beginnt in W34 — sein ganzer Wert zählt in der Abschlusswoche W35.
			const mk = (issue: string, start: string, seal: string, vc: number): void =>
				writeTicket(dir, issue, [
					entry({ issueId: issue, phase: 'implement', valueCost: vc / 2, timestamp: start }),
					entry({ issueId: issue, phase: 'review', valueCost: vc / 2, timestamp: seal.replace('T12', 'T11') }),
					entry({ issueId: issue, phase: 'documenter', valueCost: 0, timestamp: seal }),
				]);
			mk('1', '2026-08-20T10:00:00Z', '2026-08-26T12:00:00Z', 1); // Start W34, Siegel W35
			for (let i = 2; i <= 5; i++) mk(String(i), '2026-08-25T10:00:00Z', `2026-08-2${i + 4}T12:00:00Z`, i);
			for (let i = 1; i <= 5; i++) mk(String(10 + i), '2026-09-01T10:00:00Z', `2026-09-0${i + 1}T12:00:00Z`, 2 * i);
			// ein externes Ticket in W36 — eigene Spalte, kein Einfluss auf den Pipeline-Median
			writeTicket(dir, '99', [
				entry({ issueId: '99', phase: 'review', valueCost: 50, timestamp: '2026-09-03T10:00:00Z' }),
				entry({ issueId: '99', phase: 'documenter', valueCost: 0, timestamp: '2026-09-03T12:00:00Z' }),
			]);
			const report = renderReport(dir, { baseline: '2026-W35' });
			assert.match(report, /Baseline 2026-W35 \(n=5\/0\)/, 'Baseline per Flag wählbar, n je Herkunft');
			assert.match(report, /\| 2026-W35 \| 5 \/ 0 \| \$3\.00 \| \$4\.00 \| 100 \| — \| \$3\.00 \| — \| — \|/);
			assert.match(
				report,
				/\| 2026-W36\* \| 5 \/ 1† \| \$6\.00 \| \$8\.00 \| 200 \| ↑ 100 % \| \$4\.00 \| — \| — \|/,
				'Median W36 = 6 → Index 200; Rolling über alle 10 Tickets (1,2,2,3,4,4,5,6,8,10) = 4; extern n=1 ist zu klein für einen Median',
			);
			assert.match(report, /bar "Kohorte" \[100, 200\]/, 'Index-Chart über die Pipeline-Kohorten');
			assert.match(report, /\| Kosten je Ticket Pipeline — Median \(messende\) \| \$4\.00 \| \$3\.00 \| 133 \|/);
			assert.match(
				report,
				/\| Kosten je Ticket extern — Median \(messende\) \| \$50\.00 \| — \| — \|/,
				'extern getrennt, ohne Baseline kein Index',
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('führt Turns- und Erstgrün-Ziel im Kennzahlen-Block (KPI 2+3 des Optimierungsplans)', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-kpi23-'));
		try {
			// #101 mit Fixup (15 Turns, kein Erstgrün), #102 first-pass (8 Turns)
			writeTicket(dir, '101', [
				entry({ issueId: '101', phase: 'implement', valueCost: 1, turns: 10 }),
				entry({ issueId: '101', phase: 'fixup', valueCost: 0.5, turns: 5, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '101', phase: 'documenter', timestamp: '2026-08-24T12:00:00Z' }),
			]);
			writeTicket(dir, '102', [
				entry({ issueId: '102', phase: 'implement', valueCost: 2, turns: 8 }),
				entry({ issueId: '102', phase: 'documenter', timestamp: '2026-08-24T12:00:00Z' }),
			]);
			const report = renderReport(dir, { interventions: [], goals: {} });
			assert.match(report, /\| Turns je Ticket Pipeline — Median \| 15 \|/);
			assert.match(report, /\| First-Pass-Grün Pipeline \(kein Fixup\) \| 1\/2 = 50 % \|.*steigend \|/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('stellt dem Wochenwert das Soll gegenüber und prognostiziert den Monat linear', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-budget-'));
		try {
			writeTicket(dir, '950', [
				entry({ issueId: '950', phase: 'implement', valueCost: 1, timestamp: '2026-09-02T10:00:00Z' }),
				entry({ issueId: '950', phase: 'review', valueCost: 2, timestamp: '2026-09-03T10:00:00Z' }),
				entry({ issueId: '950', phase: 'implement', valueCost: 2, timestamp: '2026-09-09T10:00:00Z' }),
				entry({ issueId: '950', phase: 'review', valueCost: 3, timestamp: '2026-09-10T10:00:00Z' }),
				entry({ issueId: '950', phase: 'documenter', timestamp: '2026-09-10T12:00:00Z' }),
			]);
			const report = renderReport(dir, { interventions: [], goals: { weeklyBudgetUsd: 3 } });
			// W36 = $3.00 (Soll erfüllt), W37 = $5.00 (rot über Soll) — laufende Woche trägt den Stern
			assert.match(report, /\| 2026-W36 \| 2 \| \$3\.00 \| \+\$0\.00 \|/);
			assert.match(report, /\| 2026-W37\* \| 2 \| \$5\.00 \| \+\$2\.00 🔴 \|/);
			// Monat bis dato $8.00 an 10 von 30 Tagen → Prognose $24.00 (Anker = jüngster messender Tag)
			assert.match(
				report,
				/\*\*Budget:\*\* Soll \$3\.00\/Woche · 2026-09 bis dato \$8\.00 · Prognose bei gleichem Tempo \$24\.00\/Monat\./,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('markiert Interventionstage im Trend-Chart und stellt Ø Wert je Run davor/danach', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tokens-report-iv-'));
		try {
			writeTicket(dir, '960', [
				entry({ issueId: '960', phase: 'review', valueCost: 1, timestamp: '2026-09-01T10:00:00Z' }),
				entry({ issueId: '960', phase: 'review', valueCost: 1, timestamp: '2026-09-01T11:00:00Z' }),
				entry({ issueId: '960', phase: 'review', valueCost: 2, timestamp: '2026-09-03T10:00:00Z' }),
				entry({ issueId: '960', phase: 'review', valueCost: 2, timestamp: '2026-09-04T10:00:00Z' }),
				entry({ issueId: '960', phase: 'documenter', timestamp: '2026-09-04T12:00:00Z' }),
			]);
			const report = renderReport(dir, {
				interventions: [{ date: '2026-09-03', label: 'Test-Intervention' }],
				goals: {},
			});
			assert.match(report, /x-axis \["09-01", "09-03\*", "09-04"\]/, 'Interventionstag trägt den Stern');
			assert.match(report, /### Interventionen — Ø Wert je Run, 7 Tage davor\/danach/);
			assert.match(report, /\| 2026-09-03 \| Test-Intervention \| 2\/2 \| \$1\.00 → \$2\.00 \| ↑ 100 % \|/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('liest Ziel-Dateien fehlertolerant: fehlende Datei = leere Ziele, Defaults gelten', () => {
		assert.deepEqual(loadGoals(join(tmpdir(), 'gibt-es-nicht-kosten-ziele.json')), {});
	});
});
