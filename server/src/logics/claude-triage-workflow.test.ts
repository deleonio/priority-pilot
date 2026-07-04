/**
 * Rote Spec-Tests (TDD) für Issue #253
 *
 * Betrifft: .github/workflows/claude-triage.yml
 *
 * Ziel: Die `if`-Bedingung des `triage`-Jobs muss erweitert werden, damit
 *   1. das Entfernen des Labels `ai:to-big-issue` (unlabeled) den Triage-Job
 *      ebenfalls startet (neben `ai:analyzed`), und
 *   2. der `!contains(... 'ai:analyzed')`-Guard NICHT mehr global gilt, sondern
 *      nur noch im `opened`-Zweig. Beim Entfernen von `ai:to-big-issue` kann
 *      `ai:analyzed` noch am Issue hängen — ein globaler Guard würde AK1
 *      (Timeout-Szenario) fälschlich blockieren.
 *
 * Akzeptanzkriterien:
 *   AK1: Entfernen von `ai:to-big-issue` bei offenem Issue mit BEIDEN Labels
 *        (`ai:analyzed` + `ai:to-big-issue`) startet den Job. -> Guard darf NICHT global sein.
 *   AK2: Entfernen von `ai:to-big-issue` ohne `ai:analyzed` startet den Job.
 *   AK3: Entfernen von `ai:analyzed` startet den Job weiterhin.
 *   AK4: Neu geöffnetes Issue mit bereits vorhandenem `ai:analyzed` triggert NICHT.
 *        -> Guard muss im `opened`-Zweig stehen.
 *   AK5: Neu geöffnetes Issue durch OWNER/MEMBER/COLLABORATOR ohne `ai:analyzed` triggert.
 *   AK6: Entfernen eines anderen Labels (z. B. `bug`) startet den Workflow NICHT.
 *   AK7: Der Workflow triggert nicht bei geschlossenen Issues.
 *
 * Die Tests prüfen ausschließlich den Dateiinhalt der Workflow-YAML als Text.
 * Sie sind mit der AKTUELLEN YAML ROT und werden GRÜN, sobald die if-Bedingung
 * gemäß Issue #253 umgebaut ist.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Tests laufen aus dem server/-Package-Root; .. erreicht das Repo-Root.
const ROOT = resolve(process.cwd(), '..');
const WORKFLOW_PATH = resolve(ROOT, '.github/workflows/claude-triage.yml');

/**
 * Liest die komplette Workflow-Datei als Text.
 */
function readWorkflow(): string {
	return readFileSync(WORKFLOW_PATH, 'utf-8');
}

/**
 * Extrahiert den Inhalt der `if:`-Bedingung des Jobs.
 *
 * Die Bedingung steht als YAML-Block-Skalar (`if: >-`) und umfasst alle Zeilen
 * bis zum nächsten Schlüssel auf gleicher Einrückung (hier `runs-on:`).
 * Kommentare (# ...) sowie `if:` selbst werden entfernt, damit ausschließlich
 * der GitHub-Actions-Ausdruck geprüft wird (verhindert Fehltreffer durch
 * erläuternde Kommentare oberhalb der Bedingung).
 */
function extractIfCondition(yaml: string): string {
	const match = yaml.match(/\n\s*if:\s*>-\s*\n([\s\S]*?)\n\s*runs-on:/);
	assert.ok(match, 'if:-Bedingung des triage-Jobs (if: >- ... runs-on:) nicht gefunden');
	return match[1]
		.split('\n')
		.filter((line) => !line.trim().startsWith('#'))
		.join('\n');
}

/**
 * Zerlegt die if-Bedingung in ihre beiden Ausloeser-Zweige.
 * Struktur (Soll): "... && ( (action == 'opened' && ...) || (action == 'unlabeled' && ...) )"
 *
 * openedBranch: alles ab `action == 'opened'` bis zum verbindenden `||` vor dem unlabeled-Zweig.
 * unlabeledBranch: alles ab `action == 'unlabeled'` bis zum Ende.
 */
function extractBranches(condition: string): { openedBranch: string; unlabeledBranch: string } {
	const openedIdx = condition.indexOf("github.event.action == 'opened'");
	const unlabeledIdx = condition.indexOf("github.event.action == 'unlabeled'");
	assert.ok(openedIdx !== -1, "opened-Zweig (action == 'opened') nicht gefunden");
	assert.ok(unlabeledIdx !== -1, "unlabeled-Zweig (action == 'unlabeled') nicht gefunden");
	assert.ok(openedIdx < unlabeledIdx, 'opened-Zweig muss vor dem unlabeled-Zweig stehen');
	return {
		openedBranch: condition.slice(openedIdx, unlabeledIdx),
		unlabeledBranch: condition.slice(unlabeledIdx),
	};
}

