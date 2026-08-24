import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderReport, ticketTotals } from './costs-report.ts';
import type { CostEntry } from './cost-record.ts';

/**
 * Der Report ist die Stelle, an der 50 Dateien zu EINER Aussage werden — falsch
 * summiert bleibt unbemerkt. Deshalb prüft dieser Test die stillen Fehlerfälle:
 * verlorene Dateien, verlorene Turns und die falsche Sortierung (die Ausreisser
 * müssen OBEN stehen, sonst sieht niemand die Schleifen-Tickets).
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

describe('costs-report', () => {
	it('summiert je Ticket und sortiert absteigend nach Wert (Ausreisser zuerst)', () => {
		const dir = mkdtempSync(join(tmpdir(), 'costs-report-'));
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
		const dir = mkdtempSync(join(tmpdir(), 'costs-report-broken-'));
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
		const dir = mkdtempSync(join(tmpdir(), 'costs-report-md-'));
		try {
			writeTicket(dir, '300', [entry({ issueId: '300', phase: 'review', valueCost: 2 })]); // ohne turns
			const report = renderReport(dir);
			assert.match(report, /1 Tickets · 1 Läufe/);
			assert.match(report, /\| review \| 1 \| — \|/);
			assert.match(report, /vor der Turns-Erfassung/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
