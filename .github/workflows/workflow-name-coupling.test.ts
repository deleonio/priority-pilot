import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Kreuzverhör G1: Workflow-Namen sind lastende String-Kopplungen. Spec/Implement/Review/Fixup
// finden sich selbst per exaktem `name:` im Skip-/Supersede-Guard (jq select(.name == "..."));
// claude-pr-gate-merge.yml matcht per workflow_run-Allowlist ['CI', 'Claude PR Review …'].
// Ein Rename schaltet den Guard lautlos ab (Duplikat-Läufe, Gate schweigt). 02/03 trugen zwar
// Warn-Kommentare, 04/05/gate-merge nicht — und kein Test sicherte die Kopplung. Dieser Test
// stellt sicher, dass JEDER Name-Selektor und JEDER workflow_run-Eintrag auf einen vorhandenen
// Workflow-`name:` zeigt. Breakt beim nächsten Rename sofort rot.
//
// Testebene: statische Auswertung der Workflow-YAMLs (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const readWf = (f: string): string => readFileSync(join(HERE, f), 'utf8');
const ymlFiles = readdirSync(HERE).filter((f) => f.endsWith('.yml'));

// Menge aller deklarierten Workflow-Namen (aus der `name:`-Zeile, Quotes wie bei CodeQL strippen).
const declaredNames = new Set(
	ymlFiles.flatMap((f) => {
		const m = readWf(f).match(/^name:\s*(.+)$/m);
		return m ? [m[1].trim().replace(/^['"]|['"]$/g, '')] : [];
	}),
);

// Kommentarzeilen entfernen — sonst schlagen Erklaerungen (z. B. die Rename-Warnung selbst)
// als Selektor durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

describe('G1 — Workflow-Name-Selektoren zeigen alle auf vorhandene Workflows', () => {
	it('es gibt ueberhaupt deklarierte Workflow-Namen (sonst prueft der Test ins Leere)', () => {
		assert.ok(declaredNames.size > 0, 'keine `name:`-Deklarationen gefunden — Parser kaputt?');
		// Negativ-Abgrenzung: die gekoppelten Namen muessen in der Menge sein (Extraction greift).
		for (const expected of [
			'Claude Spec (ai:spec-ready)',
			'Claude Implement (ai:ready)',
			'Claude PR Review (Kreuzverhoer)',
			'Claude PR Fixup (Findings umsetzen)',
			'CI',
		]) {
			assert.ok(declaredNames.has(expected), `erwarteter Workflow-Name fehlt: ${expected}`);
		}
	});

	// Skip-/Supersede-Guards: select(.name == "...") muss auf einen vorhandenen Workflow zeigen.
	// (Label-Checks der Form any(.labels[]; .name == "ai:continued") nutzen .name ohne select()
	// und werden hier bewusst NICHT erfasst.)
	it('jeder select(.name == "...")-Selektor trifft einen vorhandenen Workflow', () => {
		const selectors: { file: string; name: string }[] = [];
		for (const f of ymlFiles) {
			for (const m of [...codeOf(readWf(f)).matchAll(/select\(\s*\.name\s*==\s*"([^"]+)"/g)]) {
				selectors.push({ file: f, name: m[1] });
			}
		}
		assert.ok(selectors.length > 0, 'kein select(.name == "...") gefunden — Extraktion kaputt?');
		for (const { file, name } of selectors) {
			assert.ok(
				declaredNames.has(name),
				`${file}: select(.name == "${name}") trifft keinen Workflow mit diesem \`name:\` — ` +
					'Guard ist lautlos abgeschaltet (Rename ohne Test-Deckung).',
			);
		}
	});

	// gate-merge workflow_run-Allowlist: jeder Eintrag muss auf einen vorhandenen Workflow zeigen.
	it('jeder workflow_run-Allowlist-Eintrag in gate-merge trifft einen vorhandenen Workflow', () => {
		const gate = codeOf(readWf('claude-pr-gate-merge.yml'));
		const allowlist = gate.match(/workflows:\s*\[([^\]]+)\]/);
		assert.ok(allowlist, 'workflow_run-Allowlist (workflows: [...]) in gate-merge nicht gefunden');
		const entries = [...allowlist![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
		assert.ok(entries.length > 0, 'Allowlist hat keine Eintraege — Extraktion kaputt?');
		for (const name of entries) {
			assert.ok(
				declaredNames.has(name),
				`gate-merge workflow_run-Allowlist-Eintrag '${name}' trifft keinen Workflow mit diesem ` +
					'`name:` — Gate schaltet lautlos ab (Rename ohne Test-Deckung).',
			);
		}
	});
});
