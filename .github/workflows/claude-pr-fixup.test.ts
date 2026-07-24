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

// Hilfsfunktion: extrahiert den GLM-Prompt-Block aus claude-pr-fixup.yml
const glmPrompt = (): string => {
	const yml = fixupYml();
	// Der GLM-Prompt steht im `prompt: |` Block des "Findings umsetzen via GLM (Z.ai)"-Steps
	const match = yml.match(/name: Findings umsetzen via GLM \(Z\.ai\)[\s\S]*?prompt: \|([\s\S]*?)claude_args:/);
	assert.ok(match, 'GLM-Prompt-Block nicht gefunden in claude-pr-fixup.yml');
	return match[1];
};

// Hilfsfunktion: extrahiert den Mistral-Prompt-Block aus claude-pr-fixup.yml
const mistralPrompt = (): string => {
	const yml = fixupYml();
	// Der Mistral-Prompt steht im `prompt: |` Block des "Findings umsetzen via Mistral Vibe"-Steps
	const match = yml.match(
		/name: Findings umsetzen via Mistral Vibe[\s\S]*?prompt: \|([\s\S]*?)(?=\n      -|\n  [a-z]|\s*$)/,
	);
	assert.ok(match, 'Mistral-Prompt-Block nicht gefunden in claude-pr-fixup.yml');
	return match[1];
};

describe('AK0 — GLM-Schritt nutzt claude-code-action (kein Mistral-Vibe)', () => {
	it('GLM-Step verwendet uses: anthropics/claude-code-action, NICHT mistralai/mistral-vibe', () => {
		const yml = fixupYml();
		// Negativkontrolle: haette GLM versehentlich mistral-vibe als uses, wuerde dieser Test rot
		const glmSection = yml.match(
			/name: Findings umsetzen via GLM \(Z\.ai\)[\s\S]*?(?=\n      -\s+name:|\n  [a-z]|\s*$)/,
		);
		assert.ok(glmSection, 'GLM-Step-Block nicht gefunden in claude-pr-fixup.yml');
		assert.match(
			glmSection[0],
			/uses:\s*anthropics\/claude-code-action/,
			'GLM-Step muss anthropics/claude-code-action nutzen, nicht mistral-vibe',
		);
		assert.doesNotMatch(
			glmSection[0],
			/uses:\s*mistralai\/mistral-vibe/,
			'GLM-Step darf NICHT mistralai/mistral-vibe nutzen — negativkontrolle',
		);
	});

	it('GLM-Step setzt ANTHROPIC_BASE_URL auf den Z.ai-Endpoint', () => {
		const yml = fixupYml();
		const glmSection = yml.match(
			/name: Findings umsetzen via GLM \(Z\.ai\)[\s\S]*?(?=\n      -\s+name: Ergebnis|\s*$)/,
		);
		assert.ok(glmSection, 'GLM-Step-Block nicht gefunden');
		assert.match(
			glmSection[0],
			/ANTHROPIC_BASE_URL:\s*https:\/\/api\.z\.ai\/api\/anthropic/,
			'GLM-Step muss ANTHROPIC_BASE_URL auf https://api.z.ai/api/anthropic setzen',
		);
	});

	it('GLM-Step nutzt anthropic_api_key (nicht claude_code_oauth_token)', () => {
		const yml = fixupYml();
		const glmSection = yml.match(
			/name: Findings umsetzen via GLM \(Z\.ai\)[\s\S]*?(?=\n      -\s+name: Ergebnis|\s*$)/,
		);
		assert.ok(glmSection, 'GLM-Step-Block nicht gefunden');
		assert.match(glmSection[0], /anthropic_api_key:/, 'GLM-Step muss anthropic_api_key verwenden');
		assert.doesNotMatch(
			glmSection[0],
			/claude_code_oauth_token:/,
			'GLM-Step darf kein claude_code_oauth_token verwenden — negativkontrolle',
		);
	});
});

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
		assert.doesNotMatch(
			prompt,
			/pnpm --filter \S+ lint/,
			'Claude-Prompt darf kein `--filter`-Lint als Gate-Kommando verwenden',
		);
	});

	it('GLM-Prompt in claude-pr-fixup.yml nennt pnpm lint ohne --filter als Gate', () => {
		const prompt = glmPrompt();
		assert.match(prompt, /pnpm lint/, 'GLM-Prompt muss `pnpm lint` (repo-weit) als Gate nennen');
		assert.doesNotMatch(
			prompt,
			/pnpm --filter \S+ lint/,
			'GLM-Prompt darf kein `--filter`-Lint als Gate-Kommando verwenden',
		);
	});

	it('Mistral-Prompt in claude-pr-fixup.yml nennt pnpm lint ohne --filter als Gate', () => {
		const prompt = mistralPrompt();
		assert.match(prompt, /pnpm lint/, 'Mistral-Prompt muss `pnpm lint` (repo-weit) als Gate nennen');
		assert.doesNotMatch(
			prompt,
			/pnpm --filter \S+ lint/,
			'Mistral-Prompt darf kein `--filter`-Lint als Gate-Kommando verwenden',
		);
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
		assert.match(
			claudePrompt(),
			/prettier --check \./,
			'Claude-Prompt muss `prettier --check .` als verifizierenden Gate enthalten',
		);
	});

	it('GLM-Prompt enthält prettier --check . als Gate-Kommando', () => {
		assert.match(
			glmPrompt(),
			/prettier --check \./,
			'GLM-Prompt muss `prettier --check .` als verifizierenden Gate enthalten',
		);
	});

	it('Mistral-Prompt enthält prettier --check . als Gate-Kommando', () => {
		assert.match(
			mistralPrompt(),
			/prettier --check \./,
			'Mistral-Prompt muss `prettier --check .` als verifizierenden Gate enthalten',
		);
	});
});

