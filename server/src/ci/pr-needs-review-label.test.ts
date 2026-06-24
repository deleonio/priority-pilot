/**
 * Rote Spec-Tests fuer Issue #116:
 * "Beim Oeffnen eines PR automatisch das `needs-review`-Label setzen".
 *
 * Das Verhalten liegt vollstaendig in einem GitHub-Actions-Workflow, der laut Triage neu
 * angelegt werden soll: `.github/workflows/pr-needs-review-label.yml`. Ein echter Workflow-Lauf
 * ist in den Projekt-Testsuites nicht ausfuehrbar — pruefbar (und als ausfuehrbarer Vertrag
 * sinnvoll) ist jedoch die WORKFLOW-DEFINITION selbst: Trigger, Bedingungen (Nicht-Draft,
 * kein Fork), das gesetzte Label, das App-Token (damit Folge-Workflows triggern) und Idempotenz.
 *
 * Diese Tests sind ROT, solange der Workflow fehlt oder den Vertrag nicht erfuellt; sie werden
 * gruen, sobald die Umsetzung den Workflow gemaess der Akzeptanzkriterien anlegt. Es wird KEIN
 * Produktivcode geschrieben — nur der Vertrag festgehalten.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/src/ci -> Repo-Wurzel
const repoRoot = join(__dirname, '..', '..', '..');
const workflowPath = join(repoRoot, '.github', 'workflows', 'pr-needs-review-label.yml');

/** Liest die Workflow-Datei roh ein; gibt '' zurueck, wenn sie (noch) fehlt. */
function readWorkflow(): string {
	return existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
}

/** Normalisiert Whitespace fuer robuste, formatunabhaengige Teilstring-Pruefungen. */
function squash(text: string): string {
	return text.replace(/\s+/g, ' ');
}

describe('Issue #116 — Auto-Labeling-Workflow pr-needs-review-label.yml', () => {
	it('Die Workflow-Datei existiert', () => {
		assert.ok(
			existsSync(workflowPath),
			`Erwartete Workflow-Datei fehlt: ${workflowPath}`,
		);
	});

	describe('AK1 — Nicht-Draft-PR erhaelt ai:needs-review beim Oeffnen', () => {
		it('triggert auf pull_request', () => {
			const wf = readWorkflow();
			assert.match(wf, /on:[\s\S]*pull_request:/, 'Trigger pull_request fehlt');
		});

		it('reagiert auf den Typ "opened"', () => {
			const wf = squash(readWorkflow());
			assert.ok(/types:\s*\[[^\]]*opened/.test(wf), 'Trigger-Typ "opened" fehlt');
		});

		it('setzt das Pipeline-Label "ai:needs-review" (nicht die Kurzform "needs-review")', () => {
			const wf = readWorkflow();
			assert.match(
				wf,
				/ai:needs-review/,
				'Workflow muss das bestehende Label "ai:needs-review" setzen',
			);
			// Es muss tatsaechlich gesetzt (add-label), nicht nur erwaehnt werden.
			assert.match(
				squash(wf),
				/--add-label[^\n]*ai:needs-review|add-label ['"]?ai:needs-review/,
				'Label muss aktiv hinzugefuegt werden (--add-label ai:needs-review)',
			);
		});
	});

	describe('AK2 — Draft-PR ausgeschlossen, erst bei ready_for_review', () => {
		it('reagiert auch auf den Typ "ready_for_review"', () => {
			const wf = squash(readWorkflow());
			assert.ok(
				/types:\s*\[[^\]]*ready_for_review/.test(wf),
				'Trigger-Typ "ready_for_review" fehlt — Draft-PRs wuerden nie gelabelt',
			);
		});

		it('schliesst Draft-PRs ueber eine if-Bedingung (draft == false) aus', () => {
			const wf = squash(readWorkflow());
			assert.ok(
				/draft\s*==\s*false/.test(wf),
				'Bedingung "draft == false" fehlt — Drafts wuerden faelschlich gelabelt',
			);
		});
	});

	describe('AK3 — Folge-Review laeuft an (App-Token statt GITHUB_TOKEN)', () => {
		it('erzeugt ein GitHub-App-Token (create-github-app-token)', () => {
			const wf = readWorkflow();
			assert.match(
				wf,
				/actions\/create-github-app-token/,
				'App-Token-Action fehlt — mit GITHUB_TOKEN gesetzte Labels triggern keine Folge-Workflows',
			);
		});

		it('verwendet die App-Secrets APP_ID und APP_PRIVATE_KEY', () => {
			const wf = readWorkflow();
			assert.match(wf, /secrets\.APP_ID/, 'secrets.APP_ID fehlt');
			assert.match(wf, /secrets\.APP_PRIVATE_KEY/, 'secrets.APP_PRIVATE_KEY fehlt');
		});
	});

	describe('AK4 — Fork-PRs ausgeschlossen', () => {
		it('beschraenkt auf denselben Repo (head.repo.full_name == github.repository)', () => {
			const wf = squash(readWorkflow());
			assert.ok(
				/head\.repo\.full_name\s*==\s*github\.repository/.test(wf),
				'Fork-Ausschluss (head.repo.full_name == github.repository) fehlt',
			);
		});
	});

	describe('AK5 — Idempotenz (kein Fehler/keine Endlosschleife bei bereits gesetztem Label)', () => {
		it('setzt das Label nur, wenn es noch nicht vorhanden ist', () => {
			const wf = squash(readWorkflow());
			// Idempotenz-Guard: entweder per if-Bedingung (Label nicht enthalten) oder per
			// expliziter contains/Pruefung vor dem add-label.
			const guarded =
				/!\s*contains\([^)]*labels[^)]*ai:needs-review/.test(wf) ||
				/labels[^\n]*ai:needs-review[\s\S]*?(&&|\|\||if)/.test(wf) ||
				/contains\([^)]*labels[^)]*ai:needs-review[^)]*\)\s*==\s*false/.test(wf);
			assert.ok(
				guarded,
				'Idempotenz-Guard fehlt — Label muss nur bei Abwesenheit gesetzt werden, um No-op-Rauschen/Schleifen zu vermeiden',
			);
		});
	});
});