describe('claude-triage.yml – if-Bedingung des triage-Jobs (Issue #253)', () => {
	it('Datei und if-Bedingung sind vorhanden und parsebar', () => {
		const yaml = readWorkflow();
		const condition = extractIfCondition(yaml);
		assert.ok(condition.length > 0, 'if-Bedingung ist leer');
		// Es gibt genau eine if:-Job-Bedingung in dieser Datei.
		const ifCount = (yaml.match(/\n\s*if:\s*>-/g) ?? []).length;
		assert.equal(ifCount, 1, 'Es wird genau eine if: >- Job-Bedingung erwartet');
	});

	it('AK7: Der Job triggert nur bei offenen Issues (state == \'open\')', () => {
		const condition = extractIfCondition(readWorkflow());
		assert.match(
			condition,
			/github\.event\.issue\.state == 'open'/,
			"Bedingung muss state == 'open' fordern (AK7)",
		);
	});

	it('AK1+AK2: Der unlabeled-Zweig akzeptiert das Label ai:to-big-issue', () => {
		const condition = extractIfCondition(readWorkflow());
		const { unlabeledBranch } = extractBranches(condition);
		assert.match(
			unlabeledBranch,
			/github\.event\.label\.name == 'ai:to-big-issue'/,
			"Der unlabeled-Zweig muss auf label.name == 'ai:to-big-issue' prüfen (AK1/AK2)",
		);
	});

	it('AK3: Der unlabeled-Zweig akzeptiert weiterhin das Label ai:analyzed', () => {
		const condition = extractIfCondition(readWorkflow());
		const { unlabeledBranch } = extractBranches(condition);
		assert.match(
			unlabeledBranch,
			/github\.event\.label\.name == 'ai:analyzed'/,
			"Der unlabeled-Zweig muss weiterhin auf label.name == 'ai:analyzed' prüfen (AK3)",
		);
	});

	it('AK1+AK4: Der ai:analyzed-Guard steht im opened-Zweig, NICHT global', () => {
		const condition = extractIfCondition(readWorkflow());
		const { openedBranch } = extractBranches(condition);

		// Der Guard muss im opened-Zweig stehen (AK4: bereits analysiertes neues Issue nicht triggern).
		assert.match(
			openedBranch,
			/!contains\(github\.event\.issue\.labels\.\*\.name, 'ai:analyzed'\)/,
			"Der opened-Zweig muss den Guard !contains(... 'ai:analyzed') enthalten (AK4)",
		);

		// AK1: Der Guard darf NICHT mehr global (vor den beiden Zweigen) gelten,
		// sonst blockiert er das Entfernen von ai:to-big-issue, wenn ai:analyzed noch hängt.
		const openedIdx = condition.indexOf("github.event.action == 'opened'");
		const globalScope = condition.slice(0, openedIdx);
		assert.doesNotMatch(
			globalScope,
			/!contains\(github\.event\.issue\.labels\.\*\.name, 'ai:analyzed'\)/,
			"Der ai:analyzed-Guard darf nicht mehr global (vor dem opened-Zweig) stehen (AK1)",
		);
	});

	it('AK5: Der opened-Zweig verlangt Schreibzugriff (OWNER/MEMBER/COLLABORATOR)', () => {
		const condition = extractIfCondition(readWorkflow());
		const { openedBranch } = extractBranches(condition);
		for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
			assert.match(
				openedBranch,
				new RegExp(`author_association == '${role}'`),
				`Der opened-Zweig muss author_association == '${role}' erlauben (AK5)`,
			);
		}
	});

	it('AK6: Der unlabeled-Zweig prüft konkrete Label-Namen und nutzt keinen Wildcard', () => {
		const condition = extractIfCondition(readWorkflow());
		const { unlabeledBranch } = extractBranches(condition);
		// Es muss explizit auf label.name == '...' geprüft werden.
		assert.match(
			unlabeledBranch,
			/github\.event\.label\.name ==/,
			'Der unlabeled-Zweig muss explizit auf github.event.label.name prüfen (AK6)',
		);
		// Der unlabeled-Zweig darf genau auf die zwei erlaubten Labels beschränkt sein:
		// ai:analyzed und ai:to-big-issue. Kein anderes Label (z. B. bug) darf triggern.
		const allowedLabels = unlabeledBranch.match(/github\.event\.label\.name == '([^']+)'/g) ?? [];
		const names = allowedLabels.map((m) => m.replace(/.*== '/, '').replace(/'$/, ''));
		assert.deepEqual(
			[...names].sort(),
			['ai:analyzed', 'ai:to-big-issue'],
			'Der unlabeled-Zweig darf ausschließlich ai:analyzed und ai:to-big-issue erlauben (AK6)',
		);
	});
});
