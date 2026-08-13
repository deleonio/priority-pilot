/**
 * Rote Spec-Tests für Issue #595
 *
 * "CI Legacy-Vergleich Härte-Maßnahmen: Shell-Disciplin-Querschnitt" (Teil von #572)
 *
 * Akzeptanzkriterien (aus Issue-Body):
 *
 * AK 1.1 — jq-Null-Sicherheit
 * - Alle jq-Feldzugriffe mit ?-Suffix oder | select(. != null) gesichert
 * - Negativ-Test: {} → .missingField ohne ? bricht ab (Exit 0 unter set -e)
 *
 * AK 1.2 — jq-Injection-Block
 * - Keine jq-String-Interpolation mit $VAR (Injection-Gefahr)
 * - Konsequent $ENV.VAR statt $VAR
 * - Negativ-Test: Injection-Vektor → Pipeline nutzt $ENV, Vektor geblockt
 *
 * AK 1.3 — BSD-kompatible grep/sed
 * - Kein grep -P/-oP (nicht BSD-kompatibel)
 * - Negativ-Test: grep -P schlägt auf BSD grep fehl
 *
 * AK 1.4 — || true für legalen No-Match
 * - grep -vE unter set -euo pipefail mit || true gesichert
 * - Negativ-Test: Test ohne Match → Exit 0 via || true
 *
 * Diese Tests validieren die Workflow-Dateien direkt (YAML-Parsing).
 * Sie sind ROT, solange die Workflows die Shell-Discipline-Verletzung enthalten,
 * und werden GRÜN, sobald alle Fixes implementiert sind.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

interface WorkflowTest {
	file: string;
	line: number;
	pattern: string;
	description: string;
}

function readWorkflows(): { name: string; content: string }[] {
	return readdirSync(WORKFLOWS_DIR)
		.filter((f) => f.endsWith('.yml'))
		.map((f) => ({
			name: f,
			content: readFileSync(join(WORKFLOWS_DIR, f), 'utf-8'),
		}));
}

/**
 * Prüft ob ein jq-Ausdruck Null-Sicherheit für Array-Zugriffe hat.
 * Sichere Konstrukte:
 * - .field[]? - ? auf dem Array
 * - .field[].sub? - ? auf dem Unterelement
 * - any(.[]; ...) - any ist null-sicher
 * - [.[] | ...] - Array-Comprehension ist null-sicher
 * - map(.[]) - map ist null-sicher
 * - gh ... --jq mit || true - Fallback geschützt
 */
