import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * ROTE Spec-Tests für #229 „Handbuch" — Teilstück #255 (Handbuch-Inhalt).
 *
 * Ziel (siehe KI-Analyse im Ticket): Es entsteht ein systematisches, deutschsprachiges Nutzerhandbuch
 * unter `docs/user-guide.md`, das aus der `README.md` verlinkt ist und alle Hauptfunktionen abdeckt.
 *
 * Diese Tests sind reine Dateisystem-Prüfungen (keine DB, kein `resetDb`/`closeDb`). Sie sind **rot**,
 * bis `docs/user-guide.md` angelegt, aus der `README.md` verlinkt und inhaltlich befüllt ist. Die
 * Implementierung folgt durch die Umsetzung.
 */

// Repo-Wurzel: server/src/logics → drei Ebenen hoch nach server/, dann eine weitere nach oben ins Monorepo.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const guidePath = resolve(repoRoot, 'docs', 'user-guide.md');
const readmePath = resolve(repoRoot, 'README.md');

describe('docs/user-guide.md', () => {
	// ── AK1a: Handbuch-Datei existiert ────────────────────────────────────────
	it('AK1a: die Handbuch-Datei docs/user-guide.md existiert', () => {
		assert.ok(existsSync(guidePath), 'docs/user-guide.md muss existieren');
	});

	// ── AK1b: README verlinkt das Handbuch ────────────────────────────────────
	it('AK1b: README.md verlinkt auf docs/user-guide.md', () => {
		const readme = readFileSync(readmePath, 'utf8');
		assert.ok(
			readme.includes('docs/user-guide.md'),
			'README.md muss einen Link auf docs/user-guide.md enthalten',
		);
	});

	// ── AK2: alle Hauptfunktionen sind systematisch beschrieben ───────────────
	it('AK2: das Handbuch beschreibt alle Hauptfunktionen (deutsche Abschnitts-Überschriften)', () => {
		const guide = readFileSync(guidePath, 'utf8');
		// Erwartete Kernabschnitte einer Aufgaben-Priorisierungs-App: Aufgaben, Abhängigkeiten,
		// Säulen, Dashboard und Hilfe. Geprüft werden ##-Überschriften (case-insensitive), damit
		// die genaue Groß-/Kleinschreibung der Umsetzung überlassen bleibt.
		const erwarteteAbschnitte = ['Aufgaben', 'Abhängigkeiten', 'Säulen', 'Dashboard', 'Hilfe'];
		for (const abschnitt of erwarteteAbschnitte) {
			const heading = new RegExp(`^##\\s+.*${abschnitt}`, 'im');
			assert.ok(
				heading.test(guide),
				`Handbuch muss einen Abschnitt "## …${abschnitt}…" enthalten`,
			);
		}
	});
});
