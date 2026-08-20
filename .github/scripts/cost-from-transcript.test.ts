import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { computeCost, lookupPrice, sumUsage, type Usage } from './cost-from-transcript.ts';
import { readCostRecords } from './cost-record.ts';

/**
 * Tests für die Token-Erfassung aus dem Sitzungstranskript.
 *
 * Schwerpunkt ist die Deduplizierung: Eine Assistant-Antwort steht als mehrere
 * JSONL-Zeilen mit IDENTISCHEM `message.usage` im Transkript. Ohne Dedup ist die
 * Kosten-Baseline um ein Vielfaches zu hoch — und eine falsche Baseline ist
 * schlimmer als keine, weil der Vorher/Nachher-Vergleich darauf aufbaut.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie check-phase-label.test.ts).
 */

const line = (over: Record<string, unknown> = {}, usage: Record<string, unknown> = {}): string =>
	JSON.stringify({
		type: 'assistant',
		timestamp: '2026-08-19T12:00:00.000Z',
		message: {
			id: 'msg_1',
			model: 'claude-opus-5',
			usage: {
				input_tokens: 10,
				output_tokens: 100,
				cache_creation_input_tokens: 1000,
				cache_read_input_tokens: 5000,
				...usage,
			},
		},
		...over,
	});

describe('sumUsage — Deduplizierung', () => {
	it('zählt dieselbe message.id nur EINMAL, egal wie viele Zeilen sie trägt', () => {
		const once = sumUsage([line()]);
		const thrice = sumUsage([line(), line(), line()]);
		assert.deepEqual(thrice, once, 'drei Zeilen derselben Antwort dürfen nicht dreifach zählen');
		assert.equal(once.outputTokens, 100);
		assert.equal(once.cacheCreationTokens, 1000);
	});

	it('zählt verschiedene message.id getrennt', () => {
		const usage = sumUsage([line(), line({ message: { id: 'msg_2', model: 'claude-opus-5', usage: {} } })]);
		assert.equal(usage.outputTokens, 100, 'zweite Antwort ohne usage-Werte addiert 0');
		const two = sumUsage([
			line(),
			JSON.stringify({
				timestamp: '2026-08-19T12:00:01.000Z',
				message: { id: 'msg_2', model: 'claude-opus-5', usage: { output_tokens: 7 } },
			}),
		]);
		assert.equal(two.outputTokens, 107);
	});

	it('fällt auf requestId zurück, wenn message.id fehlt', () => {
		const noId = JSON.stringify({
			timestamp: '2026-08-19T12:00:00.000Z',
			requestId: 'req_1',
			message: { model: 'claude-opus-5', usage: { output_tokens: 5 } },
		});
		assert.equal(sumUsage([noId, noId]).outputTokens, 5);
	});
});

describe('sumUsage — Abgrenzung des Laufes', () => {
	it('ignoriert Zeilen vor --since (Token des Vorlaufs)', () => {
		const alt = line({ timestamp: '2026-08-19T09:00:00.000Z' });
		const neu = JSON.stringify({
			timestamp: '2026-08-19T13:00:00.000Z',
			message: { id: 'msg_neu', model: 'claude-opus-5', usage: { output_tokens: 42 } },
		});
		const usage = sumUsage([alt, neu], '2026-08-19T12:00:00.000Z');
		assert.equal(usage.outputTokens, 42, 'nur die Antwort nach since zählt');
	});

	it('überspringt kaputte Zeilen, statt zu crashen', () => {
		const usage = sumUsage(['{ das ist kein json', '', line()]);
		assert.equal(usage.outputTokens, 100);
	});
});

describe('sumUsage — Subagenten', () => {
	it('zählt Sidechain-Token voll mit und weist sie zusätzlich separat aus', () => {
		const sub = JSON.stringify({
			timestamp: '2026-08-19T12:00:02.000Z',
			isSidechain: true,
			message: {
				id: 'msg_sub',
				model: 'claude-haiku-4-5-20251001',
				usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 },
			},
		});
		const usage = sumUsage([line(), sub]);
		assert.equal(usage.outputTokens, 102, 'Subagent-Output ist echter Verbrauch');
		assert.equal(usage.sidechainTokens, 10, 'Subagent-Anteil bleibt separat sichtbar');
	});

	it('wählt als Modell das mit dem größten Output-Anteil', () => {
		const viel = JSON.stringify({
			timestamp: '2026-08-19T12:00:03.000Z',
			message: { id: 'a', model: 'claude-haiku-4-5-20251001', usage: { output_tokens: 900 } },
		});
		assert.equal(sumUsage([line(), viel]).model, 'claude-haiku-4-5-20251001');
	});
});

describe('lookupPrice / computeCost', () => {
	it('trifft das datumsbehaftete Haiku der Pipeline über den Präfix', () => {
		assert.equal(lookupPrice('claude-haiku-4-5-20251001')?.[1], 1.0);
	});

	it('bevorzugt den längeren Präfix (opus-5 vor opus-4)', () => {
		assert.equal(lookupPrice('claude-opus-5')?.[0], 'claude-opus-5');
	});

	it('rechnet Cache-Write mit 1,25x und Cache-Read mit 0,1x des Input-Preises', () => {
		const usage: Usage = {
			inputTokens: 1_000_000,
			outputTokens: 0,
			cacheCreationTokens: 1_000_000,
			cacheReadTokens: 1_000_000,
			sidechainTokens: 0,
			model: 'claude-opus-5',
		};
		// 5.00 (Input) + 6.25 (Cache-Write) + 0.50 (Cache-Read) = 11.75
		assert.equal(computeCost(usage)?.toFixed(2), '11.75');
	});

	it('liefert undefined für ein unbekanntes Modell (GLM-Fremdtarif)', () => {
		const usage: Usage = {
			inputTokens: 100,
			outputTokens: 100,
			cacheCreationTokens: 0,
			cacheReadTokens: 0,
			sidechainTokens: 0,
			model: 'glm-4.6',
		};
		assert.equal(computeCost(usage), undefined, 'Anthropic-Preise dürfen nicht auf GLM angewandt werden');
	});
});

describe('Bestandsschutz cost-record.ts', () => {
	it('schreibt Zusatzfelder nur, wenn sie gesetzt sind', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'costs-test-'));
		try {
			const { appendCostRecord } = await import('./cost-record.ts');
			appendCostRecord(
				'42',
				{ timestamp: '2026-08-19T10:00:00Z', tokensIn: 1, tokensOut: 2, cost: 0.5 },
				{ rootDir: dir },
			);
			const [entry] = readCostRecords('42', { rootDir: dir });
			assert.deepEqual(Object.keys(entry).sort(), ['cost', 'issueId', 'timestamp', 'tokensIn', 'tokensOut']);

			appendCostRecord(
				'42',
				{
					timestamp: '2026-08-19T11:00:00Z',
					tokensIn: 3,
					tokensOut: 4,
					cost: 1,
					phase: 'implement',
					model: 'claude-haiku-4-5',
				},
				{ rootDir: dir },
			);
			const entries = readCostRecords('42', { rootDir: dir });
			assert.equal(entries.length, 2, 'Append, kein Überschreiben');
			assert.equal(entries[1].phase, 'implement');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