function isJqNullSafe(jqExpr: string): boolean {
	// .field[]? oder .field[].sub?
	if (jqExpr.includes('[]?') || /\.\w+\[\]\.\w+\?/.test(jqExpr)) {
		return true;
	}

	// any(.[]; ...) - any ist null-sicher bei leerem Array
	if (/any\s*\(\s*\.\[\]/.test(jqExpr)) {
		return true;
	}

	// [.[] | ...] oder [.field[] | ...] - Array-Comprehension
	if (/^\[\s*\.\w*\[\]/.test(jqExpr)) {
		return true;
	}

	// map(.[]) - map ist null-sicher
	if (/map\s*\(\s*\.\[\]/.test(jqExpr)) {
		return true;
	}

	return false;
}

describe('Issue #595 — CI Shell-Discipline-Querschnitt', () => {
	describe('AK 1.1 — jq-Null-Sicherheit', () => {
		it('verhindert unsichere jq-Feld-Array-Zugriff ohne ? und ohne || true', () => {
			const workflows = readWorkflows();
			const findings: WorkflowTest[] = [];

			workflows.forEach((wf) => {
				const lines = wf.content.split('\n');
				lines.forEach((line, idx) => {
					// Kommentare ignorieren
					if (line.trim().startsWith('#')) return;

					// Gesichert durch || true → OK
					if (line.includes('|| true')) return;

					// jq-Ausdruck extrahieren: echo "$var" | jq -r '...'
					const jqMatch = line.match(/echo.*\|.*jq\s+-r\s+'([^']+)'/);
					if (jqMatch) {
						const jqExpr = jqMatch[1];

						if (!isJqNullSafe(jqExpr)) {
							// Prüfe ob .field[] vorkommt (potenziell unsicher)
							const unsafeAccess = jqExpr.match(/\.\w+\[\](?!\?)/);
							if (unsafeAccess) {
								findings.push({
									file: wf.name,
									line: idx + 1,
									pattern: jqExpr,
									description: 'jq-Feld-Array-Zugriff ohne ? bei potenziell null-Fields',
								});
							}
						}
					}
				});
			});

			assert.strictEqual(
				findings.length,
				0,
				`Gefunden: ${findings.length} unsichere jq-Feld-Array-Zugriffe ohne ? und ohne || true Fallback. ` +
					`Diese brechen unter set -e ab wenn das Feld null ist. ` +
					`Mit ? sichern: .field[]? oder .field[].name?, oder || true Fallback hinzufügen.\n` +
					findings.map((f) => `  ${f.file}:${f.line}: ${f.pattern}`).join('\n'),
			);
		});

		it('akzeptiert sichere jq-Feldzugriffe mit ?', () => {
			const workflows = readWorkflows();
			let safeCount = 0;

			workflows.forEach((wf) => {
				// Safe: .labels[]? oder .field[]? oder .field[].name?
				const safe = wf.content.match(/\.\w+\[\]\?|\.\[\]\.\w+\?|\.\w+\[\]\.\w+\?/g);
				if (safe) safeCount += safe.length;
			});

			assert.ok(
				safeCount > 0,
				'Erwartung: Mindestens ein sicherer jq-Zugriff mit ? existiert (z.B. .field[]? oder .field[].name?)',
			);
		});
	});

	describe('AK 1.2 — jq-Injection-Block', () => {
		it('verhindert jq-String-Interpolation mit Shell-Variablen', () => {
			const workflows = readWorkflows();
			const findings: WorkflowTest[] = [];

			workflows.forEach((wf) => {
				const lines = wf.content.split('\n');
				lines.forEach((line, idx) => {
					// Kommentare ignorieren
					if (line.trim().startsWith('#')) return;

					// Unsafe: "'"${VAR}"'" innerhalb von --jq
					// Pattern: --jq ... " '"${VAR}"' ...
					const match = line.match(/--jq.*" '"\$\{?[A-Z_]+\}?"'/);
					if (match) {
						findings.push({
							file: wf.name,
							line: idx + 1,
							pattern: match[0],
							description: 'jq mit Shell-String-Interpolation → Injection-Vektor. Nutze $ENV.VAR stattdessen.',
						});
					}
				});
			});

			assert.strictEqual(
				findings.length,
				0,
				`Gefunden: ${findings.length} jq-Aufrufe mit unsicherer Shell-Variablen-Interpolation. ` +
					`Injection-Gefahr. ` +
					`Mit $ENV.VAR sichern.\n` +
					findings.map((f) => `  ${f.file}:${f.line}: ${f.pattern}`).join('\n'),
			);
		});

		it('akzeptiert jq mit $ENV-Variablen', () => {
			const workflows = readWorkflows();
			let envCount = 0;

			workflows.forEach((wf) => {
				// Safe: $ENV.VAR
				const safe = wf.content.match(/\$ENV\.[A-Z_]+/g);
				if (safe) envCount += safe.length;
			});

			assert.ok(envCount > 0, 'Erwartung: Mindestens ein jq-Aufruf nutzt $ENV.VAR (Injection-sicher)');
		});
	});

	describe('AK 1.3 — BSD-kompatible grep/sed', () => {
		it('verhindert grep -P (nicht BSD-kompatibel)', () => {
			const workflows = readWorkflows();
			const findings: WorkflowTest[] = [];

			workflows.forEach((wf) => {
				const lines = wf.content.split('\n');
				lines.forEach((line, idx) => {
					// Kommentare ignorieren
					if (line.trim().startsWith('#')) return;

					const match = line.match(/grep\s+-P/);
					if (match) {
						findings.push({
							file: wf.name,
							line: idx + 1,
							pattern: match[0],
							description: 'grep -P (nicht BSD-kompatibel)',
						});
					}
				});
			});

			assert.strictEqual(
				findings.length,
				0,
				`Gefunden: ${findings.length} grep -P Aufrufe (nicht BSD-kompatibel). ` +
					`Nutze portable Alternativen: grep -E, grep -vE, oder sed/awk.\n` +
					findings.map((f) => `  ${f.file}:${f.line}: ${f.pattern}`).join('\n'),
			);
		});

		it('verhindert grep -oP (nicht BSD-kompatibel)', () => {
			const workflows = readWorkflows();
			const findings: WorkflowTest[] = [];

			workflows.forEach((wf) => {
				const lines = wf.content.split('\n');
				lines.forEach((line, idx) => {
					// Kommentare ignorieren
					if (line.trim().startsWith('#')) return;

					const match = line.match(/grep\s+-oP/);
					if (match) {
						findings.push({
							file: wf.name,
							line: idx + 1,
							pattern: match[0],
							description: 'grep -oP (nicht BSD-kompatibel)',
						});
					}
				});
			});

			assert.strictEqual(
				findings.length,
				0,
				`Gefunden: ${findings.length} grep -oP Aufrufe (nicht BSD-kompatibel).\n` +
					findings.map((f) => `  ${f.file}:${f.line}: ${f.pattern}`).join('\n'),
			);
		});
	});

	describe('AK 1.4 — || true für legalen No-Match', () => {
		it('verhindert grep -vE ohne || true unter set -euo pipefail', () => {
			const workflows = readWorkflows();
			const findings: WorkflowTest[] = [];

			workflows.forEach((wf) => {
				const lines = wf.content.split('\n');
				let inSetE = false;

				lines.forEach((line, idx) => {
					// Kommentare ignorieren
					if (line.trim().startsWith('#')) return;

					// Prüfe ob wir in einem set -euo pipefail Kontext sind
					if (line.includes('set -euo pipefail')) {
						inSetE = true;
					} else if (line.match(/^\s*[a-z_]+=/)) {
						// Variablen-Zuweisung → nicht resetten
					} else if (line.match(/^\s*[a-z_]+/)) {
						// Neue cmd → reset (einfache Heuristik)
						inSetE = false;
					}

					const match = line.match(/grep\s+-vE/);
					if (match && inSetE && !line.includes('|| true')) {
						findings.push({
							file: wf.name,
							line: idx + 1,
							pattern: match[0],
							description: 'grep -vE ohne || true unter set -euo pipefail → Abort bei No-Match',
						});
					}
				});
			});

			assert.strictEqual(
				findings.length,
				0,
				`Gefunden: ${findings.length} grep -vE ohne || true unter set -euo pipefail. ` +
					`Bei "no match" bricht die Pipeline ab. Mit || true sichern: grep -vE ... || true\n` +
					findings.map((f) => `  ${f.file}:${f.line}: ${f.pattern}`).join('\n'),
			);
		});
	});
});
