import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Der `name:` des Review-Workflows ist LASTEND: claude-pr-gate-merge.yml hört per
 * `workflow_run` auf eine Allowlist von Workflow-NAMEN und filtert seine Check-Buckets
 * über denselben String. Stimmen die beiden nicht überein, feuert das Gate nie und
 * meldet auch nichts — ein PR bleibt einfach für immer liegen. Genau davor warnt der
 * Kopf von 05-claude-pr-review.yml ("Umbenennen schaltet das Gate lautlos ab").
 *
 * Bis hierher war diese Warnung ein Kommentar. Beim Umnummerieren auf das 6-Phasen-
 * Schema (5/7 → 5/6, ADR-0005) musste derselbe String an fünf Stellen mitwandern —
 * eine übersehene hätte das Gate stillgelegt, ohne dass irgendein Lauf rot wird.
 * Dieser Test macht daraus einen roten Test.
 *
 * Bewusst textuell (kein YAML-Parser): Geprüft wird exakt das, was GitHub sieht — der
 * String. Ein Parser würde `workflows: ['CI', '5/6 Review']` normalisieren und damit
 * genau die Tippfehler-Klasse verstecken, um die es geht.
 */

const workflows = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'workflows');
const read = (file: string) => readFileSync(join(workflows, file), 'utf8');

/** Erste `name:`-Zeile auf Spalte 0 = der Workflow-Name (Job-/Step-Namen sind eingerückt). */
const workflowName = (file: string): string => {
	const match = read(file).match(/^name:\s*(.+?)\s*$/m);
	assert.ok(match, `${file}: kein Workflow-\`name:\` gefunden`);
	return match[1].replace(/^['"]|['"]$/g, '');
};

const REVIEW_FILE = '05-claude-pr-review.yml';
const GATE_FILE = 'claude-pr-gate-merge.yml';

describe('Workflow-Namensvertrag — Gate ↔ Review', () => {
	it('das Gate horcht per workflow_run auf genau den Namen, den der Review-Workflow trägt', () => {
		const name = workflowName(REVIEW_FILE);
		const gate = read(GATE_FILE);

		const allowlist = gate.match(/^\s*workflows:\s*\[(.+)\]\s*$/m);
		assert.ok(allowlist, `${GATE_FILE}: keine \`workflows: [...]\`-Allowlist gefunden`);

		const entries = allowlist[1].split(',').map((e) => e.trim().replace(/^['"]|['"]$/g, ''));
		assert.ok(
			entries.includes(name),
			`${GATE_FILE} horcht auf [${entries.join(', ')}], aber ${REVIEW_FILE} heißt '${name}'. ` +
				`Das Gate würde nie feuern — und das lautlos.`,
		);
	});

	it('jeder .workflow-Vergleich in Gate und Review nennt einen existierenden Workflow-Namen', () => {
		// Die jq-Filter beider Dateien vergleichen `.workflow` gegen Literale ("CI",
		// "5/6 Review"). Ein Literal, das keinen Workflow trifft, lässt den Bucket leer —
		// das Gate zählt dann 0 Reviews und merged nie (oder, schlimmer, es zählt einen
		// Pflicht-Check nicht mit und merged zu früh).
		const known = new Set(
			readdirSync(workflows)
				.filter((f) => f.endsWith('.yml'))
				.map((f) => workflowName(f)),
		);

		for (const file of [GATE_FILE, REVIEW_FILE]) {
			const literals = [...read(file).matchAll(/\.workflow\s*==\s*"([^"]+)"/g)].map((m) => m[1]);
			assert.ok(literals.length > 0, `${file}: keine \`.workflow == "..."\`-Vergleiche gefunden — Test veraltet?`);
			for (const literal of literals) {
				assert.ok(
					known.has(literal),
					`${file} vergleicht gegen '${literal}', aber kein Workflow in .github/workflows heißt so. ` +
						`Bekannt: ${[...known].sort().join(', ')}`,
				);
			}
		}
	});
});

describe('Workflow-Namensvertrag — Phasen-Nummerierung', () => {
	it('die Phasen-Workflows tragen eine lückenlose 0..6-Nummerierung im 6er-Schema', () => {
		// Die Nummer im Namen ist die einzige Stelle, an der ein Mensch die Pipeline-Länge
		// abliest. Nach dem Zusammenlegen von Fixup und Umsetzung (ADR-0005) gibt es sechs
		// Pipeline-Phasen (1..6), dazu Phase 0 (Setup) — zusammen 7 Workflows (00..06).
		// Ein zurückgebliebenes "x/7" wäre schlicht eine Falschaussage.
		const phaseFiles = readdirSync(workflows)
			.filter((f) => /^\d\d-.*\.yml$/.test(f))
			.sort();

		const seen = phaseFiles.map((f) => {
			const name = workflowName(f);
			const match = name.match(/^(\d)\/(\d)\s/);
			assert.ok(match, `${f}: Name '${name}' folgt nicht dem Schema '<n>/<gesamt> <Titel>'`);
			assert.equal(match[2], '6', `${f}: Name '${name}' nennt eine andere Phasenzahl als 6`);
			return Number(match[1]);
		});

		assert.deepEqual(
			seen,
			[...Array(seen.length).keys()],
			`Phasen-Nummern sind nicht lückenlos aufsteigend: ${seen.join(', ')} ` + `(Dateien: ${phaseFiles.join(', ')})`,
		);
	});
});
