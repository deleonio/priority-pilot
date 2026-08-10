import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Statische Trigger-/Struktur-Tests für den PR-Post-Merge-Documenter (jetzt LLM-Phase 6).
//
// Der Workflow wurde von einem 12-PR-Batch mit deterministischem grep/Template auf EINEN PR
// pro Lauf mit Claude-Analyse umgebaut. Dieser Test sichert die TRIGGER-STRUKTUR, die das
// Over-Triggering konstruktiv verhindert (pull_request:[closed] + if: merged, Issue #496),
// den manuellen Catch-up-Pfad (workflow_dispatch mit pr-number), die pro-PR-concurrency sowie
// die Ticket-Memory-Abbau-Struktur. Die verhaltensbasierten AKs sind am echten Merge per
// `gh run list` zu verifizieren.
//
// Dedup: LLM-Setup (setup-claude, claude -p, model) und Label-Sicherung liegen in
// pr-post-merge-documenter-robustness.test.ts; App-only-Token auch in workflow-invariants.test.ts.

const HERE = dirname(fileURLToPath(import.meta.url));
const WF = readFileSync(join(HERE, 'pr-post-merge-documentation.yml'), 'utf8');

// Kommentarzeilen raus — Beispiele/Erklaerungen im Kopf duerfen nicht als Trigger durchgehen.
const code = WF.split('\n')
	.filter((l) => !/^\s*#/.test(l))
	.join('\n');

// `on:`-Block: von `^on:` bis zum naechsten Top-Level-Key (`concurrency:`).
const start = code.search(/^on:/m);
assert.ok(start !== -1, 'on:-Sektion in pr-post-merge-documentation.yml nicht gefunden');
const onRest = code.slice(start);
const onEnd = onRest.search(/\nconcurrency:/);
const onBlock = onEnd === -1 ? onRest : onRest.slice(0, onEnd);

// Top-Level-Block-Extraktion: vom Key bei Spalte 0 bis zum naechsten Top-Level-Key
// (naechste Zeile, die mit einem Kleinbuchstaben beginnt — `permissions:`, `env:` etc.).
const block = (key: string): string | null => {
	const m = code.match(new RegExp(`^${key}:\\n([\\s\\S]*?)\\n(?=[a-z])`, 'm'));
	return m ? m[1] : null;
};

describe('Issue #496 AK1 — Trigger an echten Merge koppeln', () => {
	// Root Cause (Issue #496): `workflow_run ... types: [completed]` feuert bei JEDEM Abschluss
	// des Gate-Workflows — der laeuft aber permanent. Ein Merge ist nur einer von vielen
	// Abschluesen → Ueber-Ausloesung. Die Loesung koppelt den Trigger an den echten Merge.
	it('die on:-Sektion enthaelt KEINEN workflow_run-Trigger mehr (Over-Trigger-Quelle)', () => {
		assert.doesNotMatch(
			onBlock,
			/workflow_run/,
			'on: enthaelt noch workflow_run auf dem Gate-Workflow — das triggert bei jedem Gate-Abschluss, ' +
				'nicht nur beim Merge. Erwartet: pull_request: [closed] + if: github.event.pull_request.merged == true.',
		);
	});

	it('die on:-Sektion traegt pull_request mit types: [closed]', () => {
		// pull_request:[closed] feuert pro geschlossenem PR genau einmal. Der Merge-Filter selbst
		// ist der Job-Guard (siehe naechster Test).
		assert.match(
			onBlock,
			/pull_request:\s*\n\s*types:\s*\[[^\]]*\bclosed\b[^\]]*\]/,
			'pull_request-Trigger mit types: [closed] fehlt — ohne ihn ist der Workflow nicht an den Merge gekoppelt.',
		);
	});

	it('der Documenter-Job traegt if: github.event.pull_request.merged == true', () => {
		// pull_request:[closed] feuert auch beim SCHLIESSEN-ohne-Merge. Nur der merged-Guard
		// schaltet diese Nicht-Merge-Closes aus → sichert AK2 (kein Over-Trigger) und AK3
		// (pro Merge genau ein Lauf).
		assert.match(
			code,
			/if:\s*github\.event\.pull_request\.merged\s*==\s*true/,
			'Job ohne if: github.event.pull_request.merged == true — bei pull_request:[closed] wuerde er auch bei ' +
				'Schliessen-ohne-Merge feuern (Over-Trigger statt "genau einmal pro Merge").',
		);
	});
});

