import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für phase-crash-park.sh — der Hinweis, der verhindert, dass ein Ticket nach einem
 * Phasen-Absturz still liegen bleibt.
 *
 * Hintergrund: Die Issue-Phasen konsumieren ihren Trigger, BEVOR sie das Verdict auswerten.
 * Ohne Verdict (Absturz, Provider-Fehler) stand das Ticket danach ohne Trigger, ohne
 * ai:needs-human und ohne Hinweis da. Issue #912 lag so zweimal über Stunden unbemerkt.
 *
 * Schwerpunkt: Der Kommentar MUSS die echte Ursache tragen (Log-Auszug) und sagen, dass ein
 * blosses Entfernen von ai:needs-human nichts startet — der Trigger ist weg.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie check-phase-label.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'phase-crash-park.sh');

let dir: string;
let ghLog: string;
let bodyDump: string;

/** gh-Stub: protokolliert Aufrufe und schreibt den Kommentar-Body mit. */
const stub = [
	'#!/usr/bin/env bash',
	'echo "gh $*" >> "$GH_LOG"',
	'case "$*" in',
	'  *"issue comment"*)',
	'    for a in "$@"; do [ -f "$a" ] && cp "$a" "$BODY_DUMP"; done ;;',
	'  *"--json comments"*) printf "%s" "${GH_LAST_COMMENT-}" ;;',
	'esac',
	'exit 0',
].join('\n');

const run = (args: string[], env: Record<string, string> = {}) => {
	writeFileSync(ghLog, '');
	writeFileSync(bodyDump, '');
	const res = spawnSync('bash', [script, '--repo', 'o/r', ...args], {
		env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GH_LOG: ghLog, BODY_DUMP: bodyDump, ...env },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		parked: res.stdout.match(/^parked=(.*)$/m)?.[1] ?? '',
		reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
		calls: readFileSync(ghLog, 'utf8'),
		body: readFileSync(bodyDump, 'utf8'),
	};
};

before(() => {
	dir = mkdtempSync(join(tmpdir(), 'crash-park-'));
	ghLog = join(dir, 'gh.log');
	bodyDump = join(dir, 'body.md');
	const gh = join(dir, 'gh');
	writeFileSync(gh, stub);
	chmodSync(gh, 0o755);
});

after(() => rmSync(dir, { recursive: true, force: true }));

describe('phase-crash-park.sh — parkt sichtbar statt still zu sterben', () => {
	it('setzt ai:needs-human UND kommentiert', () => {
		const out = run(['--issue', '912', '--phase', 'ux', '--trigger', 'ai:needs-ux-ui']);
		assert.equal(out.parked, 'true');
		assert.match(out.calls, /issue edit 912 .*--add-label ai:needs-human/);
		assert.match(out.calls, /issue comment 912/);
	});

	it('nennt Was, Worauf und Optionen (Begründungspflicht)', () => {
		const out = run(['--issue', '912', '--phase', 'ux', '--trigger', 'ai:needs-ux-ui']);
		assert.match(out.body, /Was zu entscheiden ist/);
		assert.match(out.body, /Worauf es sich bezieht.*#912/s);
		assert.match(out.body, /Optionen/);
	});

	it('warnt ausdrücklich, dass Label-Entfernen allein nichts startet', () => {
		// Das ist die eigentliche Falle: Der Trigger wurde beim Start konsumiert.
		const out = run(['--issue', '912', '--phase', 'ux', '--trigger', 'ai:needs-ux-ui']);
		assert.match(out.body, /startet NICHTS/);
		assert.match(out.body, /ai:needs-ux-ui/, 'der wieder zu setzende Trigger muss genannt sein');
	});
});

describe('phase-crash-park.sh — trägt die echte Ursache', () => {
	it('übernimmt den Log-Auszug in den Kommentar', () => {
		const log = join(dir, 'claude.log');
		writeFileSync(log, 'irgendwas\nAPI Error: Request rejected (429) · [1310][Weekly/Monthly Limit Exhausted]\n');
		const out = run(['--issue', '912', '--phase', 'ux', '--trigger', 'ai:needs-ux-ui', '--log', log]);
		assert.match(out.body, /1310/, 'ohne den Providerfehler ist der Hinweis wertlos');
		assert.match(out.body, /Weekly\/Monthly Limit Exhausted/);
	});

	it('bleibt brauchbar, wenn gar kein Log da ist', () => {
		const out = run([
			'--issue',
			'912',
			'--phase',
			'spec',
			'--trigger',
			'ai:needs-spec',
			'--log',
			join(dir, 'fehlt.log'),
		]);
		assert.equal(out.parked, 'true');
		assert.match(out.body, /kein Log-Auszug verfügbar/);
	});
});

describe('phase-crash-park.sh — Dedupe', () => {
	it('postet nicht doppelt, wenn derselbe Hinweis schon der jüngste Kommentar ist', () => {
		const first = run(['--issue', '912', '--phase', 'ux', '--trigger', 'ai:needs-ux-ui']);
		const again = run(['--issue', '912', '--phase', 'ux', '--trigger', 'ai:needs-ux-ui'], {
			GH_LAST_COMMENT: first.body,
		});
		assert.doesNotMatch(again.calls, /issue comment/, 'identischer Hinweis darf nicht erneut gepostet werden');
		assert.match(again.calls, /--add-label ai:needs-human/, 'das Label wird trotzdem sichergestellt');
	});
});

describe('phase-crash-park.sh — Pflichtargumente', () => {
	it('lehnt einen Aufruf ohne --phase ab', () => {
		const res = spawnSync('bash', [script, '--repo', 'o/r', '--issue', '1'], {
			env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GH_LOG: ghLog, BODY_DUMP: bodyDump },
			encoding: 'utf8',
		});
		assert.equal(res.status, 2);
	});
});
