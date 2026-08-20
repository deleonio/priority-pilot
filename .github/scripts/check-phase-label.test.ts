import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regressions-Tests für den globalen Menschen-Parker in check-phase-label.sh:
 * `ai:needs-human` muss JEDE aktive Phase blockieren, selbst wenn der Trigger noch
 * klebt — sonst dreht der Continue-Sweep alle 6h eine Endlosschleife (PR #903).
 *
 * `gh` wird per PATH-Stub durch Fixture-JSON ersetzt; das Skript läuft unangetastet
 * als Subprozess. Läuft über `pnpm test:scripts` (node:test + tsx, wie validate-actions).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'check-phase-label.sh');

let stubDir: string;
let fixturePath: string;

const labels = (...names: string[]) => names.map((name) => ({ name }));
const issue = (state: string, ...names: string[]) => JSON.stringify({ state, labels: labels(...names) });
const pr = (state: string, isDraft: boolean, ...names: string[]) =>
	JSON.stringify({ state, isDraft, labels: labels(...names) });

const rawPhase = (phase: string) =>
	spawnSync('bash', [script, '--repo', 'o/r', '--phase', phase, '--ticket', '42'], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});

const runPhase = (phase: string): { proceed: string; reason: string } => {
	const res = rawPhase(phase);
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		proceed: res.stdout.match(/^proceed=(.*)$/m)?.[1] ?? '',
		reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
	};
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'cpl-test-'));
	fixturePath = join(stubDir, 'fixture.json');
	const gh = join(stubDir, 'gh');
	writeFileSync(gh, '#!/usr/bin/env bash\ncat "$GH_FIXTURE"\n');
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('check-phase-label.sh — globaler Menschen-Parker ai:needs-human', () => {
	it('blockt eine Issue-Phase trotz klebendem Trigger (die Endlosschleife)', () => {
		writeFileSync(fixturePath, issue('OPEN', 'ai:needs-spec', 'ai:needs-human'));
		const { proceed, reason } = runPhase('spec');
		assert.equal(proceed, 'false');
		assert.match(reason, /ai:needs-human/);
	});

	it('blockt eine PR-Phase trotz klebendem Trigger', () => {
		writeFileSync(fixturePath, pr('OPEN', false, 'ai:needs-fixup', 'ai:needs-human'));
		const { proceed, reason } = runPhase('implement-pr');
		assert.equal(proceed, 'false');
		assert.match(reason, /ai:needs-human/);
	});

	it('blockt nicht, wenn needs-human fehlt (kein Over-Blocking)', () => {
		writeFileSync(fixturePath, issue('OPEN', 'ai:needs-spec'));
		assert.equal(runPhase('spec').proceed, 'true');
	});

	it('lässt den documenter auch bei needs-human laufen (protokolliert NACH menschlicher Entscheidung)', () => {
		writeFileSync(fixturePath, pr('MERGED', false, 'ai:needs-human'));
		assert.equal(runPhase('documenter').proceed, 'true');
	});
});

/**
 * Die Umsetzungsphase hat seit ADR-0005 ZWEI Eingänge (Issue + ai:needs-impl,
 * PR + ai:needs-fixup). Beide müssen ihren eigenen Soll-Zustand behalten: Ein
 * versehentliches Zusammenfallen (etwa `implement-pr` auf das Issue-Soll gemappt)
 * würde den Fixup-Eingang stillschweigend dauerhaft überspringen.
 */
describe('check-phase-label.sh — die zwei Eingänge der Umsetzungsphase', () => {
	it('implement verlangt ai:needs-impl am OFFENEN ISSUE', () => {
		writeFileSync(fixturePath, issue('OPEN', 'ai:needs-impl'));
		assert.equal(runPhase('implement').proceed, 'true');
	});

	it('implement läuft NICHT, wenn nur ai:needs-fixup klebt', () => {
		writeFileSync(fixturePath, issue('OPEN', 'ai:needs-fixup'));
		const { proceed, reason } = runPhase('implement');
		assert.equal(proceed, 'false');
		assert.match(reason, /ai:needs-impl/);
	});

	it('implement-pr verlangt ai:needs-fixup am offenen Nicht-Draft-PR', () => {
		writeFileSync(fixturePath, pr('OPEN', false, 'ai:needs-fixup'));
		assert.equal(runPhase('implement-pr').proceed, 'true');
	});

	it('implement-pr läuft NICHT am Draft-PR (Review-Vertrag)', () => {
		writeFileSync(fixturePath, pr('OPEN', true, 'ai:needs-fixup'));
		const { proceed, reason } = runPhase('implement-pr');
		assert.equal(proceed, 'false');
		assert.match(reason, /Draft/);
	});

	it('review skippt weiterhin bei Doppel-Armung (ai:needs-fixup gewinnt)', () => {
		writeFileSync(fixturePath, pr('OPEN', false, 'ai:needs-review', 'ai:needs-fixup'));
		const { proceed, reason } = runPhase('review');
		assert.equal(proceed, 'false');
		assert.match(reason, /ai:needs-fixup/);
	});

	it('der alte Phasen-Name `fixup` ist ein HARTER Fehler, kein stiller Skip', () => {
		// Ein Aufrufer, der beim Zusammenlegen übersehen wurde, muss laut scheitern
		// (exit 2 = Konfigurationsfehler). Ein Fail-open hätte den Fixup-Eingang
		// stillschweigend an jedem Guard vorbeilaufen lassen.
		writeFileSync(fixturePath, pr('OPEN', false, 'ai:needs-fixup'));
		const res = rawPhase('fixup');
		assert.equal(res.status, 2);
		assert.match(res.stderr, /unbekannte Phase/);
	});
});
