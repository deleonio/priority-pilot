import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für den `triage`-Modus von needs-human-explain.sh.
 *
 * Zweck: `ai:needs-human` darf an einem Issue nicht ohne Begründung gesetzt werden.
 * Die Analyse-Phase (01) postet dazu einen Kommentar mit dem Marker
 * `<!-- ai-triage-decision -->`; findet der Workflow ihn nicht, postet er eine
 * Ersatz-Diagnose. Diese Erkennung wird hier abgesichert — sie ist der technische
 * Teil der Begründungspflicht.
 *
 * Mitgeprüft: `--ticket` als Alias für `--pr`. Der lookup fragt ohnehin
 * repos/…/issues/<n>/comments ab (gilt für Issues UND PRs) — es gibt bewusst
 * keinen zweiten Codepfad für Issues.
 *
 * `gh` wird per PATH-Stub ersetzt. Läuft über `pnpm test:scripts`.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'needs-human-explain.sh');

let stubDir: string;
let fixturePath: string;

const comment = (body: string, id = 1) => ({
	id,
	body,
	html_url: `https://github.com/o/r/issues/42#issuecomment-${id}`,
});

const TRIAGE_BODY = [
	'<!-- ai-triage-decision -->',
	'## Entscheidung nötig',
	'**Was zu entscheiden ist:** Soll der Import CSV oder JSON annehmen?',
	'**Worauf es sich bezieht:** Issue #42',
	'**Optionen:**',
	'1. Nur CSV — weniger Code',
	'2. Beides — mehr Aufwand',
].join('\n');

const lookup = (args: string[]): Record<string, string> => {
	const res = spawnSync('bash', [script, 'lookup', '--repo', 'o/r', ...args], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	const out: Record<string, string> = {};
	for (const line of res.stdout.split('\n')) {
		const m = line.match(/^([a-z]+)=(.*)$/);
		if (m) out[m[1]] = m[2];
	}
	return out;
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'nhe-test-'));
	fixturePath = join(stubDir, 'fixture.json');
	const gh = join(stubDir, 'gh');
	writeFileSync(gh, '#!/usr/bin/env bash\ncat "$GH_FIXTURE"\n');
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('needs-human-explain.sh — triage-Modus', () => {
	it('findet den Begründungs-Kommentar am Marker', () => {
		writeFileSync(fixturePath, JSON.stringify([comment('irgendwas anderes'), comment(TRIAGE_BODY, 7)]));
		const out = lookup(['--ticket', '42', '--mode', 'triage']);
		assert.equal(out.status, 'found');
		assert.match(out.permalink, /issuecomment-7$/);
	});

	it('meldet missing, wenn KEIN Marker-Kommentar existiert', () => {
		writeFileSync(fixturePath, JSON.stringify([comment('nur ein normaler Kommentar')]));
		assert.equal(lookup(['--ticket', '42', '--mode', 'triage']).status, 'missing');
	});

	it('verlangt den Marker am ANFANG (ein Zitat mitten im Text zählt nicht)', () => {
		// Gleiche Regel wie bei decisions/review: sonst träfe der lookup eine
		// Workflow-Card, die den Marker nur textlich erwähnt.
		writeFileSync(
			fixturePath,
			JSON.stringify([comment(`Hinweis: der Marker <!-- ai-triage-decision --> gehört nach oben`)]),
		);
		assert.equal(lookup(['--ticket', '42', '--mode', 'triage']).status, 'missing');
	});

	it('verwechselt triage nicht mit den PR-Markern', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([comment('<!-- ai-review -->\nBefund'), comment('<!-- ai-fixup-decisions -->\nX', 2)]),
		);
		assert.equal(lookup(['--ticket', '42', '--mode', 'triage']).status, 'missing');
	});

	it('liefert die Überschriften als findings', () => {
		writeFileSync(fixturePath, JSON.stringify([comment(TRIAGE_BODY, 3)]));
		const out = lookup(['--ticket', '42', '--mode', 'triage']);
		assert.match(out.findings, /Entscheidung nötig/);
		assert.match(out.findings, /Nur CSV/, 'nummerierte Optionen gehören in die Zusammenfassung');
	});
});

describe('needs-human-explain.sh — --ticket ist Alias für --pr', () => {
	it('liefert für beide Flags dasselbe Ergebnis', () => {
		writeFileSync(fixturePath, JSON.stringify([comment(TRIAGE_BODY, 9)]));
		assert.deepEqual(lookup(['--ticket', '42', '--mode', 'triage']), lookup(['--pr', '42', '--mode', 'triage']));
	});

	it('lehnt einen unbekannten Modus weiterhin hart ab', () => {
		const res = spawnSync('bash', [script, 'lookup', '--repo', 'o/r', '--ticket', '42', '--mode', 'quatsch'], {
			env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
			encoding: 'utf8',
		});
		assert.equal(res.status, 2);
		assert.match(res.stderr, /triage/, 'die Fehlermeldung muss den neuen Modus mit auflisten');
	});
});