describe('AK3 — Gate-Kommandos spiegeln CI-Checks exakt', () => {
	it('ci.yml verwendet prettier --check . als Format-Check', () => {
		// Verifiziert, dass ci.yml tatsaechlich prettier --check . enthaelt (Referenz-Ankerpunkt)
		assert.match(
			ciYml(),
			/prettier --check \./,
			'ci.yml muss `prettier --check .` enthalten — Referenz für den CI-Spiegel',
		);
	});

	it('ci.yml verwendet pnpm lint als Lint-Check', () => {
		assert.match(ciYml(), /^\s*run: pnpm lint\s*$/m, 'ci.yml muss `pnpm lint` (repo-weit) als Lint-Step enthalten');
	});

	it('Claude-Prompt spiegelt beide CI-Gate-Kommandos (prettier --check . und pnpm lint)', () => {
		const prompt = claudePrompt();
		assert.match(prompt, /prettier --check \./, 'Claude-Prompt muss `prettier --check .` als CI-Spiegel enthalten');
		assert.match(prompt, /pnpm lint/, 'Claude-Prompt muss `pnpm lint` als CI-Spiegel enthalten');
	});

	it('GLM-Prompt spiegelt beide CI-Gate-Kommandos (prettier --check . und pnpm lint)', () => {
		const prompt = glmPrompt();
		assert.match(prompt, /prettier --check \./, 'GLM-Prompt muss `prettier --check .` als CI-Spiegel enthalten');
		assert.match(prompt, /pnpm lint/, 'GLM-Prompt muss `pnpm lint` als CI-Spiegel enthalten');
	});

	it('Mistral-Prompt spiegelt beide CI-Gate-Kommandos (prettier --check . und pnpm lint)', () => {
		const prompt = mistralPrompt();
		assert.match(prompt, /prettier --check \./, 'Mistral-Prompt muss `prettier --check .` als CI-Spiegel enthalten');
		assert.match(prompt, /pnpm lint/, 'Mistral-Prompt muss `pnpm lint` als CI-Spiegel enthalten');
	});

	it('ticket-implementation.md spiegelt beide CI-Gate-Kommandos', () => {
		const doc = implDoc();
		assert.match(
			doc,
			/prettier --check \./,
			'ticket-implementation.md muss `prettier --check .` als CI-Spiegel nennen',
		);
		assert.match(doc, /pnpm lint/, 'ticket-implementation.md muss `pnpm lint` (repo-weit) als CI-Spiegel nennen');
	});
});

