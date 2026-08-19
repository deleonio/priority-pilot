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

const runPhase = (phase: string): { proceed: string; reason: string } => {
	const res = spawnSync('bash', [script, '--repo', 'o/r', '--phase', phase, '--ticket', '42'], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});
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
		const { proceed, reason } = runPhase('fixup');
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
