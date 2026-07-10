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
// Tests werden ROT, bis Produktivcode (ticket-implementation.md + hermes-pr-fixup.yml) angepasst ist.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const readFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

const implDoc = (): string => readFile('.ai-knowledge', 'ticket-implementation.md');
const fixupYml = (): string => readFile('.github', 'workflows', 'hermes-pr-fixup.yml');
const ciYml = (): string => readFile('.github', 'workflows', 'ci.yml');

// Hilfsfunktion: extrahiert den Hermes-Prompt-Block aus hermes-pr-fixup.yml
const hermesPrompt = (): string => {
	const yml = fixupYml();
	// Der Prompt steht im Heredoc des "Findings umsetzen via Hermes"-Steps
	const match = yml.match(
		/Findings umsetzen via Hermes[\s\S]*?cat > \/tmp\/hermes-prompt\.txt << 'HERMES_EOF'\s*\n([\s\S]*?)HERMES_EOF/,
	);
	assert.ok(match, 'Hermes-Prompt-Block nicht gefunden in hermes-pr-fixup.yml');
	return match[1];
};

describe('AK1 — Lint-Gate ist repo-weit (kein --filter)', () => {
	it('ticket-implementation.md Step 3c nennt pnpm lint ohne --filter als Gate-Kommando', () => {
		const doc = implDoc();
		assert.match(doc, /pnpm lint/, 'ticket-implementation.md muss `pnpm lint` (repo-weit) als Gate-Kommando nennen');
		assert.doesNotMatch(
			doc,
			/pnpm --filter priority-pilot lint/,
			'ticket-implementation.md darf `--filter priority-pilot lint` nicht als Gate-Kommando verwenden — CI lintet repo-weit',
		);
	});

	it('Hermes-Prompt in hermes-pr-fixup.yml nennt pnpm lint ohne --filter als Gate', () => {
		const prompt = hermesPrompt();
		assert.match(prompt, /pnpm lint/, 'Hermes-Prompt muss `pnpm lint` (repo-weit) als Gate nennen');
		assert.doesNotMatch(
			prompt,
			/pnpm --filter \S+ lint/,
			'Hermes-Prompt darf kein `--filter`-Lint als Gate-Kommando verwenden',
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

	it('Hermes-Prompt enthält prettier --check . als Gate-Kommando', () => {
		assert.match(
			hermesPrompt(),
			/prettier --check \./,
			'Hermes-Prompt muss `prettier --check .` als verifizierenden Gate enthalten',
		);
	});
});

describe('AK3 — Gate-Kommandos spiegeln CI-Checks exakt', () => {
	it('ci.yml verwendet prettier --check . als Format-Check', () => {
		assert.match(
			ciYml(),
			/prettier --check \./,
			'ci.yml muss `prettier --check .` enthalten — Referenz für den CI-Spiegel',
		);
	});

	it('ci.yml verwendet pnpm lint als Lint-Check', () => {
		assert.match(ciYml(), /^\s*run: pnpm lint\s*$/m, 'ci.yml muss `pnpm lint` (repo-weit) als Lint-Step enthalten');
	});

	it('Hermes-Prompt spiegelt beide CI-Gate-Kommandos (prettier --check . und pnpm lint)', () => {
		const prompt = hermesPrompt();
		assert.match(prompt, /prettier --check \./, 'Hermes-Prompt muss `prettier --check .` als CI-Spiegel enthalten');
		assert.match(prompt, /pnpm lint/, 'Hermes-Prompt muss `pnpm lint` als CI-Spiegel enthalten');
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
	it('Hermes-Prompt dokumentiert: CI-Fehler an Format/Lint ist ein eigenständiges Finding', () => {
		const prompt = hermesPrompt();
		const pattern =
			/[Ff]ormat[^.]*[Ff]inding|[Ll]int[^.]*[Ff]inding|[Ff]inding[^.]*[Ff]ormat|[Ff]inding[^.]*[Ll]int|CI[^.]*[Ff]ormat[^.]*behob|CI[^.]*[Ll]int[^.]*behob|[Ff]ormat.*CI.*[Ff]inding|[Ll]int.*CI.*[Ff]inding/;
		assert.ok(
			pattern.test(prompt),
			'Hermes-Prompt muss klarstellen, dass ein reiner CI-Format-/Lint-Fehler als eigenständiges Finding behandelt wird',
		);
	});
});
