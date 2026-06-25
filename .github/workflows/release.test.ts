import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ROTE Tests (#152) — der ausfuehrbare Vertrag fuer das vereinfachte Deployment.
//
// Hintergrund: Das Deployment soll von "Tag -> Tarball -> GitHub Release -> SSH-Forced-Command"
// auf "Merge auf main -> Build -> rsync der dist-Verzeichnisse" umgestellt werden (siehe Issue
// #152, eingegrenzter Repo-Scope laut Re-Triage: nur Bauen + rsync, Server-Seite off-repo).
//
// Da es sich um CI-KONFIGURATION handelt, ist die Test-Ebene ein statischer Workflow-Vertrag:
// die Datei wird als Text geladen und gegen das Soll-Verhalten assertet — gleiches Muster wie
// model-delegation.test.ts in diesem Verzeichnis, das ueber tsx in ci.yml laeuft. Der reale Deploy
// (rsync auf den echten Host nach Secret-Hinterlegung) wird operativ am Workflow-Lauf verifiziert.
//
// Diese Tests sind ROT, solange release.yml/pack-release.sh noch den alten Tag-/Release-/SSH-Pfad
// beschreiben; sie werden GRUEN, sobald die Umsetzung den Workflow auf main + Build + rsync umstellt
// und die Tarball-/Release-Logik entfernt.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const releasePath = join(here, 'release.yml');
const packReleasePath = join(repoRoot, 'scripts', 'pack-release.sh');

const releaseYml = readFileSync(releasePath, 'utf8');

/**
 * Extrahiert den `on:`-Block (Trigger) bis zum naechsten Top-Level-Schluessel
 * (`permissions:`/`jobs:`/`env:` …). Top-Level-Schluessel stehen ohne Einrueckung am Zeilenanfang.
 */
function onBlock(yml: string): string {
	const lines = yml.split('\n');
	const start = lines.findIndex((l) => /^on:/.test(l));
	assert.notEqual(start, -1, 'release.yml muss einen on:-Trigger-Block besitzen');
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((l) => /^[A-Za-z]/.test(l)); // naechster Top-Level-Key
	return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

describe('Deploy-Workflow #152 — AC1: Trigger ist Merge/Push auf main, kein Tag/Release', () => {
	const trigger = onBlock(releaseYml);

	it('loest auf push nach main aus (Branch main im push-Trigger)', () => {
		assert.match(trigger, /push:/, 'on: muss einen push-Trigger enthalten');
		// branches: [main] (inline) ODER branches:\n    - main (Block-Liste)
		assert.match(
			trigger,
			/branches:\s*(\[[^\]]*\bmain\b[^\]]*\]|(\r?\n\s*-\s*\S+)*\r?\n\s*-\s*['"]?main['"]?)/,
			'der push-Trigger muss den Branch main umfassen',
		);
	});

	it('hat KEINEN Tag-Trigger mehr (kein on.push.tags)', () => {
		assert.doesNotMatch(trigger, /\btags:/, 'der Tag-Trigger (tags: [v*.*.*]) muss entfernt sein');
	});
});

describe('Deploy-Workflow #152 — AC2: Build per pnpm', () => {
	it('installiert reproduzierbar mit pnpm install --frozen-lockfile', () => {
		assert.match(releaseYml, /pnpm install --frozen-lockfile/, 'frozen-lockfile-Install fehlt im Workflow');
	});

	it('baut das Monorepo mit pnpm -r build', () => {
		assert.match(releaseYml, /pnpm -r build/, 'pnpm -r build fehlt im Workflow');
	});
});

describe('Deploy-Workflow #152 — AC3: rsync statt GitHub-Release/SSH-Forced-Command', () => {
	it('spiegelt die dist-Verzeichnisse per rsync', () => {
		assert.match(releaseYml, /rsync/, 'es muss einen rsync-Schritt geben');
		assert.match(releaseYml, /frontend\/dist/, 'rsync muss frontend/dist umfassen');
		assert.match(releaseYml, /server\/dist/, 'rsync muss server/dist umfassen');
	});

	it('legt kein GitHub Release mehr an (kein gh release create/upload)', () => {
		assert.doesNotMatch(releaseYml, /gh release/, 'der GitHub-Release-Schritt muss entfernt sein');
	});

	it('ruft kein SSH-Forced-Command-Deploy mehr auf (kein "deploy priority-pilot")', () => {
		assert.doesNotMatch(
			releaseYml,
			/deploy priority-pilot/,
			'der SSH-Forced-Command (ssh … "deploy priority-pilot …") muss entfernt sein',
		);
	});
});

describe('Deploy-Workflow #152 — AC4: Tarball-/Release-Pfad entfernt', () => {
	it('schnuert kein Tarball mehr (release.yml ruft pack-release.sh nicht auf)', () => {
		assert.doesNotMatch(releaseYml, /pack-release\.sh/, 'der Tarball-Pack-Schritt muss aus release.yml entfernt sein');
	});

	it('enthaelt keine Tarball-/Release-Logik in scripts/pack-release.sh (entfernt oder entkernt)', () => {
		// Erfuellt, wenn die Datei geloescht ODER von Tarball-/Release-Logik befreit wurde.
		if (!existsSync(packReleasePath)) return;
		const pack = readFileSync(packReleasePath, 'utf8');
		assert.doesNotMatch(pack, /tar -czf/, 'die Tarball-Schnuerung (tar -czf) muss entfernt sein');
		assert.doesNotMatch(pack, /gh release/, 'die GitHub-Release-Logik muss aus dem Skript entfernt sein');
	});
});
