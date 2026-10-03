import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für pr-doc-render.sh — die release:*-Label-Logik (#2111).
 *
 * Kern-Zusicherungen: Der Fallback-Pfad (fehlendes doc.json) setzt KEIN release:* mehr;
 * ein echter Lauf ERSETZT ein vorhandenes release:engineering (der erkennbare alte
 * Fallback-Default) durch das Label der frischen Klassifikation; ein bewusst gesetztes
 * anderes release:* bleibt unangetastet (HAS_RELEASE-Guard).
 *
 * `gh` wird per PATH-Stub ersetzt: Er loggt jeden Aufruf nach calls.log und beantwortet
 * `pr view` mit der jeweiligen Labels-Fixture (Muster wait-for-checks.test.ts). Der
 * best-effort Bild-Sweep läuft gegen denselben Stub und bleibt ohne Wirkung.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'pr-doc-render.sh');

let stubDir: string;

const prWithLabels = (names: string[]) =>
	JSON.stringify({
		title: 'fix(test): release label fallback',
		body: 'PR body',
		labels: names.map((name) => ({ name })),
	});

const docJson = (classification: string) =>
	JSON.stringify({
		classification,
		summary_en: 'Summary of the change.',
		summary_de: 'Zusammenfassung der Aenderung.',
		release_note_en: 'Release note text.',
	});

/** Läuft das Skript einmal echt (kein --dry-run) und liefert die geloggten gh-Aufrufe. */
const run = (labels: string[], classification: string | null) => {
	writeFileSync(join(stubDir, 'pr.json'), prWithLabels(labels));
	writeFileSync(join(stubDir, 'calls.log'), '');
	const docPath = join(stubDir, 'doc.json');
	if (classification === null) rmSync(docPath, { force: true });
	else writeFileSync(docPath, docJson(classification));
	const res = spawnSync('bash', [script, '--repo', 'o/r', '--pr', '42', '--doc', docPath], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, STUB_DIR: stubDir },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return readFileSync(join(stubDir, 'calls.log'), 'utf8').split('\n').filter(Boolean);
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'pdr-test-'));
	const gh = join(stubDir, 'gh');
	// Loggt jeden Aufruf; nur `pr view` antwortet (aktuelle Labels-Fixture). Die
	// Documenter-Kommentar-Suche bleibt leer => POST-Pfad statt PATCH.
	writeFileSync(
		gh,
		[
			'#!/usr/bin/env bash',
			'printf \'%s\\n\' "$*" >> "$STUB_DIR/calls.log"',
			'case "$*" in',
			'  *"pr view"*) cat "$STUB_DIR/pr.json" ;;',
			'  *) exit 0 ;;',
			'esac',
		].join('\n'),
	);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('pr-doc-render.sh — Label-Logik (#2111)', () => {
	it('Fallback-Pfad (doc.json fehlt) setzt nur ai:documented, kein release:*', () => {
		const calls = run([], null);
		assert.ok(
			calls.some((c) => c.includes('--add-label ai:documented')),
			calls.join('\n'),
		);
		assert.ok(!calls.some((c) => /--add-label release:/.test(c)), calls.join('\n'));
		assert.ok(!calls.some((c) => /--remove-label/.test(c)), calls.join('\n'));
	});

	it('nur release:engineering + Klassifikation fixed: ersetzt Fallback-Label durch release:fix', () => {
		const calls = run(['release:engineering'], 'fixed');
		const remove = calls.findIndex((c) => c.includes('--remove-label release:engineering'));
		const add = calls.findIndex((c) => c.includes('--add-label release:fix'));
		assert.ok(remove !== -1, calls.join('\n'));
		assert.ok(add !== -1, calls.join('\n'));
		assert.ok(remove < add, 'remove muss vor add laufen (&&-Kette)');
		assert.ok(
			calls.some((c) => c.includes('--add-label ai:documented')),
			calls.join('\n'),
		);
		assert.ok(!calls.some((c) => /--add-label release:engineering/.test(c)), calls.join('\n'));
	});

	it('bewusst gesetztes release:* (engineering + feature) bleibt unangetastet', () => {
		const calls = run(['release:engineering', 'release:feature'], 'fixed');
		assert.ok(!calls.some((c) => /--remove-label/.test(c)), calls.join('\n'));
		assert.ok(!calls.some((c) => /--add-label release:/.test(c)), calls.join('\n'));
		assert.ok(
			calls.some((c) => c.includes('--add-label ai:documented')),
			calls.join('\n'),
		);
	});
});
