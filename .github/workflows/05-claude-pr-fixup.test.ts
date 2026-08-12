import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Kreuzverhör B1: Fixup ließ einen PR bei einem Claude-Crash/Timeout dauerhaft auf
// `ai:needs-changes` kleben. Die Label-Post-Assertion lief NUR bei `outcome == 'success'`
// — bei failure (non-zero-Exit/API-Fehler) oder cancelled (timeout-minutes-Backstop)
// passierte KEIN Label-Wechsel: kein Re-Arm, keine Eskalation, kein Kommentar. Vergleich:
// 04-claude-pr-review.yml behandelte failure bereits explizit. Diese Spec legt das
// Akzeptanzkriterium fest: die Label-Transition muss auch bei failure/cancelled laufen
// und den PR terminal an den Mensch übergeben (keine Re-Armierung — ein wiederholt
// abstürzender Claude würde sonst eine Schleife bauen).
//
// Testebene: statische Auswertung der Workflow-YAML (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Kommentarzeilen entfernen — sonst schlagen Erklaerungen als Befehl durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

// Nur der Label-Post-Assertion-Schritt trägt die Verdict-/Crash-Logik.
const stepOf = (yml: string): string => yml.match(/name:\s*Label-Post-Assertion[\s\S]*?(?=\n      - name:)/)?.[0] ?? '';

describe('Fixup — Label-Transition auch bei Claude-Crash/Timeout (B1)', () => {
	const yml = codeOf(read('.github', 'workflows', '05-claude-pr-fixup.yml'));
	const step = stepOf(yml);

	// AC1: Die Label-Post-Assertion darf NICHT mehr nur auf `outcome == 'success''
	// beschränkt sein. Ein Crash (failure) oder der timeout-minutes-Backstop (cancelled)
	// müssen ebenfalls die Label-Transition auslösen — sonst bleibt der PR ohne Label-
	// Wechsel, Re-Arm oder Kommentar an einem toten Trigger-Label hängen.
	it('AC1: Label-Post-Assertion läuft bei failure ODER cancelled (nicht nur success)', () => {
		assert.match(
			step,
			/steps\.claude\.outcome\s*==\s*'failure'/,
			"05-claude-pr-fixup.yml Label-Post-Assertion muss bei 'failure' laufen — sonst bleibt " +
				'der PR bei einem Claude-Crash dauerhaft auf ai:needs-changes kleben (kein Label-Wechsel).',
		);
		assert.match(
			step,
			/steps\.claude\.outcome\s*==\s*'cancelled'/,
			"05-claude-pr-fixup.yml Label-Post-Assertion muss bei 'cancelled' laufen — der " +
				'timeout-minutes-Backstop erzeugt einen cancelled-Step, der sonst zum Deadlock führt.',
		);
	});

	// AC2: Bei outcome != success (Crash/Timeout) muss die Transition TERMINAL an den
	// Menschen übergeben (ai:needs-human + handlungsanweisender Kommentar) — und darf NICHT
	// ai:needs-changes neu armieren. Ein wiederholt abstürzender Claude würde sonst eine
	// Re-Arm-Schleife erzeugen. Commits/HEAD sind nach einem Absturz nicht vertrauenswürdig.
	it('AC2: Crash-Pfad (OUTCOME != success) setzt ai:needs-human, armiert NICHT neu', () => {
		// Crash-Guard existiert und reagiert auf ein NICHT-success-Outcome.
		assert.match(
			step,
			/\$OUTCOME["']?\s*!=\s*["']?success/,
			'05-claude-pr-fixup.yml braucht einen Crash-Guard der Form `[ "$OUTCOME" != "success" ]` ' +
				'(oder äquivalent), der bei failure/cancelled greift.',
		);
		// Der Crash-Zweig muss ai:needs-human setzen (terminal an Mensch).
		const guardBlock =
			step.match(/\$OUTCOME["']?\s*!=\s*["']?success[\s\S]*?(?:\n          fi|\n            exit 0)/)?.[0] ?? '';
		assert.ok(guardBlock, 'Crash-Guard-Block nicht gefunden — Outcome-Abfrage ohne Rumpf?');
		assert.match(
			guardBlock,
			/--add-label ai:needs-human/,
			'Der Crash-Pfad (OUTCOME != success) muss ai:needs-human setzen — terminal an Mensch, ' +
				'damit ein wiederholt abstürzender Claude die Pipeline nicht durch Re-Armieren blockiert.',
		);
		// Der Crash-Zweig darf ai:needs-changes NICHT neu setzen (keine Re-Armierung).
		assert.doesNotMatch(
			guardBlock,
			/--add-label ai:needs-changes/,
			'Der Crash-Pfad darf ai:needs-changes NICHT neu armieren — ein abstürzender Claude ' +
				'würde sonst eine Re-Arm-Schleife erzeugen.',
		);
	});

	// AC3 (Charakterisierung): der Erfolgs-Pfad bleibt erhalten — bei success mit HEAD-
	// Bewegung geht es weiter an den Review (ai:needs-review), bei needs-human-Verdict
	// terminal an den Menschen. Stellt sicher, dass die B1-Erweiterung die Erfolgs-Logik
	// nicht versehentlich umstellt.
	it('AC3: Erfolgs-Pfad bleibt erhalten (success + Fortschritt → ai:needs-review)', () => {
		assert.match(
			step,
			/--add-label ai:needs-review/,
			'Der Fortschritts-Zweig (HEAD bewegt) muss weiterhin ai:needs-review setzen — die B1-' +
				'Crash-Behandlung darf die Erfolgs-Logik nicht verdrängen.',
		);
	});
});
