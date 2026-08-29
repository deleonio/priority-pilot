import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests fuer die Quellen-Auswahl in resolve-phase-routing.sh (ADR 0009):
 * Die ai-phase-routing-Tabelle wird ZUERST aus dem Harness-Kommentar
 * (<!-- ai-harness -->) gelesen; nur wenn der fehlt, faellt das Skript auf den
 * Issue-Body zurueck (Legacy-Tickets vor der Umstellung). Der Kommentar-Pfad
 * laeuft durch das echte harness-comment.sh mit — sein gh-Aufruf wird gestubbt.
 *
 * `gh` wird per PATH-Stub ersetzt: `gh api .../comments` liefert das Kommentare-
 * Fixture, `gh issue view` das Issue-Fixture (rohes JSON, jq-Filterung passiert
 * lokal im Skript — dieselbe Stub-Testbarkeit wie check-phase-label.sh).
 *
 * Stil-Vorbild: label-transition.test.ts (node:test + tsx, TABS).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'resolve-phase-routing.sh');

let stubDir: string;
let commentsFixturePath: string;
let issueFixturePath: string;
let outputPath: string;

const ROUTING_TABLE = [
	'<!-- ai-phase-routing:START -->',
	'| Phase | Run | Modell | Effort |',
	'| --- | --- | --- | --- |',
	'| ux | ja | haiku | low |',
	'| spec | nein | - | - |',
	'| impl | ja | sonnet | medium |',
	'| review | ja | sonnet | high |',
	'<!-- ai-phase-routing:END -->',
].join('\n');

const harnessComment = (inner: string) =>
	`<!-- ai-harness -->\n<!-- KI-ANALYSE:START stand=2026-08-30T10:00:00Z -->\n...\n<!-- KI-ANALYSE:END -->\n${inner}`;

type RunResult = { run: string; model: string; effort: string; source: string };

const runResolve = (phase: string): RunResult => {
	writeFileSync(outputPath, '');
	const res = spawnSync('bash', [script, '--repo', 'o/r', '--issue', '42', '--phase', phase], {
		env: {
			...process.env,
			PATH: `${stubDir}:${process.env.PATH}`,
			GITHUB_OUTPUT: outputPath,
			GH_COMMENTS_FIXTURE: commentsFixturePath,
			GH_ISSUE_FIXTURE: issueFixturePath,
		},
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	const out = readFileSync(outputPath, 'utf8');
	return {
		run: out.match(/^run=(.*)$/m)?.[1] ?? '',
		model: out.match(/^model=(.*)$/m)?.[1] ?? '',
		effort: out.match(/^effort=(.*)$/m)?.[1] ?? '',
		source: out.match(/^source=(.*)$/m)?.[1] ?? '',
	};
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'rpr-test-'));
	commentsFixturePath = join(stubDir, 'comments.json');
	issueFixturePath = join(stubDir, 'issue.json');
	outputPath = join(stubDir, 'github-output.txt');

	const gh = join(stubDir, 'gh');
	writeFileSync(
		gh,
		[
			'#!/usr/bin/env bash',
			'if [ "$1" = "api" ]; then',
			'  cat "$GH_COMMENTS_FIXTURE"',
			'  exit 0',
			'fi',
			'if [ "$1" = "issue" ]; then',
			'  cat "$GH_ISSUE_FIXTURE"',
			'  exit 0',
			'fi',
			'echo "gh-stub: unhandled: $*" >&2',
			'exit 1',
		].join('\n') + '\n',
	);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('resolve-phase-routing.sh — Quelle Harness-Kommentar (ADR 0009)', () => {
	it('Test 1 (KERN): Tabelle im Harness-Kommentar gewinnt', () => {
		writeFileSync(commentsFixturePath, JSON.stringify([{ id: 1, body: harnessComment(ROUTING_TABLE) }]));
		writeFileSync(issueFixturePath, JSON.stringify({ body: 'Validierte Beschreibung ohne Tabelle' }));
		const r = runResolve('ux');
		assert.equal(r.run, 'ja');
		assert.equal(r.model, 'haiku');
		assert.equal(r.effort, 'low');
		assert.equal(r.source, 'table');
	});

	it('Test 2 (LEGACY): ohne Kommentar fällt das Skript auf den Issue-Body zurück', () => {
		writeFileSync(commentsFixturePath, JSON.stringify([]));
		writeFileSync(issueFixturePath, JSON.stringify({ body: `Beschreibung\n${ROUTING_TABLE}` }));
		const r = runResolve('impl');
		assert.equal(r.run, 'ja');
		assert.equal(r.model, 'sonnet');
		assert.equal(r.effort, 'medium');
		assert.equal(r.source, 'table');
	});

	it('Test 3: Harness-Kommentar geht vor Body (Doppelung, Kommentar ist aktueller)', () => {
		const staleTable = ROUTING_TABLE.replace('| ux | ja | haiku | low |', '| ux | ja | opus | high |');
		writeFileSync(commentsFixturePath, JSON.stringify([{ id: 1, body: harnessComment(staleTable) }]));
		writeFileSync(issueFixturePath, JSON.stringify({ body: `Beschreibung\n${ROUTING_TABLE}` }));
		const r = runResolve('ux');
		assert.equal(r.model, 'opus', 'Kommentar-Quelle muss vor dem Body stehen');
		assert.equal(r.effort, 'high');
	});

	it('Test 4: keine Tabelle überall → fail-open none', () => {
		writeFileSync(commentsFixturePath, JSON.stringify([{ id: 1, body: harnessComment('nur Analyse') }]));
		writeFileSync(issueFixturePath, JSON.stringify({ body: 'Beschreibung' }));
		const r = runResolve('ux');
		assert.equal(r.run, '');
		assert.equal(r.model, '');
		assert.equal(r.source, 'none');
	});

	it('Test 5: ungueltige Zeile im Kommentar → ganze Zeile verwerfen (fail-open)', () => {
		const broken = ROUTING_TABLE.replace('| ux | ja | haiku | low |', '| ux | vielleicht | haiku | low |');
		writeFileSync(commentsFixturePath, JSON.stringify([{ id: 1, body: harnessComment(broken) }]));
		writeFileSync(issueFixturePath, JSON.stringify({ body: 'Beschreibung ohne Tabelle' }));
		const r = runResolve('ux');
		assert.equal(r.source, 'none');
		assert.equal(r.model, '');
	});
});
