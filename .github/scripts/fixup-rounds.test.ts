import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für fixup-rounds.sh (Issue #993) — der Fixup-Runden-Deckel.
 *
 * Die falsche Entscheidung ist in BEIDEN Richtungen teuer: Ein Deckel, der zu
 * früh stoppt, parkt konvergierende PRs beim Menschen (wie #968, grüner
 * Erst-Durchlauf); einer, der zu spät oder gar nicht stoppt, lässt Loops wie
 * #932 (10 Review- + 4 Fixup-Läufe, 34,5 Mio Token) bis zum Menschen laufen.
 * Zählgrundlage sind die labeled-Events für `ai:needs-fixup` in der PR-Timeline
 * — deterministisch, ohne LLM, auch nachträglich aus .costs/<n>.json ablesbar.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx); gh wird wie in
 * check-phase-label.test.ts durch einen Stub mit Fixture-Datei ersetzt.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'fixup-rounds.sh');
const workflow04 = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'workflows', '04-claude-implement.yml');

let stubDir: string;
let fixturePath: string;

const count = (args: string[], fixture: string) => {
	writeFileSync(fixturePath, fixture, 'utf8');
	const res = spawnSync('bash', [script, 'count', '--repo', 'o/r', '--pr', '42', ...args], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});
	return res;
};

const kv = (res: { stdout: string }) => ({
	count: res.stdout.match(/^count=(.*)$/m)?.[1] ?? '',
	max: res.stdout.match(/^max=(.*)$/m)?.[1] ?? '',
	stop: res.stdout.match(/^stop=(.*)$/m)?.[1] ?? '',
});

/** labeled/unlabeled-Events + Distraktoren zu einer Timeline-Seite. */
const labeled = (name: string) => ({ event: 'labeled', label: { name } });
const timeline = (events: object[]) => JSON.stringify(events);

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'fixup-rounds-'));
	fixturePath = join(stubDir, 'fixture.json');
	const gh = join(stubDir, 'gh');
	// Der einzig erwartete gh-Call ist `gh api …/timeline` → Fixture-Inhalt.
	writeFileSync(gh, '#!/usr/bin/env bash\ncat "$GH_FIXTURE"\n', { mode: 0o755 });
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('fixup-rounds.sh count — TF1: deterministische Zählung aus der Timeline', () => {
	it('zählt ausschließlich labeled-Events für ai:needs-fixup (Distraktoren zählen nicht)', () => {
		const res = count(
			['--max', '3'],
			timeline([
				labeled('ai:needs-impl'),
				{ event: 'unlabeled', label: { name: 'ai:needs-fixup' } },
				labeled('ai:needs-fixup'),
				{ event: 'commented', body: 'ai:needs-fixup' },
				labeled('ai:needs-review'),
				labeled('ai:needs-fixup'),
			]),
		);
		assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
		assert.equal(kv(res).count, '2');
	});

	it('konkatenierte Seiten (gh api --paginate) werden zusammengezählt', () => {
		const res = count(
			[],
			`${timeline([labeled('ai:needs-fixup')])}${timeline([labeled('ai:needs-fixup'), labeled('ai:needs-fixup')])}`,
		);
		assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
		assert.equal(kv(res).count, '3');
		assert.equal(kv(res).max, '3', '--max fehlt → Default 3 (AK3-Default)');
	});

	it('grüner Erst-Durchlauf: 0 Fixup-Runden → count=0, stop=false (PR #968 bleibt unberührt)', () => {
		const res = count([], timeline([labeled('ai:needs-review'), { event: 'commented', body: 'alles gut' }]));
		assert.equal(res.status, 0);
		assert.equal(kv(res).count, '0');
		assert.equal(kv(res).stop, 'false');
	});
});

describe('fixup-rounds.sh count — TF2: Schwellen-Entscheidung (Deckel)', () => {
	it('count = max (3. Runde bei Deckel 3) → stop=false, die Runde läuft noch', () => {
		const res = count(
			['--max', '3'],
			timeline([labeled('ai:needs-fixup'), labeled('ai:needs-fixup'), labeled('ai:needs-fixup')]),
		);
		assert.equal(res.status, 0);
		assert.deepEqual(kv(res), { count: '3', max: '3', stop: 'false' });
	});

	it('count = max+1 (4. Runde bei Deckel 3) → stop=true — der #932-Fall', () => {
		const res = count(
			['--max', '3'],
			timeline([
				labeled('ai:needs-fixup'),
				labeled('ai:needs-fixup'),
				labeled('ai:needs-fixup'),
				labeled('ai:needs-fixup'),
			]),
		);
		assert.equal(res.status, 0);
		assert.equal(kv(res).stop, 'true');
	});

	it('andere Deckelwerte wirken unverzögert (--max 1, count 2 → stop)', () => {
		const res = count(['--max', '1'], timeline([labeled('ai:needs-fixup'), labeled('ai:needs-fixup')]));
		assert.equal(res.status, 0);
		assert.equal(kv(res).stop, 'true');
	});
});

describe('fixup-rounds.sh count — TF3: Lesefehler → fail-closed', () => {
	it('gh schlägt fehl (leere/Fehler-Antwort) → Exit != 0, kein stop=false', () => {
		const res = count(['--max', '3'], 'gh: Not Found (HTTP 404)');
		assert.notEqual(res.status, 0);
		assert.doesNotMatch(res.stdout, /^stop=false$/m);
	});

	it('ungültiges JSON → Exit != 0 — ein Zählfehler gibt nie eine weitere Runde frei', () => {
		const res = count(['--max', '3'], '{ das ist kein Array');
		assert.notEqual(res.status, 0);
	});
});

describe('fixup-rounds.sh count — TF4: Argument-Validierung', () => {
	it('--max 0 / --max abc → Usage-Exit 2', () => {
		assert.equal(count(['--max', '0'], timeline([])).status, 2);
		assert.equal(count(['--max', 'abc'], timeline([])).status, 2);
	});

	it('fehlendes --repo/--pr → Usage-Exit 2', () => {
		const res = spawnSync('bash', [script, 'count'], { encoding: 'utf8' });
		assert.equal(res.status, 2);
	});
});

describe('Struktur-Check — Deckel-Konfiguration an genau einer Stelle (AK3)', () => {
	it('04-claude-implement.yml definiert MAX_FIXUP_ROUNDS als env-Anchor und ruft fixup-rounds.sh im Stop-Guard', () => {
		const yaml = readFileSync(workflow04, 'utf8');
		const anchors = yaml.match(/^\s*MAX_FIXUP_ROUNDS:.*$/gm) ?? [];
		assert.equal(anchors.length, 1, `MAX_FIXUP_ROUNDS muss genau 1× als env definiert sein, ist ${anchors.length}×`);
		assert.match(anchors[0], /:\s*'?3'?\s*$/, 'Deckel-Default ist 3');
		assert.match(yaml, /fixup-rounds\.sh/, 'Stop-Guard ruft fixup-rounds.sh');
	});
});
