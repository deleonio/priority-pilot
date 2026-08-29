import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für harness-comment.sh — das Lesen des EINEN Marker-Kommentars (ADR 0009).
 *
 * Schwerpunkt 1: Argumentfehler exiten mit 2 (Dokumentation im Skript-Kopf). Wert-Flags
 * ohne Wert würden ohne $#-Guard unter `set -u` an unbound $2 mit Exit 1 crashen
 * (Memory 2026-08-24, exakt dieser shift-2-Fall).
 *
 * Schwerpunkt 2: Selektion per Marker (startswith) — first (ältester passender
 * Kommentar), Body- wie --id-Modus, kein Treffer → leer und Exit 0 (fail-open).
 *
 * `gh` wird per PATH-Stub ersetzt. Läuft über `pnpm test:scripts`.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'harness-comment.sh');

let stubDir: string;
let fixturePath: string;

const comment = (body: string, id = 1) => ({ id, body });

const run = (args: string[]): ReturnType<typeof spawnSync> =>
	spawnSync('bash', [script, ...args], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'harness-comment-stub-'));
	const gh = join(stubDir, 'gh');
	writeFileSync(gh, '#!/usr/bin/env bash\ncat "$GH_FIXTURE"\n');
	chmodSync(gh, 0o755);
	fixturePath = join(stubDir, 'fixture.json');
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

const HARNESS = '<!-- ai-harness -->\n\n<!-- KI-ANALYSE:START -->Analyse<!-- KI-ANALYSE:END -->';

describe('harness-comment.sh — Argumentfehler', () => {
	it('exitet mit 2, wenn --repo keinen Wert hat', () => {
		const res = run(['--repo', '--issue', '7']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /--repo/);
	});

	it('exitet mit 2, wenn --issue am Ende ohne Wert steht', () => {
		const res = run(['--repo', 'o/r', '--issue']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /--issue/);
	});

	it('exitet mit 2, wenn Pflicht-Argumente fehlen', () => {
		const res = run([]);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /Pflicht/);
	});
});

describe('harness-comment.sh — Selektion', () => {
	it('liefert den Body des ersten Marker-Kommentars', () => {
		writeFileSync(fixturePath, JSON.stringify([comment('anderer Kommentar'), comment(HARNESS, 7)]));
		const res = run(['--repo', 'o/r', '--issue', '42']);
		assert.equal(res.status, 0);
		assert.equal(res.stdout, `${HARNESS}\n`);
	});

	it('--id liefert die REST-ID statt des Bodys', () => {
		writeFileSync(fixturePath, JSON.stringify([comment(HARNESS, 7)]));
		const res = run(['--repo', 'o/r', '--issue', '42', '--id']);
		assert.equal(res.status, 0);
		assert.equal(res.stdout.trim(), '7');
	});

	it('liefert leer und Exit 0, wenn kein Marker-Kommentar existiert (fail-open)', () => {
		writeFileSync(fixturePath, JSON.stringify([comment('nur ein normaler Kommentar')]));
		const res = run(['--repo', 'o/r', '--issue', '42']);
		assert.equal(res.status, 0);
		assert.equal(res.stdout, '');
	});

	it('ignoriert unbekannte Argumente', () => {
		writeFileSync(fixturePath, JSON.stringify([comment(HARNESS, 7)]));
		const res = run(['--repo', 'o/r', '--issue', '42', '--unbekannt', 'x']);
		assert.equal(res.status, 0);
		assert.equal(res.stdout, `${HARNESS}\n`);
	});
});
