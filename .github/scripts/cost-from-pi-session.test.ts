import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { collectUsage, main, sumUsage, SUBAGENT_DIR } from './cost-from-pi-session.ts';
import { readCostRecords } from './cost-record.ts';

/**
 * Tests für die Token-Erfassung aus pi-Sitzungen (Issue #1184).
 *
 * Schwerpunkte sind die drei Stellen, an denen sich pi von Claude Code unterscheidet und an
 * denen ein Fehler still falsche Zahlen erzeugt:
 *   1. Feldnamen — pi meldet `input/output/cacheRead/cacheWrite`, Claude Code
 *      `input_tokens/output_tokens/cache_*_input_tokens`. Verlesene Felder ergeben 0 statt
 *      eines Fehlers.
 *   2. KEINE Deduplizierung — pi schreibt je Nachricht genau eine Zeile. Würde hier
 *      versehentlich dedupliziert, verschwänden echte Turns.
 *   3. Subagent-Anteil — Kind-Sitzungen sind eigene Dateien unter <session-dir>/subagents.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie cost-from-transcript.test.ts).
 */

const assistant = (over: Record<string, unknown> = {}, usage: Record<string, unknown> = {}): string =>
	JSON.stringify({
		type: 'message',
		id: 'a1b2c3d4',
		parentId: null,
		timestamp: '2026-09-02T12:00:00.000Z',
		message: {
			role: 'assistant',
			model: 'claude-opus-5',
			provider: 'anthropic',
			content: [{ type: 'text', text: 'ok' }],
			stopReason: 'stop',
			usage: { input: 10, output: 100, cacheRead: 5000, cacheWrite: 1000, totalTokens: 6110, ...usage },
		},
		...over,
	});

const header = JSON.stringify({
	type: 'session',
	version: 3,
	id: 'e1a1f0b2-0000-4000-8000-000000000000',
	timestamp: '2026-09-02T12:00:00.000Z',
	cwd: '/repo',
});

const userLine = JSON.stringify({
	type: 'message',
	id: 'u1',
	parentId: null,
	timestamp: '2026-09-02T11:59:00.000Z',
	message: { role: 'user', content: 'los' },
});

const toolResult = JSON.stringify({
	type: 'message',
	id: 't1',
	parentId: 'a1b2c3d4',
	timestamp: '2026-09-02T12:00:01.000Z',
	message: { role: 'toolResult', toolCallId: 'c1', toolName: 'bash', content: [], isError: false },
});

const parse = (lines: readonly string[], sidechain = false) => sumUsage(lines.map((line) => ({ line, sidechain })));

describe('sumUsage — pi-Feldnamen', () => {
	it('liest input/output/cacheRead/cacheWrite und bildet sie auf das gemeinsame Usage-Schema ab', () => {
		const usage = parse([assistant()]);
		assert.equal(usage.inputTokens, 10);
		assert.equal(usage.outputTokens, 100);
		assert.equal(usage.cacheReadTokens, 5000, 'cacheRead → cacheReadTokens');
		assert.equal(usage.cacheCreationTokens, 1000, 'cacheWrite → cacheCreationTokens');
		assert.equal(usage.turns, 1);
		assert.equal(usage.model, 'claude-opus-5');
	});

	it('ignoriert Header, User-Nachrichten und Tool-Ergebnisse (kein Verbrauch)', () => {
		const usage = parse([header, userLine, assistant(), toolResult]);
		assert.equal(usage.turns, 1, 'nur die Assistant-Nachricht zählt als Turn');
		assert.equal(usage.outputTokens, 100);
	});

	it('zählt Claude-Code-Feldnamen NICHT mit (falsches Format = 0, kein stiller Treffer)', () => {
		const claudeStyle = JSON.stringify({
			type: 'message',
			message: { role: 'assistant', model: 'claude-opus-5', usage: { input_tokens: 999, output_tokens: 999 } },
		});
		assert.equal(parse([claudeStyle]).turns, 0);
	});
});

