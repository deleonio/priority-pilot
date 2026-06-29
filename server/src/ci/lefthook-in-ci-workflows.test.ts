/**
 * Rote Spec-Tests für Issue #173:
 * "Git-Hooks (lefthook) in CI-Workflows aktiv schalten".
 *
 * Das Verhalten liegt vollständig in zwei GitHub-Actions-Workflow-Dateien:
 *   - .github/workflows/claude-pr-fixup.yml
 *   - .github/workflows/claude-implement.yml
 *
 * Geprüft wird die WORKFLOW-DEFINITION selbst: ob lefthook install explizit
 * aufgerufen wird und ob beide Prompts pnpm knip als Pre-Commit-Prüfung enthalten.
 *
 * Diese Tests sind ROT, solange die Workflows den Vertrag nicht erfüllen; sie werden
 * grün, sobald die Umsetzung die Workflows gemäß den Akzeptanzkriterien anpasst.
 * Es wird KEIN Produktivcode geschrieben — nur der Vertrag festgehalten.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/src/ci -> Repo-Wurzel
const repoRoot = join(__dirname, '..', '..', '..');
const fixupWorkflowPath = join(repoRoot, '.github', 'workflows', 'claude-pr-fixup.yml');
const implementWorkflowPath = join(repoRoot, '.github', 'workflows', 'claude-implement.yml');

function readWorkflow(path: string): string {
	return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function squash(text: string): string {
	return text.replace(/\s+/g, ' ');
}

describe('Issue #173 — lefthook in CI-Workflows aktiv schalten', () => {
	describe('AK 1 — Git-Hooks sind in claude-pr-fixup.yml aktiv', () => {
		it('claude-pr-fixup.yml existiert', () => {
			assert.ok(existsSync(fixupWorkflowPath), `Workflow-Datei fehlt: ${fixupWorkflowPath}`);
		});

		it('führt lefthook install explizit nach pnpm install aus', () => {
			const wf = squash(readWorkflow(fixupWorkflowPath));
			// pnpm install muss vorhanden sein
			assert.ok(
				/pnpm install/.test(wf),
				'pnpm install fehlt in claude-pr-fixup.yml',
			);
			// lefthook install muss explizit aufgerufen werden
			assert.ok(
				/lefthook install/.test(wf),
				'lefthook install fehlt in claude-pr-fixup.yml — Hooks werden in CI (CI=true) nicht automatisch via prepare-Script installiert',
			);
		});

		it('lefthook install steht in einem eigenen run-Schritt (nicht nur im Prompt)', () => {
			const wf = readWorkflow(fixupWorkflowPath);
			// Der run-Block muss lefthook install enthalten (nicht nur in einem prompt:-String)
			// Wir prüfen, dass es einen run:-Block gibt, der lefthook install enthält
			const runBlockPattern = /run:\s*(?:\|[^-]*)?[^\n]*lefthook install/;
			const pnpmExecPattern = /pnpm exec lefthook install/;
			const hasRunBlock = runBlockPattern.test(squash(wf)) || pnpmExecPattern.test(wf);
			assert.ok(
				hasRunBlock,
				'lefthook install muss in einem run:-Schritt stehen (pnpm exec lefthook install), nicht nur im Prompt-Text',
			);
		});
	});

	describe('AK 2 — Git-Hooks sind in claude-implement.yml aktiv', () => {
		it('claude-implement.yml existiert', () => {
			assert.ok(existsSync(implementWorkflowPath), `Workflow-Datei fehlt: ${implementWorkflowPath}`);
		});

		it('hat pnpm-Setup-Schritte (pnpm/action-setup)', () => {
			const wf = readWorkflow(implementWorkflowPath);
			assert.match(
				wf,
				/pnpm\/action-setup/,
				'pnpm/action-setup fehlt in claude-implement.yml — ohne pnpm-Setup kann kein pnpm install/lefthook install laufen',
			);
		});

		it('hat Node.js-Setup-Schritte (actions/setup-node)', () => {
			const wf = readWorkflow(implementWorkflowPath);
			assert.match(
				wf,
				/actions\/setup-node/,
				'actions/setup-node fehlt in claude-implement.yml',
			);
		});

		it('installiert Abhängigkeiten (pnpm install --frozen-lockfile)', () => {
			const wf = squash(readWorkflow(implementWorkflowPath));
			assert.ok(
				/pnpm install --frozen-lockfile/.test(wf),
				'pnpm install --frozen-lockfile fehlt in claude-implement.yml',
			);
		});

		it('führt lefthook install explizit aus', () => {
			const wf = squash(readWorkflow(implementWorkflowPath));
			assert.ok(
				/lefthook install/.test(wf),
				'lefthook install fehlt in claude-implement.yml — Hooks müssen explizit installiert werden, da CI=true das prepare-Script überspringt',
			);
		});

		it('lefthook install steht in einem eigenen run-Schritt', () => {
			const wf = readWorkflow(implementWorkflowPath);
			const pnpmExecPattern = /pnpm exec lefthook install/;
			assert.ok(
				pnpmExecPattern.test(wf),
				'lefthook install muss als run:-Schritt (pnpm exec lefthook install) in claude-implement.yml stehen',
			);
		});
	});

	describe('AK 3 — pnpm knip wird vor jedem Commit geprüft', () => {
		it('claude-pr-fixup.yml Prompt enthält pnpm knip', () => {
			const wf = readWorkflow(fixupWorkflowPath);
			assert.match(
				wf,
				/pnpm knip/,
				'pnpm knip fehlt im Prompt von claude-pr-fixup.yml — knip prüft ungenutzte Exporte/Imports wie der lefthook pre-commit-Hook',
			);
		});

		it('claude-implement.yml Prompt enthält pnpm knip', () => {
			const wf = readWorkflow(implementWorkflowPath);
			assert.match(
				wf,
				/pnpm knip/,
				'pnpm knip fehlt im Prompt von claude-implement.yml — knip muss als Pre-Commit-Prüfung explizit genannt sein',
			);
		});

		it('pnpm knip steht im Fixup-Prompt zusammen mit pnpm format und pnpm lint', () => {
			const wf = squash(readWorkflow(fixupWorkflowPath));
			// Alle drei Prüfungen müssen im Prompt erwähnt sein (Reihenfolge egal)
			assert.ok(
				/pnpm format/.test(wf) && /pnpm lint/.test(wf) && /pnpm knip/.test(wf),
				'claude-pr-fixup.yml Prompt muss pnpm format, pnpm lint UND pnpm knip enthalten',
			);
		});
	});
});
