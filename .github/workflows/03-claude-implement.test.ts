import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Der Label-Post-Assertion-Schritt in 03-claude-implement.yml muss:
// - bei Doppel-Run-Guard-Skip (bereits PR existiert) AUCH laufen, um ai:ready für den bestehenden PR zu setzen
// - bei Skip-Guard-Skip (läuft bereits) NICHT laufen, da der neue Lauf nichts beigetragen hat
// - einen expliziten Check auf skip-guard.outputs.skip != 'true' haben (wie Spec)
// Regressions-Test: die Condition muss beide Guards explizit prüfen.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Kommentarzeilen entfernen — sonst schlagen Erklaerungen und Beispiele als Befehl durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

describe('Implement — Label-Post-Asymmetrie (Spec vs. Implement)', () => {
	const yml = codeOf(read('.github', 'workflows', '03-claude-implement.yml'));

	it('Label-Post-Assertion hat expliziten skip-guard Check (wie Spec)', () => {
		// Spec (02-claude-spec.yml) prüft explizit: skip-guard.outputs.skip != 'true'
		// Implement muss das auch tun, sonst laeuft Label-Post bei Skip-Guard-Skip mit
		// (verlaesst sich aktuell implizit darauf, dass claude-Step nicht laeuft).
		assert.match(
			yml,
			/steps\.skip-guard\.outputs\.skip\s*!=\s*'true'/,
			"Label-Post-Assertion muss explizit steps.skip-guard.outputs.skip != 'true' pruefen (wie 02-claude-spec.yml)",
		);
	});

	it('Label-Post-Assertion laeuft bei doppel-guard Skip (bestehender PR -> ai:ready setzen)', () => {
		// Spec macht das: (steps.doppel-guard.outputs.skip == 'true') als ERLAUBNIS in der if-Bedingung
		// Implement muss das auch tun, damit bei bestehendem PR ai:ready gesetzt wird.
		assert.match(
			yml,
			/steps\.doppel-guard\.outputs\.skip\s*==\s*'true'/,
			'Label-Post-Assertion muss bei doppel-guard Skip AUCH laufen (bestehenden PR -> ai:ready setzen)',
		);
	});

	it('Label-Post-Assertion laeuft NICHT bei skip-guard Skip (neuer Lauf hat nichts beigetragen)', () => {
		// Bei Skip-Guard-Skip hat der neue Lauf nichts beigetragen -> Label-Post darf NICHT laufen
		// (anders als bei doppel-guard Skip, wo der LAUFENDE PR das Label braucht).
		// Der explizite Check skip-guard != 'true' oben sichert das bereits.
		// Hier pruefen wir, dass die Condition NICHT '|| steps.skip-guard.outputs.skip == \'true\'' enthaelt.
		assert.doesNotMatch(
			yml,
			/\|\|\s*steps\.skip-guard\.outputs\.skip\s*==\s*'true'/,
			'Label-Post-Assertion darf bei skip-guard Skip NICHT laufen (|| skip-guard == true waere falsch)',
		);
	});
});

describe('Implement — HAS_TESTS-Check umgeht den gojq-Backslash-Bug (falls relevant)', () => {
	const yml = codeOf(read('.github', 'workflows', '03-claude-implement.yml'));

	it('kein jq test() mit Backslash-Escape im Pattern (gojq: invalid escape sequence)', () => {
		// Falls Implement auch HAS_TESTS prueft: gojq wertet test("\.…") als *invalid escape*
		assert.doesNotMatch(
			yml,
			/test\("\\./,
			'jq test() mit Backslash-Escape ("\.") — gojq (gh) wertet das als invalid escape',
		);
	});
});
