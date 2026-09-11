import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für wait-for-checks.sh — das Warte-Gate VOR dem Kreuzverhör-Review.
 *
 * Kern der Zusicherung: Solange ein Allowlist-Check pending ist, kehrt das Skript NICHT
 * zurück (sonst startet das Review wieder blind gegen laufende CI, und ein Fixup läuft ohne
 * die CI-Fehler → je ein zusätzlicher Fixup- und Review-Lauf). Jeder unklare Zustand ist
 * fail-open, damit ein Review nie verschluckt wird.
 *
 * `gh` wird per PATH-Stub ersetzt und liefert pro Aufruf die NÄCHSTE Fixture (Zähler-Datei) —
 * so ist die Warteschleife über mehrere Runden hinweg prüfbar. `--interval 0` macht sie
 * augenblicklich.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'wait-for-checks.sh');

let stubDir: string;

type Check = { name: string; bucket: string; workflow: string };

const ci = (bucket: string, name = 'verify'): Check => ({ name, bucket, workflow: 'Verify' });
const review = (bucket: string): Check => ({ name: 'review', bucket, workflow: '05 Review' });

/** Jede Runde = eine Antwort von `gh pr checks`. */
const run = (rounds: Check[][], args: string[] = []) => {
	writeFileSync(join(stubDir, 'rounds.json'), JSON.stringify(rounds));
	writeFileSync(join(stubDir, 'counter'), '0');
	const res = spawnSync(
		'bash',
		[
			script,
			'--repo',
			'o/r',
			'--pr',
			'42',
			'--interval',
			'0',
			'--timeout-seconds',
			'3',
			'--appear-seconds',
			'3',
			...args,
		],
		{ env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, STUB_DIR: stubDir }, encoding: 'utf8' },
	);
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	const read = (key: string) => res.stdout.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '';
	return { status: read('status'), red: read('red'), pending: read('pending'), stderr: res.stderr };
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'wfc-test-'));
	const gh = join(stubDir, 'gh');
	// Gibt die Fixture der aktuellen Runde aus und zählt hoch; nach der letzten Runde bleibt
	// diese stehen (eine Endlos-Warteschleife endet im Test über --timeout-seconds).
	writeFileSync(
		gh,
		[
			'#!/usr/bin/env bash',
			'i="$(cat "$STUB_DIR/counter")"',
			'last="$(jq "length - 1" "$STUB_DIR/rounds.json")"',
			'idx="$i"; [ "$idx" -gt "$last" ] && idx="$last"',
			'jq -c ".[$idx]" --argjson idx "$idx" "$STUB_DIR/rounds.json"',
			'echo "$((i + 1))" > "$STUB_DIR/counter"',
		].join('\n'),
	);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('wait-for-checks.sh', () => {
	it('wartet, bis der pending-Check fertig ist, und meldet dann grün', () => {
		const { status, red } = run([[ci('pending')], [ci('pending')], [ci('pass')]]);
		assert.equal(status, 'green');
		assert.equal(red, '');
	});

	it('meldet rot MIT Job-Namen, sobald alle Checks fertig sind', () => {
		const { status, red } = run([
			[ci('pending'), ci('pass', 'e2e 1/4')],
			[ci('fail'), ci('pass', 'e2e 1/4')],
		]);
		assert.equal(status, 'red');
		assert.equal(red, 'verify');
	});

	it('wartet auf ALLE Allowlist-Checks — ein roter Shard neben laufenden zählt erst am Ende', () => {
		const { status, red } = run([
			[ci('fail', 'e2e 2/4'), ci('pending', 'verify')],
			[ci('fail', 'e2e 2/4'), ci('fail', 'verify')],
		]);
		assert.equal(status, 'red');
		assert.equal(red, 'e2e 2/4, verify');
	});

	it('wartet NICHT auf die eigenen 05-Review-Checks (Selbst-Deadlock)', () => {
		const { status } = run([[ci('pass'), review('pending')]]);
		assert.equal(status, 'green');
	});

	it('meldet absent, wenn nie ein Allowlist-Check auftaucht (fail-open)', () => {
		const { status } = run([[review('pending')]], ['--appear-seconds', '0']);
		assert.equal(status, 'absent');
	});

	it('meldet timeout mit den hängenden Jobs, wenn das Budget reißt (fail-open)', () => {
		const { status, pending } = run([[ci('pending')]], ['--timeout-seconds', '0']);
		assert.equal(status, 'timeout');
		assert.equal(pending, 'verify');
	});

	it('wertet cancel/skipping als fertig, nicht als rot', () => {
		const { status } = run([[ci('cancel'), ci('skipping', 'e2e 1/4')]]);
		assert.equal(status, 'green');
	});

	it('bleibt fail-open, wenn gh gar nichts liefert', () => {
		const { status } = run([[]], ['--appear-seconds', '0']);
		assert.equal(status, 'absent');
	});

	// `--timeout-seconds` kommt aus der frei editierbaren Repository-Variable
	// `vars.REVIEW_CI_WAIT_SECONDS`. Ohne Numerik-Guard scheitert JEDER `[ … -ge … ]` an einem
	// Nicht-Zahl-Wert; ohne `set -e` gilt der Test dann als „falsch" und die Schleife bricht nie
	// ab — das Review hing bis zum Job-Timeout. Geprüft wird beides: normaler Abschluss UND dass
	// Bash keinen Vergleichsfehler mehr wirft.
	it('fällt bei nicht-numerischem --timeout-seconds auf den Default zurück statt endlos zu warten', () => {
		const { status, stderr } = run([[ci('pending')], [ci('pass')]], ['--timeout-seconds', '20min']);
		assert.equal(status, 'green');
		assert.doesNotMatch(stderr, /integer expression expected/);
		assert.match(stderr, /--timeout-seconds="20min" ist keine Zahl — nutze Default 1200\./);
	});
});
