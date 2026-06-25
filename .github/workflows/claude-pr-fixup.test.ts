import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Format-/Lint-Gate als CI-Spiegel (#161).
//
// Root Causes laut Triage:
//   RC1: ticket-implementation.md Step 3c nennt `--filter priority-pilot lint` statt repo-weitem `pnpm lint`.
//   RC2: Weder Step 3c noch Fixup-Prompts enthalten `prettier --check .` als verifizierenden Gate.
//   RC3: Format/Lint-Fehler in CI sind nicht als eigenständiges Finding deklariert.
//
// Testebene: statische YAML-/Doku-Datei-Checks (node:test via tsx, ci.yml Z. 56–57).
// Tests werden ROT, bis Produktivcode (ticket-implementation.md + claude-pr-fixup.yml) angepasst ist.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const readFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

const implDoc = (): string => readFile('.ai-knowledge', 'ticket-implementation.md');
const fixupYml = (): string => readFile('.github', 'workflows', 'claude-pr-fixup.yml');
const ciYml = (): string => readFile('.github', 'workflows', 'ci.yml');

// Hilfsfunktion: extrahiert den Claude-Prompt-Block aus claude-pr-fixup.yml
const claudePrompt = (): string => {
	const yml = fixupYml();
	// Der Claude-Prompt steht im `prompt: |` Block des "Findings umsetzen via Claude Code"-Steps
	const match = yml.match(/name: Findings umsetzen via Claude Code[\s\S]*?prompt: \|([\s\S]*?)claude_args:/);
	assert.ok(match, 'Claude-Prompt-Block nicht gefunden in claude-pr-fixup.yml');
	return match[1];
};

// Hilfsfunktion: extrahiert den Mistral-Prompt-Block aus claude-pr-fixup.yml
const mistralPrompt = (): string => {
	const yml = fixupYml();
	// Der Mistral-Prompt steht im `prompt: |` Block des "Findings umsetzen via Mistral Vibe"-Steps
	const match = yml.match(/name: Findings umsetzen via Mistral Vibe[\s\S]*?prompt: \|([\s\S]*?)(?=\n      -|\n  [a-z]|\s*$)/);
	assert.ok(match, 'Mistral-Prompt-Block nicht gefunden in claude-pr-fixup.yml');
	return match[1];
};

describe('AK1 — Lint-Gate ist repo-weit (kein --filter)', () => {
	it('ticket-implementation.md Step 3c nennt pnpm lint ohne --filter als Gate-Kommando', () => {
		const doc = implDoc();
		// Muss pnpm lint repo-weit nennen — kein `--filter` als alleinstehender Lint-Befehl
		assert.match(doc, /pnpm lint/, 'ticket-implementation.md muss `pnpm lint` (repo-weit) als Gate-Kommando nennen');
		// Darf NICHT `--filter priority-pilot lint` als alleinigen Lint-Befehl für das Gate nennen
		assert.doesNotMatch(
			doc,
			/pnpm --filter priority-pilot lint/,
			'ticket-implementation.md darf `--filter priority-pilot lint` nicht als Gate-Kommando verwenden — CI lintet repo-weit',
		);
	});

	it('Claude-Prompt in claude-pr-fixup.yml nennt pnpm lint ohne --filter als Gate', () => {
		const prompt = claudePrompt();
		assert.match(prompt, /pnpm lint/, 'Claude-Prompt muss `pnpm lint` (repo-weit) als Gate nennen');
		assert.doesNotMatch(prompt, /pnpm --filter \S+ lint/, 'Claude-Prompt darf kein `--filter`-Lint als Gate-Kommando verwenden');
	});

	it('Mistral-Prompt in claude-pr-fixup.yml nennt pnpm lint ohne --filter als Gate', () => {
		const prompt = mistralPrompt();
		assert.match(prompt, /pnpm lint/, 'Mistral-Prompt muss `pnpm lint` (repo-weit) als Gate nennen');
		assert.doesNotMatch(prompt, /pnpm --filter \S+ lint/, 'Mistral-Prompt darf kein `--filter`-Lint als Gate-Kommando verwenden');
	});
});

describe('AK2 — Verifizierender prettier --check . ist als Gate vorhanden', () => {
	it('ticket-implementation.md Step 3c enthält prettier --check . als Vor-Push-Bedingung', () => {
		assert.match(
			implDoc(),
			/prettier --check \./,
			'ticket-implementation.md muss `prettier --check .` (verifizierend) als Gate nennen — nicht nur pnpm format (--write)',
		);
	});

	it('Claude-Prompt enthält prettier --check . als Gate-Kommando', () => {
		assert.match(claudePrompt(), /prettier --check \./, 'Claude-Prompt muss `prettier --check .` als verifizierenden Gate enthalten');
	});

	it('Mistral-Prompt enthält prettier --check . als Gate-Kommando', () => {
		assert.match(mistralPrompt(), /prettier --check \./, 'Mistral-Prompt muss `prettier --check .` als verifizierenden Gate enthalten');
	});
});

describe('AK3 — Gate-Kommandos spiegeln CI-Checks exakt', () => {
	it('ci.yml verwendet prettier --check . als Format-Check', () => {
		// Verifiziert, dass ci.yml tatsaechlich prettier --check . enthaelt (Referenz-Ankerpunkt)
		assert.match(ciYml(), /prettier --check \./, 'ci.yml muss `prettier --check .` enthalten — Referenz für den CI-Spiegel');
	});

	it('ci.yml verwendet pnpm lint als Lint-Check', () => {
		assert.match(ciYml(), /^\s*run: pnpm lint\s*$/m, 'ci.yml muss `pnpm lint` (repo-weit) als Lint-Step enthalten');
	});

	it('Claude-Prompt spiegelt beide CI-Gate-Kommandos (prettier --check . und pnpm lint)', () => {
		const prompt = claudePrompt();
		assert.match(prompt, /prettier --check \./, 'Claude-Prompt muss `prettier --check .` als CI-Spiegel enthalten');
		assert.match(prompt, /pnpm lint/, 'Claude-Prompt muss `pnpm lint` als CI-Spiegel enthalten');
	});

	it('Mistral-Prompt spiegelt beide CI-Gate-Kommandos (prettier --check . und pnpm lint)', () => {
		const prompt = mistralPrompt();
		assert.match(prompt, /prettier --check \./, 'Mistral-Prompt muss `prettier --check .` als CI-Spiegel enthalten');
		assert.match(prompt, /pnpm lint/, 'Mistral-Prompt muss `pnpm lint` als CI-Spiegel enthalten');
	});

	it('ticket-implementation.md spiegelt beide CI-Gate-Kommandos', () => {
		const doc = implDoc();
		assert.match(doc, /prettier --check \./, 'ticket-implementation.md muss `prettier --check .` als CI-Spiegel nennen');
		assert.match(doc, /pnpm lint/, 'ticket-implementation.md muss `pnpm lint` (repo-weit) als CI-Spiegel nennen');
	});
});

describe('AK4 — CI-Format/Lint-Fehler ist als eigenständiges Finding deklariert', () => {
	it('Claude-Prompt dokumentiert: CI-Fehler an Format/Lint ist ein eigenständiges Finding', () => {
		const prompt = claudePrompt();
		// Muss den Zusammenhang CI-Fehler → eigenständiges Finding oder äquivalente Formulierung enthalten
		const pattern =
			/[Ff]ormat[^.]*[Ff]inding|[Ll]int[^.]*[Ff]inding|[Ff]inding[^.]*[Ff]ormat|[Ff]inding[^.]*[Ll]int|CI[^.]*[Ff]ormat[^.]*behob|CI[^.]*[Ll]int[^.]*behob|[Ff]ormat.*CI.*[Ff]inding|[Ll]int.*CI.*[Ff]inding/;
		assert.ok(pattern.test(prompt), 'Claude-Prompt muss klarstellen, dass ein reiner CI-Format-/Lint-Fehler als eigenständiges Finding behandelt wird');
	});

	it('Mistral-Prompt dokumentiert: CI-Fehler an Format/Lint ist ein eigenständiges Finding', () => {
		const prompt = mistralPrompt();
		const pattern =
			/[Ff]ormat[^.]*[Ff]inding|[Ll]int[^.]*[Ff]inding|[Ff]inding[^.]*[Ff]ormat|[Ff]inding[^.]*[Ll]int|CI[^.]*[Ff]ormat[^.]*behob|CI[^.]*[Ll]int[^.]*behob|[Ff]ormat.*CI.*[Ff]inding|[Ll]int.*CI.*[Ff]inding/;
		assert.ok(pattern.test(prompt), 'Mistral-Prompt muss klarstellen, dass ein reiner CI-Format-/Lint-Fehler als eigenständiges Finding behandelt wird');
	});
});

describe('AK5 — Prompt-Symmetrie Claude/Mistral (kein Gate-Drift)', () => {
	it('Claude- und Mistral-Prompt enthalten beide das Gate-Kommando prettier --check . identisch', () => {
		const cp = claudePrompt();
		const mp = mistralPrompt();

		// Beide muessen prettier --check . enthalten
		assert.match(cp, /prettier --check \./, 'Claude-Prompt fehlt `prettier --check .`');
		assert.match(mp, /prettier --check \./, 'Mistral-Prompt fehlt `prettier --check .`');

		// Extrahiere die Gate-Zeile (pnpm format && pnpm exec prettier --check . && pnpm lint oder äquivalent)
		const gatePattern = /pnpm format[^\n]*prettier[^\n]*/;
		const claudeGate = cp.match(gatePattern)?.[0]?.trim();
		const mistralGate = mp.match(gatePattern)?.[0]?.trim();

		assert.ok(claudeGate, 'Claude-Prompt hat keine erkennbare Gate-Zeile mit pnpm format + prettier');
		assert.ok(mistralGate, 'Mistral-Prompt hat keine erkennbare Gate-Zeile mit pnpm format + prettier');
		assert.equal(
			claudeGate,
			mistralGate,
			`Gate-Anweisung weicht zwischen Claude- und Mistral-Prompt ab — kein Drift erlaubt:\n  Claude:  ${claudeGate}\n  Mistral: ${mistralGate}`,
		);
	});

	it('Claude- und Mistral-Prompt beschreiben das Gate als Vor-Push-Bedingung (blockierend)', () => {
		const cp = claudePrompt();
		const mp = mistralPrompt();

		// Das Gate muss als Bedingung formuliert sein (vor Push / erst wenn grün / etc.)
		const gateIsBlocking = (prompt: string) => /vor jedem (Commit|Push)|erst wenn.*grün|vor.*Push.*Gate|Gate.*grün/i.test(prompt);

		assert.ok(gateIsBlocking(cp), 'Claude-Prompt muss das Gate als Vor-Push-Bedingung formulieren (nicht als optionalen Hinweis)');
		assert.ok(gateIsBlocking(mp), 'Mistral-Prompt muss das Gate als Vor-Push-Bedingung formulieren (nicht als optionalen Hinweis)');
	});
});
