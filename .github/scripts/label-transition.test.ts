import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regressions-Tests fuer Guard 3 (Menschen-Parker) in label-transition.sh:
 * `ai:needs-human` darf von KEINER Transition ersatzlos entfernt werden —
 * sonst loest der naechste Fixup-Run erneut aus (PR #903: Gate/Scan wischte
 * Fixup-Verdict needs-human -> Endlosschleife).
 *
 * `gh` wird per PATH-Stub ersetzt: `gh pr view` liefert Fixture-JSON,
 * `gh api ... PUT` appendet den Body in eine Log-Datei ($GH_PUT_LOG).
 * Das Skript laeuft unangetastet als Subprozess.
 *
 * Stil-Vorbild: check-phase-label.test.ts (node:test + tsx, TABS).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'label-transition.sh');

let stubDir: string;
let fixturePath: string;
let putLogPath: string;

const labels = (...names: string[]) => names.map((name) => ({ name }));
const fixture = (...names: string[]) => JSON.stringify({ labels: labels(...names) });

type RunResult = {
	applied: string;
	state: string;
	reason: string;
	labels: string;
	changed: string;
};

const runTransition = (extraArgs: string[]): RunResult => {
	// PUT-Log vorher leeren
	writeFileSync(putLogPath, '');
	const res = spawnSync('bash', [script, '--repo', 'o/r', '--pr', '42', ...extraArgs], {
		env: {
			...process.env,
			PATH: `${stubDir}:${process.env.PATH}`,
			GH_FIXTURE: fixturePath,
			GH_PUT_LOG: putLogPath,
		},
		encoding: 'utf8',
	});
	const stdout = res.stdout || '';
	return {
		applied: stdout.match(/^applied=(.*)$/m)?.[1] ?? '',
		state: stdout.match(/^state=(.*)$/m)?.[1] ?? '',
		reason: stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
		labels: stdout.match(/^labels=(.*)$/m)?.[1] ?? '',
		changed: stdout.match(/^changed=(.*)$/m)?.[1] ?? '',
	};
};

