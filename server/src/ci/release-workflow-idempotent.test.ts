/**
 * TOMBSTONE — Issue #134 ("idempotenter `gh release`-Schritt") ist durch #152 ABGELOEST.
 *
 * Urspruenglich hielt diese Datei den roten Spec-Vertrag fuer #134 fest: der Release-Schritt in
 * `.github/workflows/release.yml` musste `gh release create`/`gh release upload --clobber`
 * idempotent ausfuehren (Wiederholungslauf bei bereits existierender Release ⇒ Exit 0).
 *
 * Mit #152 wurde das gesamte Deployment von "Tag → Tarball → GitHub Release → SSH-Forced-Command"
 * auf "Merge auf main → Build → rsync der dist-Verzeichnisse → PM2-Reload" umgestellt. Damit gibt
 * es im Workflow KEINEN `gh release`-Schritt mehr — die #134-Idempotenz (Release existiert bereits)
 * ist gegenstandslos, denn rsync ist von Natur aus idempotent. Der **massgebliche** ausfuehrbare
 * Vertrag fuer den neuen Pfad lebt in `.github/workflows/release.test.ts` (#152) und assertet u. a.
 * ausdruecklich die ABWESENHEIT von `gh release` (siehe dort AC3).
 *
 * Die alten #134-Assertions wuerden den von #152 bewusst entfernten `gh release`-Pfad zurueck-
 * fordern und stehen damit im direkten Widerspruch zum akzeptierten #152-Spec — sie sind entfernt.
 * Was bleibt, ist ein schlanker Anti-Regressions-Guard: der abgeloeste Release-/Tag-Pfad darf nicht
 * unbemerkt zurueckkehren. (Vollstaendiges Loeschen der Datei ist im headless-Lauf durch den
 * Datei-Guard blockiert — der Tombstone ist der projekt-sanktionierte "entkernt"-Pfad, analog zu
 * `scripts/pack-release.sh`.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/src/ci -> Repo-Wurzel
const repoRoot = join(__dirname, '..', '..', '..');
const workflowPath = join(repoRoot, '.github', 'workflows', 'release.yml');

describe('Issue #134 — durch #152 abgeloest (gh-release-Pfad entfernt)', () => {
	it('release.yml enthaelt keinen abgeloesten gh-release-Schritt mehr', () => {
		const wf = readFileSync(workflowPath, 'utf8');
		assert.doesNotMatch(
			wf,
			/gh release/,
			'Der mit #152 entfernte gh-release-Pfad darf nicht zurueckkehren (massgeblicher Vertrag: release.test.ts/#152).',
		);
	});
});