describe('sumUsage — mehrere Antworten', () => {
	it('zählt jede Assistant-Zeile einzeln (pi dedupliziert nicht wie Claude Code)', () => {
		const usage = parse([assistant(), assistant(), assistant()]);
		assert.equal(usage.turns, 3, 'drei Antworten = drei API-Calls');
		assert.equal(usage.outputTokens, 300);
	});

	it('wählt als model das mit dem größten Output-Anteil', () => {
		const usage = parse([
			assistant({}, { output: 10 }),
			assistant({ message: { role: 'assistant', model: 'glm-4.7', usage: { input: 1, output: 500 } } }),
		]);
		assert.equal(usage.model, 'glm-4.7');
	});

	it('zählt die usage von Compaction-Einträgen mit (echter Verbrauch des Laufes)', () => {
		const compaction = JSON.stringify({
			type: 'compaction',
			id: 'f6',
			timestamp: '2026-09-02T12:05:00.000Z',
			summary: '…',
			tokensBefore: 50000,
			usage: { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 },
		});
		const usage = parse([assistant(), compaction]);
		assert.equal(usage.turns, 2);
		assert.equal(usage.inputTokens, 17);
	});
});

describe('collectUsage — Sitzungsverzeichnis', () => {
	const withDir = (fn: (dir: string) => void): void => {
		const dir = mkdtempSync(join(tmpdir(), 'pi-session-'));
		try {
			fn(dir);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	};

	it('liest alle Sitzungen des Laufes und weist den Subagent-Anteil separat aus', () => {
		withDir((dir) => {
			writeFileSync(join(dir, 'parent.jsonl'), `${header}\n${assistant()}\n`);
			mkdirSync(join(dir, SUBAGENT_DIR), { recursive: true });
			writeFileSync(
				join(dir, SUBAGENT_DIR, 'child.jsonl'),
				`${header}\n${assistant({}, { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 })}\n`,
			);

			const usage = collectUsage({ sessionDir: dir });
			assert.equal(usage.turns, 2, 'Eltern- und Kind-Sitzung zählen beide');
			assert.equal(usage.outputTokens, 102, 'Subagent-Verbrauch zählt VOLL mit');
			assert.equal(usage.sidechainTokens, 10, 'und wird zusätzlich separat ausgewiesen');
		});
	});

	it('liefert leeren Verbrauch für ein nicht existierendes Verzeichnis (nie fatal)', () => {
		const usage = collectUsage({ sessionDir: join(tmpdir(), 'gibt-es-nicht-1184') });
		assert.equal(usage.turns, 0);
		assert.equal(usage.model, '');
	});
});

describe('main — Datensatz im .costs-Schema', () => {
	it('schreibt genau die Felder, die track-costs und cost-seal erwarten', () => {
		const sessionDir = mkdtempSync(join(tmpdir(), 'pi-session-'));
		const rootDir = mkdtempSync(join(tmpdir(), 'pi-costs-'));
		try {
			writeFileSync(join(sessionDir, 's.jsonl'), `${header}\n${assistant()}\n`);

			const code = main([
				'--issue',
				'1184',
				'--phase',
				'analyse',
				'--provider',
				'claude',
				'--session-dir',
				sessionDir,
				'--root-dir',
				rootDir,
			]);
			assert.equal(code, 0);

			const records = readCostRecords('1184', { rootDir });
			assert.equal(records.length, 1);
			const [entry] = records;
			assert.equal(entry.tokensIn, 6010, 'input + cacheWrite + cacheRead');
			assert.equal(entry.tokensOut, 100);
			assert.equal(entry.cacheReadTokens, 5000);
			assert.equal(entry.turns, 1);
			assert.equal(entry.model, 'claude-opus-5');
			assert.equal(entry.provider, 'claude');
			assert.equal(entry.phase, 'analyse');
			assert.ok(entry.cost > 0, 'Anthropic-Modell ist bepreist — cost darf nicht 0 sein');
		} finally {
			rmSync(sessionDir, { recursive: true, force: true });
			rmSync(rootDir, { recursive: true, force: true });
		}
	});

	it('schreibt KEINEN Datensatz, wenn es keine Sitzung gibt (grüner Lauf bleibt grün)', () => {
		const rootDir = mkdtempSync(join(tmpdir(), 'pi-costs-'));
		try {
			const code = main([
				'--issue',
				'1184',
				'--session-dir',
				join(tmpdir(), 'gibt-es-nicht-1184'),
				'--root-dir',
				rootDir,
			]);
			assert.equal(code, 0, 'kein Verbrauch ist kein Fehler');
			assert.equal(readCostRecords('1184', { rootDir }).length, 0);
		} finally {
			rmSync(rootDir, { recursive: true, force: true });
		}
	});
});
