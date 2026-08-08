import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Rote Spec-Tests fuer Issue #496 — "PR Post-Merge Documentation" darf nur nach einem
// ECHTEN PR-Merge triggern, nicht bei jedem Abschluss des Gate-Workflows.
//
// Testebene: statische Auswertung der Workflow-YAML (node:test via tsx, ci.yml). Die
// verhaltensbasierten AKs (AK2 kein Over-Trigger bei Nicht-Merge-Events, AK3 genau ein Lauf
// pro Merge) sind am naechsten echten Merge POST-MERGE per `gh run list` zu verifizieren —
// dieser Test sichert die TRIGGER-STRUKTUR, die das Over-Triggering konstruktiv verhindert
// (pull_request:[closed] + if: merged), sowie die Idempotenz-Invariante (AK5) und den
// manuellen Catch-up-Pfad (AK4). Quelle: Issue #496, AK1/AK4/AK5.
//
// Rot-JETZT sind die AK1-Tests (Trigger ist noch nicht umgestellt); AK4/AK5 sind
// Regression-Guards, die die Umsetzung nicht mitbrechen darf.

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

describe('Issue #496 AK1 — Trigger an echten Merge koppeln', () => {
	// Root Cause (Issue #496): `workflow_run ... types: [completed]` feuert bei JEDEM Abschluss
	// des Gate-Workflows — der laeuft aber permanent (jeder CI-/Review-/Label-Abschluss, meist
	// No-op). Ein Merge ist nur einer von vielen Abschluesen → beobachtete Ueber-Ausloesung
	// (89 Laeufe / 7 Tage bei wenigen echten Merges). Die Loesung koppelt den Trigger an den
	// echten Merge statt an den Gate-Abschluss.
	it('die on:-Sektion enthaelt KEINEN workflow_run-Trigger mehr (Over-Trigger-Quelle)', () => {
		assert.doesNotMatch(
			onBlock,
			/workflow_run/,
			'on: enthaelt noch workflow_run auf dem Gate-Workflow — das triggert bei jedem Gate-Abschluss, ' +
				'nicht nur beim Merge. Erwartet: pull_request: [closed] + if: github.event.pull_request.merged == true.',
		);
	});

	it('die on:-Sektion traegt pull_request mit types: [closed]', () => {
		// pull_request:[closed] ist das kanonische "nach Merge"-Pattern und feuert pro
		// geschlossenem PR genau einmal (auch bei Merge per App-Token). Der Merge-Filter selbst
		// ist der Job-Guard (siehe naechster Test).
		assert.match(
			onBlock,
			/pull_request:\s*\n\s*types:\s*\[[^\]]*\bclosed\b[^\]]*\]/,
			'pull_request-Trigger mit types: [closed] fehlt — ohne ihn ist der Workflow nicht an den Merge gekoppelt.',
		);
	});

	it('der document-merged-prs-Job traegt if: github.event.pull_request.merged == true', () => {
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

describe('Issue #496 AK4 — manueller Catch-up (workflow_dispatch) bleibt moeglich', () => {
	it('die on:-Sektion behaelt workflow_dispatch', () => {
		// workflow_dispatch ist der manuelle Catch-up-/Dry-Run-Pfad fuer liegengebliebene,
		// gemergte PRs (AK4). Die Trigger-Umstellung darf ihn nicht mit entfernen.
		assert.match(
			onBlock,
			/workflow_dispatch:/,
			'workflow_dispatch fehlt — manueller Catch-up-Lauf (AK4) waere nach der Umstellung nicht mehr moeglich.',
		);
	});
});

describe('Issue #496 AK5 — Phase-0-Suche & Batch unangetastet (Idempotenz)', () => {
	it('die Such-Query erfasst nur gemergte PRs ohne ai:documented und ohne release:ignore', () => {
		// Diese Query ist die Idempotenz-Invariante: bereits dokumentierte (ai:documented) und
		// explizit ignorierte (release:ignore) PRs fallen heraus, liegengebliebene gemergte
		// PRs werden mitdokumentiert. Aendert sich das, droht Doppel-Doku oder ein leerer Lauf.
		const query = code.match(/search_query="([^"]*)"/);
		assert.ok(query, 'search_query-Zuweisung in pr-post-merge-documentation.yml nicht gefunden');
		assert.match(query[1], /is:merged/, 'Such-Query ohne is:merged — keine gemergten PRs');
		assert.match(query[1], /-label:ai:documented/, 'Such-Query ohne -label:ai:documented — Gefahr der Doppel-Doku');
		assert.match(
			query[1],
			/-label:release:ignore/,
			'Such-Query ohne -label:release:ignore — ignorierte PRs wuerden erfasst',
		);
	});

	it('die Batch-Grenze bleibt Default 12 (workflow_dispatch max-prs)', () => {
		// max. 12 PRs pro Lauf schuetzt vor Rate-Limit-/Timeout-Ueberlastung beim Catch-up.
		const dispatchDefault = onBlock.match(/default:\s*'(\d+)'/);
		assert.ok(dispatchDefault, 'workflow_dispatch max-prs Default nicht gefunden');
		assert.equal(dispatchDefault[1], '12', 'max-prs Default != 12 — Batch-Grenze wurde geaendert');
	});
});