describe('AK4 — CI-Format/Lint-Fehler ist als eigenständiges Finding deklariert', () => {
	it('Claude-Prompt dokumentiert: CI-Fehler an Format/Lint ist ein eigenständiges Finding', () => {
		const prompt = claudePrompt();
		const pattern =
			/[Ff]ormat[^.]*[Ff]inding|[Ll]int[^.]*[Ff]inding|[Ff]inding[^.]*[Ff]ormat|[Ff]inding[^.]*[Ll]int|CI[^.]*[Ff]ormat[^.]*behob|CI[^.]*[Ll]int[^.]*behob|[Ff]ormat.*CI.*[Ff]inding|[Ll]int.*CI.*[Ff]inding/;
		assert.ok(
			pattern.test(prompt),
			'Claude-Prompt muss klarstellen, dass ein reiner CI-Format-/Lint-Fehler als eigenständiges Finding behandelt wird',
		);
	});

	it('GLM-Prompt dokumentiert: CI-Fehler an Format/Lint ist ein eigenständiges Finding', () => {
		const prompt = glmPrompt();
		const pattern =
			/[Ff]ormat[^.]*[Ff]inding|[Ll]int[^.]*[Ff]inding|[Ff]inding[^.]*[Ff]ormat|[Ff]inding[^.]*[Ll]int|CI[^.]*[Ff]ormat[^.]*behob|CI[^.]*[Ll]int[^.]*behob|[Ff]ormat.*CI.*[Ff]inding|[Ll]int.*CI.*[Ff]inding/;
		assert.ok(
			pattern.test(prompt),
			'GLM-Prompt muss klarstellen, dass ein reiner CI-Format-/Lint-Fehler als eigenständiges Finding behandelt wird',
		);
	});

	it('Mistral-Prompt dokumentiert: CI-Fehler an Format/Lint ist ein eigenständiges Finding', () => {
		const prompt = mistralPrompt();
		const pattern =
			/[Ff]ormat[^.]*[Ff]inding|[Ll]int[^.]*[Ff]inding|[Ff]inding[^.]*[Ff]ormat|[Ff]inding[^.]*[Ll]int|CI[^.]*[Ff]ormat[^.]*behob|CI[^.]*[Ll]int[^.]*behob|[Ff]ormat.*CI.*[Ff]inding|[Ll]int.*CI.*[Ff]inding/;
		assert.ok(
			pattern.test(prompt),
			'Mistral-Prompt muss klarstellen, dass ein reiner CI-Format-/Lint-Fehler als eigenständiges Finding behandelt wird',
		);
	});
});

describe('AK5 — Prompt-Symmetrie Claude/GLM/Mistral (kein Gate-Drift)', () => {
	it('Claude-, GLM- und Mistral-Prompt enthalten alle das Gate-Kommando prettier --check . identisch', () => {
		const cp = claudePrompt();
		const gp = glmPrompt();
		const mp = mistralPrompt();

		assert.match(cp, /prettier --check \./, 'Claude-Prompt fehlt `prettier --check .`');
		assert.match(gp, /prettier --check \./, 'GLM-Prompt fehlt `prettier --check .`');
		assert.match(mp, /prettier --check \./, 'Mistral-Prompt fehlt `prettier --check .`');

		const gatePattern = /pnpm format[^\n]*prettier[^\n]*/;
		const claudeGate = cp.match(gatePattern)?.[0]?.trim();
		const glmGate = gp.match(gatePattern)?.[0]?.trim();
		const mistralGate = mp.match(gatePattern)?.[0]?.trim();

		assert.ok(claudeGate, 'Claude-Prompt hat keine erkennbare Gate-Zeile mit pnpm format + prettier');
		assert.ok(glmGate, 'GLM-Prompt hat keine erkennbare Gate-Zeile mit pnpm format + prettier');
		assert.ok(mistralGate, 'Mistral-Prompt hat keine erkennbare Gate-Zeile mit pnpm format + prettier');
		assert.equal(
			claudeGate,
			glmGate,
			`Gate-Anweisung weicht zwischen Claude- und GLM-Prompt ab — kein Drift erlaubt:\n  Claude: ${claudeGate}\n  GLM:    ${glmGate}`,
		);
		assert.equal(
			claudeGate,
			mistralGate,
			`Gate-Anweisung weicht zwischen Claude- und Mistral-Prompt ab — kein Drift erlaubt:\n  Claude:  ${claudeGate}\n  Mistral: ${mistralGate}`,
		);
	});

	it('Claude-, GLM- und Mistral-Prompt beschreiben das Gate als Vor-Push-Bedingung (blockierend)', () => {
		const cp = claudePrompt();
		const gp = glmPrompt();
		const mp = mistralPrompt();

		const gateIsBlocking = (prompt: string) =>
			/vor jedem (Commit|Push)|erst wenn.*grün|vor.*Push.*Gate|Gate.*grün/i.test(prompt);

		assert.ok(
			gateIsBlocking(cp),
			'Claude-Prompt muss das Gate als Vor-Push-Bedingung formulieren (nicht als optionalen Hinweis)',
		);
		assert.ok(
			gateIsBlocking(gp),
			'GLM-Prompt muss das Gate als Vor-Push-Bedingung formulieren (nicht als optionalen Hinweis)',
		);
		assert.ok(
			gateIsBlocking(mp),
			'Mistral-Prompt muss das Gate als Vor-Push-Bedingung formulieren (nicht als optionalen Hinweis)',
		);
	});
});
