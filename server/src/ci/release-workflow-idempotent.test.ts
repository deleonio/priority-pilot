/**
 * Rote Spec-Tests fuer Issue #134:
 * "Release-Workflow: `gh release create` schlaegt fehl, wenn ein Release zum Tag bereits existiert".
 *
 * Das Verhalten liegt vollstaendig in einem GitHub-Actions-Workflow
 * (`.github/workflows/release.yml`, Schritt "GitHub Release") sowie der dokumentierten
 * Referenz-Implementierung (`docs/deployment.md`). Ein echter Workflow-Lauf ist in den
 * Projekt-Testsuites nicht ausfuehrbar — pruefbar ist aber (a) die WORKFLOW-DEFINITION selbst
 * und (b) — als echter Verhaltensvertrag — das aus dem Schritt extrahierte Shell-Skript, das hier
 * gegen ein gemocktes `gh` real ausgefuehrt wird. Damit ist der Kernbug (AK2) ausfuehrbar belegt:
 * ein Wiederholungslauf bei bereits existierender Release darf NICHT mit Exit-Code 1 abbrechen.
 *
 * Diese Tests sind ROT, solange `release.yml` den Schritt nicht idempotent macht; sie werden gruen,
 * sobald die Umsetzung den Vertrag erfuellt. Es wird KEIN Produktivcode geschrieben — nur der
 * Vertrag festgehalten.
 *
 * Akzeptanzkriterien (aus dem Triage-/Re-Triage-Kommentar):
 *   AK1 — Erstlauf:        keine Release zum Tag  -> Release + Tarball-Asset werden angelegt (Exit 0).
 *   AK2 — Wiederholungslauf: Release existiert     -> Schritt bricht NICHT ab, Asset wird aktualisiert
 *                            (Exit 0, kein "already exists"-Fehler). Das ist der Kernbug.
 *   AK3 — Doku-Konsistenz:  docs/deployment.md zeigt denselben idempotenten Befehl wie release.yml.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/src/ci -> Repo-Wurzel
const repoRoot = join(__dirname, '..', '..', '..');
const workflowPath = join(repoRoot, '.github', 'workflows', 'release.yml');
const deploymentDocPath = join(repoRoot, 'docs', 'deployment.md');

/** Liest eine Datei roh ein; gibt '' zurueck, wenn sie (noch) fehlt. */
function readText(path: string): string {
	return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** Normalisiert Whitespace fuer robuste, formatunabhaengige Teilstring-Pruefungen. */
function squash(text: string): string {
	return text.replace(/\s+/g, ' ');
}

/**
 * Extrahiert das `run`-Shell-Skript des Schritts `- name: GitHub Release` aus der release.yml.
 * Unterstuetzt sowohl die einzeilige Form (`run: gh ...`) als auch den Block-Skalar (`run: |`).
 * Gibt '' zurueck, wenn der Schritt nicht gefunden wird.
 */
function extractGithubReleaseRun(wf: string): string {
	const lines = wf.split('\n');
	// Schritt-Anfang finden: "- name: GitHub Release" (beliebige Einrueckung).
	let i = lines.findIndex((l) => /^\s*-\s*name:\s*GitHub Release\s*$/.test(l));
	if (i === -1) return '';
	const stepIndent = lines[i].search(/\S/);
	i += 1;
	// Innerhalb des Schritt-Blocks (tiefer eingerueckt als der Schritt-Marker) das run:-Feld suchen.
	for (; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') continue;
		const indent = line.search(/\S/);
		// Naechster Schritt / Dedent -> run: nicht gefunden.
		if (indent <= stepIndent) break;
		const inlineMatch = line.match(/^\s*run:\s*(\S.*)$/);
		if (inlineMatch && !/^[|>]/.test(inlineMatch[1])) {
			return inlineMatch[1];
		}
		const blockMatch = line.match(/^\s*run:\s*[|>][+-]?\s*$/);
		if (blockMatch) {
			const runIndent = indent;
			const body: string[] = [];
			for (let j = i + 1; j < lines.length; j++) {
				const bl = lines[j];
				if (bl.trim() === '') {
					body.push('');
					continue;
				}
				if (bl.search(/\S/) <= runIndent) break;
				body.push(bl);
			}
			return body.join('\n');
		}
	}
	return '';
}

/**
 * Fuehrt das extrahierte Release-Skript gegen ein gemocktes `gh` aus.
 * `releaseExists` steuert, ob fuer das Tag bereits eine Release existiert.
 * Liefert { status, stderr } des bash-Laufs (bash -e wie in GitHub Actions).
 */
function runReleaseScript(script: string, releaseExists: boolean): { status: number; stderr: string } {
	const dir = mkdtempSync(join(tmpdir(), 'rel-idem-'));
	try {
		// Gemocktes gh, das das reale Verhalten nachbildet:
		//  - `gh release view TAG`   : Exit 0, wenn die Release existiert, sonst Exit 1.
		//  - `gh release create TAG` : schlaegt mit "already exists" fehl, wenn die Release existiert.
		//  - `gh release upload TAG` : immer Exit 0 (mit --clobber das idempotente Update).
		const gh = join(dir, 'gh');
		const ghScript = [
			'#!/usr/bin/env bash',
			'sub="$1 $2"', // z. B. "release view"
			'case "$sub" in',
			'  "release view")',
			`    if [ "${releaseExists ? '1' : '0'}" = "1" ]; then exit 0; else exit 1; fi ;;`,
			'  "release create")',
			`    if [ "${releaseExists ? '1' : '0'}" = "1" ]; then`,
			'      echo "a release with the same tag name already exists: $3" >&2; exit 1;',
			'    else exit 0; fi ;;',
			'  "release upload")',
			'    exit 0 ;;',
			'  *) exit 0 ;;',
			'esac',
		].join('\n');
		writeFileSync(gh, ghScript);
		chmodSync(gh, 0o755);

		const scriptPath = join(dir, 'step.sh');
		writeFileSync(scriptPath, script);

		try {
			const stderr = execFileSync('bash', ['-e', scriptPath], {
				env: {
					...process.env,
					PATH: `${dir}:${process.env.PATH ?? ''}`,
					GITHUB_REF_NAME: 'v1.0.0',
					GH_TOKEN: 'dummy',
				},
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			return { status: 0, stderr };
		} catch (err) {
			const e = err as { status?: number; stderr?: Buffer | string };
			return {
				status: typeof e.status === 'number' ? e.status : 1,
				stderr: e.stderr ? e.stderr.toString() : '',
			};
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe('Issue #134 — idempotenter Release-Schritt in release.yml', () => {
	it('Die Workflow-Datei existiert', () => {
		assert.ok(existsSync(workflowPath), `Erwartete Workflow-Datei fehlt: ${workflowPath}`);
	});

	it('Der Schritt "GitHub Release" mit einem run-Skript existiert', () => {
		const run = extractGithubReleaseRun(readText(workflowPath));
		assert.ok(run.length > 0, 'Schritt "GitHub Release" mit run-Feld nicht gefunden');
	});

	describe('AK1 — Erstlauf: keine Release zum Tag vorhanden', () => {
		it('legt die Release an, ohne Fehler (Exit 0)', () => {
			const run = extractGithubReleaseRun(readText(workflowPath));
			const { status, stderr } = runReleaseScript(run, /* releaseExists */ false);
			assert.equal(status, 0, `Erstlauf darf nicht fehlschlagen. stderr:\n${stderr}`);
		});

		it('ruft "gh release create" mit --generate-notes auf', () => {
			const run = squash(extractGithubReleaseRun(readText(workflowPath)));
			assert.match(run, /gh release create/, 'gh release create fehlt');
			assert.match(run, /--generate-notes/, '--generate-notes fehlt (Release-Notes des Erstlaufs)');
		});
	});

	describe('AK2 — Wiederholungslauf: Release existiert bereits (Kernbug)', () => {
		it('bricht NICHT mit Exit-Code 1 ab (Schritt bleibt gruen statt "already exists")', () => {
			const run = extractGithubReleaseRun(readText(workflowPath));
			const { status, stderr } = runReleaseScript(run, /* releaseExists */ true);
			// Kernbug: aktuell ruft der Schritt bedingungslos `gh release create` und stirbt mit
			// "already exists" (Exit 1). Der Vertrag verlangt einen idempotenten Exit 0 — egal ob
			// per view-Guard oder create-||-upload-Fallback geloest.
			assert.equal(
				status,
				0,
				`Wiederholungslauf muss idempotent sein (Exit 0), schlug aber fehl. stderr:\n${stderr}`,
			);
		});

		it('aktualisiert das Asset idempotent (gh release upload ... --clobber)', () => {
			const run = squash(extractGithubReleaseRun(readText(workflowPath)));
			assert.match(
				run,
				/gh release upload[^\n]*--clobber/,
				'Idempotentes Update via "gh release upload ... --clobber" fehlt',
			);
		});

		it('entscheidet anhand des Vorhandenseins der Release (gh release view ODER create-Fallback)', () => {
			const run = squash(extractGithubReleaseRun(readText(workflowPath)));
			const guarded = /gh release view/.test(run) || /gh release create[\s\S]*\|\|/.test(run);
			assert.ok(
				guarded,
				'Es fehlt die Verzweigung: entweder "gh release view"-Pruefung oder "create ... || upload"-Fallback',
			);
		});
	});

	describe('AK3 — Doku-Konsistenz (docs/deployment.md)', () => {
		it('die Referenz-Implementierung ist ebenfalls idempotent', () => {
			const doc = squash(readText(deploymentDocPath));
			assert.match(
				doc,
				/gh release upload[^\n]*--clobber/,
				'docs/deployment.md muss denselben idempotenten Befehl (gh release upload ... --clobber) zeigen',
			);
			const guarded = /gh release view/.test(doc) || /gh release create[\s\S]*\|\|/.test(doc);
			assert.ok(
				guarded,
				'docs/deployment.md muss dieselbe Idempotenz-Verzweigung (view-Pruefung oder ||-Fallback) zeigen wie release.yml',
			);
		});
	});
});
