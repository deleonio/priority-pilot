import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderAuditBasis } from './audit-basis.ts';
import type { CostEntry } from './cost-record.ts';

/**
 * Die KOSTEN-BASIS ist Schritt 1 des Prompt-Audits (.github/prompts/prompt-audit.md): Aus
 * 140+ Dateien wird EINE Turn-Aussage, nach der der Audit seine Funde priorisiert. Falsch
 * summiert oder falsch gemittelt fällt still aus — die Tabelle sieht immer plausibel aus.
 * Geprüft werden deshalb die Rechenlogik (Turn-Summen je Phase und gesamt, Ausschluss der
 * Läufe ohne `turns`-Feld aus Ø-Werten) UND der Vollständigkeits-Filter: Fixup-Beine und
 * abgebrochene Tickets dürfen die Schleifen-Raten nicht aufblähen — genau daran hängt die
 * NET-Ersparnis-Skalierung des Audits.
 */

const entry = (over: Partial<CostEntry> = {}): CostEntry => ({
	issueId: '1',
	timestamp: '2026-08-24T10:00:00Z',
	tokensIn: 1000,
	tokensOut: 100,
	cost: 1,
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

describe('audit-basis', () => {
	it('summiert Turns, Token und $ je Phase in einer Tabelle', () => {
		inTmp('audit-basis-sum', (dir) => {
			writeTicket(dir, '100', [
				entry({ issueId: '100', phase: 'implement', turns: 10, tokensIn: 2_000_000, tokensOut: 5_000, cost: 2 }),
				entry({
					issueId: '100',
					phase: 'review',
					turns: 5,
					tokensIn: 1_000_000,
					tokensOut: 2_000,
					cost: 1,
					timestamp: '2026-08-24T11:00:00Z',
				}),
			]);
			const out = renderAuditBasis(dir);
			assert.match(out, /\| implement \| 1 \| 1 \| 10 \| 10 \| 2 \| 5 \| 2\.00 \|/);
			assert.match(
				out,
				/\| \*\*Gesamt\*\* \| \*\*2\*\* \| \*\*1\*\* \| \*\*15\*\* \| \*\*7,5\*\* \| \*\*3\*\* \| \*\*7\*\* \| \*\*3\.00\*\* \|/,
			);
			assert.match(out, /Cache-Read-Anteil am Input: 0 %/);
		});
	});

	it('schließt Läufe ohne turns-Feld aus Turn-Ø aus, zeigt sie aber in Runs/$', () => {
		inTmp('audit-basis-legacy', (dir) => {
			writeTicket(dir, '300', [
				entry({ issueId: '300', phase: 'implement', turns: 20 }),
				entry({ issueId: '300', phase: 'review', cost: 5 }), // Altlauf vor #984, kein turns-Feld
			]);
			const out = renderAuditBasis(dir);
			assert.match(out, /\| review \| 1 \| 1 \| 0 \| — \| .* \| .* \| 5\.00 \|/);
			assert.match(out, /Ø T\/Run/);
			assert.match(out, /1 von 2 Läufen ohne turns-Feld/);
		});
	});

	it('filtert Fixup-Beine aus den Schleifen-Raten — sie sind keine Erstumsetzungen', () => {
		inTmp('audit-basis-filter', (dir) => {
			// vollständiges Ticket MIT Fixup (1 fixup, 2 review)
			writeTicket(dir, '600', [
				entry({ issueId: '600', phase: 'implement', turns: 10 }),
				entry({ issueId: '600', phase: 'review', turns: 5, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '600', phase: 'fixup', turns: 8, timestamp: '2026-08-24T12:00:00Z' }),
				entry({ issueId: '600', phase: 'review', turns: 4, timestamp: '2026-08-24T13:00:00Z' }),
				entry({ issueId: '600', phase: 'documenter', turns: 3, timestamp: '2026-08-24T14:00:00Z' }),
			]);
			// vollständiges Ticket OHNE Fixup (first-pass-grün)
			writeTicket(dir, '601', [
				entry({ issueId: '601', phase: 'implement', turns: 10 }),
				entry({ issueId: '601', phase: 'review', turns: 5, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '601', phase: 'documenter', turns: 3, timestamp: '2026-08-24T12:00:00Z' }),
			]);
			// Fixup-Bein: 5 fixup-Runs OHNE implement — darf die Rate nicht aufblähen
			writeTicket(dir, '602', [
				entry({ issueId: '602', phase: 'fixup', turns: 30 }),
				entry({ issueId: '602', phase: 'fixup', turns: 30, timestamp: '2026-08-24T11:00:00Z' }),
				entry({ issueId: '602', phase: 'fixup', turns: 30, timestamp: '2026-08-24T12:00:00Z' }),
				entry({ issueId: '602', phase: 'fixup', turns: 30, timestamp: '2026-08-24T13:00:00Z' }),
				entry({ issueId: '602', phase: 'fixup', turns: 30, timestamp: '2026-08-24T14:00:00Z' }),
				entry({ issueId: '602', phase: 'review', turns: 5, timestamp: '2026-08-24T15:00:00Z' }),
				entry({ issueId: '602', phase: 'documenter', turns: 3, timestamp: '2026-08-24T16:00:00Z' }),
			]);
			// abgebrochen: kein documenter
			writeTicket(dir, '603', [entry({ issueId: '603', phase: 'implement', turns: 7 })]);

			const out = renderAuditBasis(dir);
			// 2 vollständige, 1 Bein, 1 abgebrochen
			assert.match(out, /Vollständigkeit: 2 vollständig · 1 Fixup-Beine · 1 abgebrochen · 0 sonstige/);
			// Fixup÷Implement nur über vollständige: 1÷2 = 0,5 — OHNE Filter stünden 6÷3 = 2
			assert.match(out, /Fixup÷Implement = 1÷2 = 0,5/);
			// Review÷Implement: 3 review-Runs vollständiger ÷ 2 implement = 1,5
			assert.match(out, /Review÷Implement = 3÷2 = 1,5/);
			// First-Pass: 1 von 2 ohne Fixup
			assert.match(out, /First-Pass-Grün \(kein Fixup\) = 1\/2 \(50 %\)/);
			assert.match(out, /Ø Fixup-Läufe je nachbearbeitetem = 1/);
		});
	});

	it('meldet leere Verzeichnisse offen statt zu crashen', () => {
		inTmp('audit-basis-empty', (dir) => {
			const out = renderAuditBasis(dir);
			assert.match(out, /Keine Datensätze unter/);
		});
	});
});
