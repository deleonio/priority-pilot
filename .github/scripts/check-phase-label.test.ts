import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

	it('team verlangt ai:needs-team am OFFENEN ISSUE', () => {
		writeFileSync(fixturePath, issue('OPEN', 'ai:needs-team'));
		assert.equal(runPhase('team').proceed, 'true');
	});

	it('team skippt bei Doppel-Armung mit der Phasenkette (die Kette gewinnt)', () => {
		// Ohne diesen Ausschluss liefen Team-Lauf und Umsetzungsphase am selben Ticket:
		// zwei Agenten auf demselben Branch, doppelte Kosten, Edit-War.
		writeFileSync(fixturePath, issue('OPEN', 'ai:needs-team', 'ai:needs-impl'));
		const { proceed, reason } = runPhase('team');
		assert.equal(proceed, 'false');
		assert.match(reason, /ai:needs-impl/);
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

/**
 * ZAI-Peak-Defer (#2100): Mit --defer-on-peak und vars.ZAI_PEAK_MODE=defer vertagt
 * der Start im Peak-Fenster (Mo-Fr 14-18 Asia/Singapore) neutral — ohne das
 * Trigger-Label anzutasten und ohne die gh-Abfrage zu erreichen. Ein zweiter
 * PATH-Stub ersetzt zusätzlich `date` (Fenster-Uhr); der gh-Stub hier hinterlässt
 * eine Marker-Datei — ihr Fehlen im Defer-Fall belegt das Entscheiden VOR der API.
 */
describe('check-phase-label.sh — ZAI-Peak-Defer', () => {
	let deferDir: string;
	let deferFixture: string;
	let ghCalled: string;

	const rawDeferPhase = (extra: Record<string, string>) =>
		spawnSync('bash', [script, '--repo', 'o/r', '--phase', 'spec', '--ticket', '42', '--defer-on-peak'], {
			env: {
				...process.env,
				PATH: `${deferDir}:${process.env.PATH}`,
				GH_FIXTURE: deferFixture,
				GH_CALLED: ghCalled,
				...extra,
			},
			encoding: 'utf8',
		});

	const deferRun = (extra: Record<string, string>) => {
		const res = rawDeferPhase({ LLM_PROVIDER: 'zai', ...extra });
		assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
		return {
			proceed: res.stdout.match(/^proceed=(.*)$/m)?.[1] ?? '',
			reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
		};
	};

	before(() => {
		deferDir = mkdtempSync(join(tmpdir(), 'cpl-defer-test-'));
		deferFixture = join(deferDir, 'fixture.json');
		ghCalled = join(deferDir, 'gh-called');
		const gh = join(deferDir, 'gh');
		writeFileSync(gh, '#!/usr/bin/env bash\ntouch "$GH_CALLED"\ncat "$GH_FIXTURE"\n');
		chmodSync(gh, 0o755);
		const date = join(deferDir, 'date');
		writeFileSync(
			date,
			'#!/usr/bin/env bash\ncase "$1" in +%u) echo "$CPL_STUB_DOW" ;; +%H) echo "$CPL_STUB_HOUR" ;; *) /bin/date "$@" ;; esac\n',
		);
		chmodSync(date, 0o755);
	});

	after(() => rmSync(deferDir, { recursive: true, force: true }));

	it('vertagt im Fenster (Mo-Fr, Stunde 14 und 17) und entscheidet VOR der gh-Abfrage', () => {
		writeFileSync(deferFixture, issue('OPEN', 'ai:needs-spec'));
		for (const hour of ['14', '17']) {
			const { proceed, reason } = deferRun({ ZAI_PEAK_MODE: 'defer', CPL_STUB_DOW: '3', CPL_STUB_HOUR: hour });
			assert.equal(proceed, 'false');
			assert.match(reason, /ZAI-Peak/);
			assert.equal(
				existsSync(ghCalled),
				false,
				`gh-Stub unbenutzt belegt das Entscheiden vor der API (Stunde ${hour})`,
			);
		}
	});

	it('läuft an den Fensterrändern regulär (Stunde 13 und 18, dow 6 und 7)', () => {
		writeFileSync(deferFixture, issue('OPEN', 'ai:needs-spec'));
		for (const [dow, hour] of [
			['3', '13'],
			['3', '18'],
			['6', '15'],
			['7', '15'],
		] as const) {
			const { proceed } = deferRun({ ZAI_PEAK_MODE: 'defer', CPL_STUB_DOW: dow, CPL_STUB_HOUR: hour });
			assert.equal(proceed, 'true', `dow=${dow}, Stunde=${hour} liegt außerhalb des Fensters`);
		}
	});

	it('defert nicht bei ZAI_PEAK_MODE=warn und ungesetztem Modus (Fail-safe-Default)', () => {
		writeFileSync(deferFixture, issue('OPEN', 'ai:needs-spec'));
		for (const mode of [{ ZAI_PEAK_MODE: 'warn' }, {}]) {
			assert.equal(
				deferRun({ ZAI_PEAK_MODE: mode.ZAI_PEAK_MODE, CPL_STUB_DOW: '3', CPL_STUB_HOUR: '15' }).proceed,
				'true',
			);
		}
	});

	it('läuft bei anderem Provider regulär (LLM_PROVIDER != zai)', () => {
		writeFileSync(deferFixture, issue('OPEN', 'ai:needs-spec'));
		assert.equal(
			deferRun({
				ZAI_PEAK_MODE: 'defer',
				CPL_STUB_DOW: '3',
				CPL_STUB_HOUR: '15',
				LLM_PROVIDER: 'openai',
			}).proceed,
			'true',
		);
	});
});
