import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLACEHOLDER, stripImages } from './strip-images.mjs';

/**
 * Tests fuer die Bild-Entfernung im Documenter (Issue #1021, Datenschutz):
 *  - AK1: stripImages() entfernt Markdown-Bilder, HTML-<img>, data:-URIs und
 *    user-attachments-URLs; Codebloecke, Marker und normale Links bleiben unberuehrt.
 *  - AK1 (CLI): --in-place meldet changed=0|1 und schreibt nur bei Aenderung.
 *  - AK3: doppelte Anwendung ist ein Fixpunkt (Idempotenz fuer Catch-up-Re-Runs).
 *  - AK2: pr-image-strip.sh durchlaeuft alle vier Zielarten (PR-Body, PR-Kommentar,
 *    Issue-Body, Issue-Kommentar) und PATCHed nur veraenderte Objekte.
 *
 * `gh` wird per PATH-Stub ersetzt (Stil-Vorbild: label-transition.test.ts): Fixtures
 * liegen als Dateien in $GH_FIXTURE_DIR, Schreibaufrufe landen in $GH_WRITE_LOG.
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const mjs = join(here, 'strip-images.mjs');
const sweep = join(here, 'pr-image-strip.sh');

// --- AK1: reine Funktion ----------------------------------------------------

describe('stripImages() — AK1: Bild-Referenzen werden ersetzt, Rest bleibt', () => {
	it('ersetzt Markdown-Bilder mit Titel und ohne', () => {
		assert.equal(stripImages('a ![Screenshot](https://example.com/x.png) b'), `a ${PLACEHOLDER} b`);
		assert.equal(stripImages('![alt](url "title")'), PLACEHOLDER);
	});

	it('ersetzt HTML-<img>-Tags, auch mehrzeilig und self-closing', () => {
		assert.equal(stripImages('<img src="x.png" alt="y">'), PLACEHOLDER);
		assert.equal(stripImages('vor <img\n  src="a.png"\n  alt="b"\n/> nach'), `vor ${PLACEHOLDER} nach`);
	});

	it('ersetzt data:-URIs (als Bild-URL und nacktes URI)', () => {
		assert.equal(stripImages('![d](data:image/png;base64,AAAA)'), PLACEHOLDER);
		assert.equal(stripImages('nackt: data:image/png;base64,AAA hier'), `nackt: ${PLACEHOLDER} hier`);
	});

	it('ersetzt user-attachments-URLs (als Bild-URL und nackter Autolink)', () => {
		const url = 'https://github.com/user-attachments/assets/abc-123def-4';
		assert.equal(stripImages(`![s](${url})`), PLACEHOLDER);
		assert.equal(stripImages(`siehe ${url}`), `siehe ${PLACEHOLDER}`);
	});

	it('ersetzt Markdown-LINKS auf Bild-Quellen, laesst normale Links unberuehrt', () => {
		assert.equal(stripImages('[Text](data:image/png;base64,AAA)'), PLACEHOLDER);
		assert.equal(stripImages(`[Text](https://github.com/user-attachments/assets/x-1)`), PLACEHOLDER);
		assert.equal(
			stripImages('[normale Doku](https://example.com/docs) bleibt'),
			'[normale Doku](https://example.com/docs) bleibt',
		);
	});

	it('laesst Codebloecke und Inline-Code unberuehrt (bewusste Entscheidung)', () => {
		// Bild-Muster in Code sind Beispiele (Doku/Fixtures) und werden nicht gerendert.
		const md = '```\n![bleibt](img.png)\n```\nund `![auch](b.png)` inline';
		assert.equal(stripImages(md), md);
	});

	it('laesst Marker-Zeilen und Fliesstext byte-identisch', () => {
		const md = [
			'<!-- KI-ANALYSE:START stand=2026-08-25T00:00:00Z -->',
			'### UI-Bezug',
			'- Ampel: 🟢',
			'<!-- KI-ANALYSE:END -->',
		].join('\n');
		assert.equal(stripImages(md), md);
	});

	it('gibt Nicht-Strings und Leerstrings unveraendert zurueck', () => {
		assert.equal(stripImages(''), '');
	});

	it('leerer Bild-Alt-Text wird ebenfalls ersetzt', () => {
		assert.equal(stripImages('![](https://example.com/a.png)'), PLACEHOLDER);
	});
});

// --- AK3: Fixpunkt ------------------------------------------------------------

describe('stripImages() — AK3: Idempotenz (Fixpunkt)', () => {
	it('veraendert das eigene Ergebnis nicht nochmals', () => {
		const md = [
			'# Titel',
			'![a](data:image/png;base64,AAA) und <img src="b.png">',
			'[l](https://github.com/user-attachments/assets/z-9)',
			'```',
			'![code](c.png)',
			'```',
		].join('\n');
		const once = stripImages(md);
		assert.equal(stripImages(once), once);
	});
});

// --- AK1 (CLI-Teil) -----------------------------------------------------------

describe('strip-images.mjs CLI — --in-place meldet changed', () => {
	let dir: string;

	before(() => {
		dir = mkdtempSync(join(tmpdir(), 'strip-cli-'));
	});
	after(() => rmSync(dir, { recursive: true, force: true }));

	const runInPlace = (file: string) => spawnSync('node', [mjs, '--in-place', file], { encoding: 'utf8' });

	it('schreibt bei Bild-Entfernung und meldet changed=1', () => {
		const file = join(dir, 'a.md');
		writeFileSync(file, 'x ![i](i.png) y');
		const res = runInPlace(file);
		assert.equal(res.status, 0, res.stderr);
		assert.match(res.stdout, /^changed=1$/m);
		assert.equal(readFileSync(file, 'utf8'), `x ${PLACEHOLDER} y`);
	});

	it('schreibt nicht und meldet changed=0 bei bildfreiem Text', () => {
		const file = join(dir, 'b.md');
		writeFileSync(file, 'kein bild, nur [link](https://a.b)');
		const res = runInPlace(file);
		assert.equal(res.status, 0, res.stderr);
		assert.match(res.stdout, /^changed=0$/m);
		assert.equal(readFileSync(file, 'utf8'), 'kein bild, nur [link](https://a.b)');
	});

	it('stdin -> stdout transformiert ohne Dateizugriff', () => {
		const res = spawnSync('node', [mjs], { input: 'a ![i](i.png)', encoding: 'utf8' });
		assert.equal(res.status, 0, res.stderr);
		assert.equal(res.stdout, `a ${PLACEHOLDER}`);
	});
});

// --- AK2 + AK3: Sweep-Skript mit gh-Stub ---------------------------------------

let stubDir: string;
let fixtureDir: string;
let writeLogPath: string;

const writeFixture = (rel: string, content: string) => {
	writeFileSync(join(fixtureDir, rel), content);
};

const runSweep = (extra: string[] = []) => {
	writeFileSync(writeLogPath, '');
	const res = spawnSync('bash', [sweep, '--repo', 'o/r', '--pr', '42', ...extra], {
		env: {
			...process.env,
			PATH: `${stubDir}:${process.env.PATH}`,
			GH_FIXTURE_DIR: fixtureDir,
			GH_WRITE_LOG: writeLogPath,
		},
		encoding: 'utf8',
	});
	return { res, log: readFileSync(writeLogPath, 'utf8') };
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'strip-stub-'));
	fixtureDir = join(stubDir, 'fixtures');
	writeLogPath = join(stubDir, 'writes.log');
	mkdirSync(join(fixtureDir, 'comment-ids'), { recursive: true });
	mkdirSync(join(fixtureDir, 'comment-bodies'), { recursive: true });
	mkdirSync(join(fixtureDir, 'issue-bodies'), { recursive: true });

	// gh-Stub: Lesezugriffe aus Fixtures, Schreibzugriffe ins Log. Der Pfad ist das
	// erste Argument mit repos/-Praefix; NUMMER-Extraktion schiebt PR 42 und Issue 77
	// in dieselben Verzeichnisse.
	const gh = join(stubDir, 'gh');
	writeFileSync(
		gh,
		[
			'#!/usr/bin/env bash',
			'set -uo pipefail',
			'path=""',
			'for a in "$@"; do case "$a" in repos/*) path="$a"; break ;; esac; done',
			'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
			'  case "$*" in',
			'    *"--json body"*) cat "$GH_FIXTURE_DIR/pr-body.md"; exit 0 ;;',
			'    *closingIssuesReferences*) cat "$GH_FIXTURE_DIR/closing-issues.txt"; exit 0 ;;',
			'  esac',
			'fi',
			'if [ "$1" = "pr" ] && [ "$2" = "edit" ]; then',
			'  echo "PR-EDIT" >> "$GH_WRITE_LOG"',
			'  exit 0',
			'fi',
			'if [ "$1" = "api" ]; then',
			'  if [[ "$*" == *"--method PATCH"* ]]; then',
			'    f=""',
			'    for a in "$@"; do case "$a" in body=@*) f="${a#body=@}" ;; esac; done',
			'    { echo "PATCH $path"; cat "$f"; echo "---"; } >> "$GH_WRITE_LOG"',
			'    exit 0',
			'  fi',
			'  num="$(printf "%s" "$path" | sed -E "s#repos/([^/]+)/([^/]+)/issues/([0-9]+).*#\\3#")"',
			'  case "$path" in',
			'    */issues/comments/*)',
			'      id="${path##*/}"',
			'      cat "$GH_FIXTURE_DIR/comment-bodies/$id.md" 2>/dev/null || echo ""',
			'      exit 0 ;;',
			'    */comments*)',
			'      cat "$GH_FIXTURE_DIR/comment-ids/$num.txt" 2>/dev/null',
			'      exit 0 ;;',
			'    *)',
			'      cat "$GH_FIXTURE_DIR/issue-bodies/$num.md" 2>/dev/null || echo ""',
			'      exit 0 ;;',
			'  esac',
			'fi',
			'echo "gh-stub: unhandled: $*" >&2',
			'exit 1',
		].join('\n') + '\n',
	);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('pr-image-strip.sh — AK2: alle vier Zielarten durchlaufen', () => {
	it('PATCHed PR-Body, PR-Kommentar, Issue-Body und Issue-Kommentar', () => {
		writeFixture('pr-body.md', 'PR mit ![shot](https://github.com/user-attachments/assets/a-1)');
		writeFixture('closing-issues.txt', '77\n');
		writeFixture('comment-ids/42.txt', '11\n33\n'); // PR-Kommentare
		writeFixture('comment-ids/77.txt', '22\n'); // Issue-Kommentare
		writeFixture('comment-bodies/11.md', 'kommentar mit <img src="x.png">');
		writeFixture('comment-bodies/33.md', 'kommentar ohne bild — darf nicht gepatcht werden');
		writeFixture('comment-bodies/22.md', 'issue-kommentar mit ![i](data:image/png;base64,AA)');
		writeFixture('issue-bodies/77.md', 'issue body mit nacktem https://github.com/user-attachments/assets/b-2 link');

		const { res, log } = runSweep();
		assert.equal(res.status, 0, res.stderr);
		assert.match(log, /^PR-EDIT$/m, 'PR-Body muss geschrieben werden');
		assert.match(log, /^PATCH repos\/o\/r\/issues\/comments\/11$/m, 'PR-Kommentar 11 muss gepatcht werden');
		assert.match(log, /^PATCH repos\/o\/r\/issues\/77$/m, 'Issue-Body 77 muss gepatcht werden');
		assert.match(log, /^PATCH repos\/o\/r\/issues\/comments\/22$/m, 'Issue-Kommentar 22 muss gepatcht werden');
		assert.ok(!log.includes('comments/33'), 'bildfreier Kommentar darf nicht gepatcht werden');
		assert.ok(log.includes(PLACEHOLDER), 'gepatchte Bodies enthalten den Platzhalter');
		assert.ok(!log.includes('user-attachments'), 'keine Bild-URL bleibt zurueck');
	});

	it('ohne Closing-Issues bleibt der Issue-Teil unberuehrt', () => {
		writeFixture('pr-body.md', '![x](x.png)');
		writeFixture('closing-issues.txt', '');
		writeFixture('comment-ids/42.txt', '');
		const { res, log } = runSweep();
		assert.equal(res.status, 0, res.stderr);
		assert.match(log, /^PR-EDIT$/m);
		assert.ok(!/PATCH repos\/o\/r\/issues\/[0-9]+$/.test(log), 'kein Issue-PATCH ohne Closing-Issue');
	});
});

describe('pr-image-strip.sh — AK3: Sweep ist idempotent', () => {
	it('schreibt nichts, wenn alle Inhalte bereits bereinigt sind', () => {
		writeFixture('pr-body.md', `PR ${PLACEHOLDER} alt`);
		writeFixture('closing-issues.txt', '77\n');
		writeFixture('comment-ids/42.txt', '11\n');
		writeFixture('comment-ids/77.txt', '22\n');
		writeFixture('comment-bodies/11.md', `ok ${PLACEHOLDER}`);
		writeFixture('comment-bodies/22.md', 'ok');
		writeFixture('issue-bodies/77.md', 'ok');
		const { res, log } = runSweep();
		assert.equal(res.status, 0, res.stderr);
		assert.equal(log, '', 'zweiter Lauf darf keinerlei Schreibzugriffe machen');
	});
});