describe('Issue #496 AK4 — manueller Catch-up (workflow_dispatch) mit Single-PR-Eingabe', () => {
	it('die on:-Sektion behaelt workflow_dispatch', () => {
		// workflow_dispatch ist der manuelle Catch-up-Pfad fuer liegengebliebene, gemergte PRs (AK4).
		assert.match(
			onBlock,
			/workflow_dispatch:/,
			'workflow_dispatch fehlt — manueller Catch-up-Lauf (AK4) waere nicht mehr moeglich.',
		);
	});

	it('der workflow_dispatch-Input ist pr-number (Single-PR), nicht mehr max-prs (Batch)', () => {
		// Der Batch-Betrieb (max-prs) ist entfernt: Catch-up laeuft fuer EINEN PR. Ein vergessener
		// Umbau auf pr-number wuerde den manuellen Pfad still gegen das alte Batch-Field verkabeln.
		assert.match(
			onBlock,
			/pr-number:/,
			'workflow_dispatch-Input "pr-number" fehlt — Catch-up kann keinen PR aufloesen.',
		);
		assert.doesNotMatch(
			onBlock,
			/max-prs/,
			'workflow_dispatch nutzt noch "max-prs" (Batch-Feld) — der Single-PR-Umbau ist unvollstaendig.',
		);
	});
});

describe('Concurrency — pro-PR keyed (parallel statt serial)', () => {
	it('die concurrency.group ist pro-PR keyed (github.event.pull_request.number)', () => {
		// Kurz hintereinander gemergte PRs sollen parallel laufen, nicht serialisieren. Eine
		// globale Gruppe (ohne .number) wuerde sie nacheinander reihen → kuenstlicher Stau.
		const conc = block('concurrency');
		assert.ok(conc, 'kein top-level concurrency:-Block gefunden');
		assert.match(
			conc,
			/github\.event\.pull_request\.number/,
			'concurrency.group referenziert nicht github.event.pull_request.number — gemergte PRs wuerden serialisieren statt parallel laufen.',
		);
	});
});

describe('App-only-Token — gh-Aufrufe nutzen das App-Token, nicht github.token', () => {
	// Root Cause (PR #501, [[claude-phase-push-app-token-not-github-token]]): ein Step, der gh
	// unter GITHUB_TOKEN (github.token) ausfuehrt, pusht/labelt als github-actions[bot] statt als
	// App — Folge-Workflows loesen nicht aus, die Label-Kette bricht still. Der Documenter setzt
	// ai:documented (Idempotät) und muss das ueber das App-Token tun. setup-claude liefert es als
	// steps.setup.outputs.gh-token; github.token als GH_TOKEN ist die Anti-Muster-Regression.
	it('kein GH_TOKEN ist auf ${{ github.token }} gebunden (App-only-Pipeline)', () => {
		assert.doesNotMatch(
			code,
			/GH_TOKEN:\s*\$\{\{\s*github\.token/,
			'GH_TOKEN auf ${{ github.token }} gefunden — Label-Wechsel als github-actions[bot] loesen keine ' +
				'Folge-Workflows aus. Erwartet: App-Token via steps.setup.outputs.gh-token.',
		);
	});
});

describe('Ticket-Memory-Abbau — Documenter räumt den Cache gemergter Tickets ab', () => {
	// Die Claude-Phasen 01–05 schreiben pro Issue nach .claude/ticket-memory/ und persistieren das
	// via actions/cache/save unter Key `ticket-{issue-number}-*`. Nach Merge ist der Memory stale →
	// der Documenter (terminale Phase 6) baut ihn ab. Die statischen AKs sichern die STRUKTUR.
	it('permissions gewährt actions: write (sonst scheitert gh cache delete still)', () => {
		// Still-Fall: ohne actions:write schlägt `gh cache delete` fehl. Weil der Drain best-effort
		// läuft (`|| true`), schluckt er den Fehler → grüner Lauf, aber nichts wird abgebaut.
		const perms = block('permissions');
		assert.ok(perms, 'kein top-level permissions-Block gefunden');
		assert.match(
			perms,
			/actions:\s*write/,
			'permissions ohne actions:write — gh cache delete schlägt fehl, das || true verschluckt es → still grün, Memory wird nicht abgebaut.',
		);
	});

	it('der Drain löscht Ticket-Caches (gh cache delete auf ticket-Präfix)', () => {
		assert.match(code, /gh cache delete/, 'kein `gh cache delete` — Ticket-Memory wird nirgends abgebaut.');
		// `gh cache list --key "ticket-…` findet die Caches zum Issue/PR; ohne sie löschte der
		// Drain ins Leere (oder fälschlich Caches anderer Tickets).
		assert.match(
			code,
			/--key\s+"ticket-/,
			'kein `gh cache list --key "ticket-…" — der Drain zielt nicht auf das Ticket-Präfix.',
		);
	});
});
