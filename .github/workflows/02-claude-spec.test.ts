import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Der HAS_TESTS-Check in 02-claude-spec.yml prueft, ob ein Spec-PR Test-Dateien enthaelt,
// und bestimmt indirekt, ob ai:ready gesetzt wird. Frueher nutzte er jq's
// test("\.(test|spec)\.(ts|tsx)$") — gojq (gh's eingebauter Parser) wertet Backslash-Escapes
// in String-Literalen als *invalid escape* (exit 1), schluckt den Fehler durch
// `2>/dev/null || echo "false"` und setzte so HAS_TESTS=false -> ai:ready wurde 20+ Laeufe
// lang nie gesetzt, bis jemand manuell eingriff (PR #485, Issue #489).
//
// Regressions-Test: das buggy Pattern darf nicht im Code vorkommen, endswith() muss verwendet
// werden, und HAS_TESTS muss via ::notice sichtbar gemacht werden (kein stilles Schlucken).
//
// Testebene: statische Auswertung von YAML (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Kommentarzeilen entfernen — sonst schlagen Erklaerungen und Beispiele als Befehl durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

describe('Spec — HAS_TESTS-Check umgeht den gojq-Backslash-Bug', () => {
	const yml = codeOf(read('.github', 'workflows', '02-claude-spec.yml'));

	it('kein jq test() mit Backslash-Escape im Pattern (gojq: invalid escape sequence)', () => {
		// gojq wertet test("\.…") als *invalid escape* — exit 1, geschluckt durch 2>/dev/null,
		// HAS_TESTS=false, ai:ready nie gesetzt. Siehe PR #485 / Issue #489.
		assert.doesNotMatch(
			yml,
			/test\("\\./,
			'jq test() mit Backslash-Escape ("\.") — gojq (gh) wertet das als invalid escape, ' +
				'schluckt den Parse-Fehler via 2>/dev/null, setzt HAS_TESTS=false und ai:ready wird nie gesetzt',
		);
	});

	it('HAS_TESTS nutzt endswith() statt test() fuer .test/.spec-Dateien', () => {
		// endswith() ist semantisch aequivalent zu \.(test|spec)\.(ts|tsx)$ und gojq-safe.
		assert.match(
			yml,
			/endswith\("\.test\.ts"\)/,
			'HAS_TESTS muss endswith()-basiert pruefen — test("\.") schlaegt in gojq fehl',
		);
	});

	it('HAS_TESTS-Wert wird via ::notice sichtbar (kein stilles 2>/dev/null-Schlucken)', () => {
		// Bevor der Bug gefunden wurde, war HAS_TESTS=false 20+ Laeufe lang unsichtbar.
		assert.match(
			yml,
			/::notice::.*HAS_TESTS/,
			'HAS_TESTS muss via ::notice sichtbar gemacht werden — 2>/dev/null hat den Fehler 20+ Laeufe lang gefuehlt',
		);
	});
});

// Kreuzverhör G5: Der Spec-Doppel-Guard skippte frueher bei JEDEM offenen PR mit Closes #N
// (Draft oder nicht). Ein vergessener Draft-PR eines abgebrochenen Spec-Laufs blockierte so
// alle kuenftigen Spec-Re-Laeufe, bis jemand den Draft manuell schloss. Fix: skippt nur noch
// bei einem Nicht-Draft (ready-PR = Implement schon gelaufen), symmetrisch zu 03-claude-
// implement.yml; verwaiste Drafts werden geschlossen, statt den Neu-Anstoß zu blockieren.

describe('Spec — Doppel-Guard blockiert nicht mehr auf bloßem Draft-PR (G5)', () => {
	const yml = codeOf(read('.github', 'workflows', '02-claude-spec.yml'));
	const step = yml.match(/name:\s*Doppel-Run-Guard[\s\S]*?(?=\n      - name:)/)?.[0] ?? '';
	assert.ok(step, 'Doppel-Run-Guard-Step nicht gefunden — wurde er umbenannt?');

	// AC1: Die Skip-Entscheidung zaehlt NUR Nicht-Draft-PRs (select(.isDraft == false)). Ein
	// Draft allein darf nicht zu skip=true fuehren, sonst blockiert ein verwaister Draft die
	// Issue dauerhaft.
	it('AC1: Skip-Entscheidung filtert isDraft == false (Draft allein skippt nicht)', () => {
		assert.match(
			step,
			/select\(\.isDraft == false\)/,
			'Der Spec-Doppel-Guard darf nur bei einem Nicht-Draft-PR (ready-PR) skippen — ein ' +
				'Draft allein ist ein abgebrochener Spec-Lauf und muss den Neu-Anstoß erlauben, sonst ' +
				'blockiert er die Issue dauerhaft (G5).',
		);
		// Die Skip-Entscheidung darf NICHT auf eine bloße Anzahl aller PRs (inkl. Drafts) setzen.
		const skipDecision = step.match(/ready=.*--jq[\s\S]*?exit 0/)?.[0] ?? step;
		assert.doesNotMatch(
			skipDecision,
			/\|\s*length"\s*2>.*\n.*skip=true/,
			'Die Skip-Entscheidung darf nicht auf einer Count-aller-PRs (inkl. Drafts) basieren.',
		);
	});

	// AC2: Verwaiste Drafts werden best-effort geschlossen (gh pr close), damit beim Neu-Anstoß
	// kein zweiter Draft neben dem alten akkumuliert. Branch bleibt erhalten (recoverable).
	it('AC2: verwaiste Draft-PRs werden geschlossen (gh pr close, Best-Effort)', () => {
		assert.match(
			step,
			/gh pr close/,
			'Verwaiste Draft-PRs müssen geschlossen werden, sonst akkumulieren sie sich bei jedem ' + 'Spec-Neu-Anstoß (G5).',
		);
	});
});