const putLogContents = (): string => {
	try {
		return readFileSync(putLogPath, 'utf8');
	} catch {
		return '';
	}
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'lt-test-'));
	fixturePath = join(stubDir, 'fixture.json');
	putLogPath = join(stubDir, 'put.log');

	// gh-Stub: unterscheidet "pr view" (Fixture) von "api ... PUT" (Log-Append)
	const gh = join(stubDir, 'gh');
	writeFileSync(
		gh,
		[
			'#!/usr/bin/env bash',
			'if [ "$1" = "pr" ]; then',
			'  cat "$GH_FIXTURE"',
			'  exit 0',
			'fi',
			'# PUT-Aufruf: Body in Log-Datei appenden statt echte API',
			'if [ "$2" = "--method" ] && [ "$3" = "PUT" ]; then',
			'  # stdin enthaelt den JSON-Body',
			'  cat >> "$GH_PUT_LOG"',
			'  echo "{\"status\":\"200\"}" > /dev/null',
			'  exit 0',
			'fi',
			'echo "gh-stub: unhandled: $*" >&2',
			'exit 1',
		].join('\n') + '\n',
	);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('label-transition.sh — Guard 3 (Menschen-Parker, PR #903)', () => {
	it('Test 1: needs-human klebt + --set-none --expect (Guard 2 greift hier zuerst)', () => {
		// Fixture: ai:needs-review + ai:needs-human
		// Aufruf: --set-none --expect ai:needs-review
		// Guard 2 (--expect-Mismatch, weil needs-human auch im Bestand ist) greift VOR Guard 3
		// Aber: Ergebnis muss trotzdem applied=false sein und reason darf "needs-human" enthaelten
		// oder den Guard-2-Text. Wichtig: KEIN PUT im Log.
		writeFileSync(fixturePath, fixture('ai:needs-review', 'ai:needs-human'));
		const r = runTransition(['--set-none', '--expect', 'ai:needs-review']);
		assert.equal(r.applied, 'false');
		assert.equal(r.state, 'ok');
		// Guard 2 matched (expects only ai:needs-review but finds two labels)
		assert.ok(r.reason.length > 0, 'reason sollte gesetzt sein');
		assert.equal(putLogContents(), '', 'KEIN PUT bei Guard-Abbruch');
	});

	it('Test 2 (KERN-REGRESSION): needs-human klebt, Ziel ohne Parker (Gate-/Scan-Konstellation)', () => {
		// Fixture: NUR ai:needs-human
		// Aufruf: --set ai:needs-fixup --forbid ai:needs-fixup
		// Guard 2 greift NICHT (kein --expect)
		// Guard 1 greift NICHT (ai:needs-fixup nicht im Bestand)
		// Guard 3 MUSS greifen: needs-human klebt, Ziel enthaelt es nicht
		writeFileSync(fixturePath, fixture('ai:needs-human'));
		const r = runTransition(['--set', 'ai:needs-fixup', '--forbid', 'ai:needs-fixup']);
		assert.equal(r.applied, 'false', 'Guard 3 muss Transition verwerfen');
		assert.equal(r.state, 'ok');
		assert.match(r.reason, /needs-human/, 'reason muss needs-human erwaehnen');
		assert.equal(putLogContents(), '', 'KEIN PUT — Parker-Guard verhindert Write');
	});

	it('Test 3: Idempotenz-Ausnahme — Ziel enthaelt needs-human (erlaubt)', () => {
		// Fixture: ai:needs-human
		// Aufruf: --set ai:needs-human --expect ai:needs-human
		// Guard 3 darf NICHT greifen (Ziel enthaelt needs-human = idempotent)
		writeFileSync(fixturePath, fixture('ai:needs-human'));
		const r = runTransition(['--set', 'ai:needs-human', '--expect', 'ai:needs-human']);
		assert.equal(r.applied, 'true', 'Idempotentes Re-Setzen muss erlaubt sein');
		assert.equal(r.state, 'ok');
		const log = putLogContents();
		assert.ok(log.includes('ai:needs-human'), 'PUT muss ai:needs-human enthalten');
	});

	it('Test 4: Kein Parker — altes Verhalten unveraendert', () => {
		// Fixture: ai:needs-review (kein needs-human)
		// Aufruf: --set-none --expect ai:needs-review
		// Guard 3 darf NICHT greifen, Transition muss angewendet werden
		writeFileSync(fixturePath, fixture('ai:needs-review'));
		const r = runTransition(['--set-none', '--expect', 'ai:needs-review']);
		assert.equal(r.applied, 'true', 'Ohne Parker muss Transition durchgehen');
		assert.equal(r.state, 'ok');
		const log = putLogContents();
		assert.ok(log.length > 0, 'PUT muss ausgefuehrt werden');
	});
});

describe('label-transition.sh — ai:model:* ist NICHT verwaltet (Invariante)', () => {
	it('lässt die Modellwahl eine Transition überleben', () => {
		// Eine Transition ersetzt den MANAGED-Bestand vollständig. Stünde ai:model:*
		// darin, verlöre der Review-Fix-Zyklus die Modellwahl genau dort, wo
		// resolve-model-label.sh sie bei jedem erneuten Start neu lesen muss — der
		// Lauf fiele still auf das Default-Modell zurück.
		writeFileSync(fixturePath, fixture('ai:needs-review', 'ai:model:haiku'));
		const r = runTransition(['--set', 'ai:needs-fixup', '--expect', 'ai:needs-review']);
		assert.equal(r.applied, 'true');
		const log = putLogContents();
		assert.ok(log.includes('ai:model:haiku'), 'ai:model:* muss im PUT erhalten bleiben');
		assert.ok(log.includes('ai:needs-fixup'), 'der neue Trigger muss gesetzt werden');
		assert.ok(!log.includes('ai:needs-review'), 'der alte Trigger muss verschwinden');
	});

	it('fasst die Modellwahl auch bei --set-none nicht an', () => {
		writeFileSync(fixturePath, fixture('ai:needs-fixup', 'ai:model:opus'));
		const r = runTransition(['--set-none', '--expect', 'ai:needs-fixup']);
		assert.equal(r.applied, 'true');
		assert.ok(putLogContents().includes('ai:model:opus'), 'ai:model:* überlebt auch das Leeren');
	});
});
