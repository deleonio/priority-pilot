/**
 * Rote Spec-Tests fuer Issue #114 — "Spike: Agent-SDK-Prototyp fuer einen Workflow-Schritt
 * (vs. heutige Action)".
 *
 * Ein Spike liefert keine klassischen Akzeptanzkriterien, sondern eine **Definition of Done**
 * mit pruefbaren Liefergegenstaenden (siehe Triage-Kommentar am Issue, "Definition of Done …
 * ersetzt Akzeptanzkriterien beim Spike"). Diese Tests machen genau diese Liefergegenstaende
 * zum ausfuehrbaren Vertrag:
 *
 *   DoD 1 — Lauffaehiger Prototyp eines Workflow-Schritts ueber den Agent SDK (headless,
 *           lokal reproduzierbar).
 *   DoD 2 — Vergleichsdokument in `.ai-knowledge/` (agent-sdk-spike.md) mit der
 *           Vergleichstabelle (5 Kriterien), ausgefuellt mit Beobachtungen aus dem Prototyp.
 *   DoD 3 — Klare Empfehlung (ja / nein / teilweise) inkl. Auswirkung auf den
 *           `AI_AGENT`-Umschalter.
 *
 * Die Tests sind ROT, solange die Liefergegenstaende fehlen, und werden GRUEN, sobald die
 * Umsetzung den Prototyp + das Vergleichsdokument liefert — ohne die Tests zu aendern. Es wird
 * KEIN Produktivcode mitgeliefert (Gewaltenteilung, Stufe 3 der TDD-Strategie).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// server/src/spike/ -> Repo-Wurzel ist drei Ebenen hoeher.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

const SPIKE_DOC = join(repoRoot, '.ai-knowledge', 'agent-sdk-spike.md');
const SPIKE_DIR = join(repoRoot, 'spikes', 'agent-sdk');

/** Liest eine Datei oder gibt '' zurueck, wenn sie fehlt (haelt Tests aussagekraeftig rot). */
const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** Sammelt rekursiv alle Dateipfade unterhalb von `dir`. */
const walk = (dir: string): string[] => {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
};

/** Konkateniert den Quelltext aller .ts-Dateien des Prototyps. */
const prototypeSource = (): string => {
	const tsFiles = walk(SPIKE_DIR).filter((f) => f.endsWith('.ts'));
	return tsFiles.map(read).join('\n');
};

const PLACEHOLDER = /^(?:[-–—…]+|tbd|todo|n\/a|\.\.\.|xxx)$/i;

describe('Issue #114 — Agent-SDK-Spike: Liefergegenstaende (DoD)', () => {
	describe('DoD 1 — lauffaehiger Agent-SDK-Prototyp (headless, lokal reproduzierbar)', () => {
		it('legt das Prototyp-Verzeichnis spikes/agent-sdk/ an', () => {
			assert.ok(
				existsSync(SPIKE_DIR) && statSync(SPIKE_DIR).isDirectory(),
				'Erwartet ein Prototyp-Verzeichnis spikes/agent-sdk/ (throwaway, kein Merge in Produktiv-Workflows).',
			);
		});

		it('enthaelt mindestens eine TypeScript-Quelldatei als Einstieg', () => {
			const tsFiles = walk(SPIKE_DIR).filter((f) => f.endsWith('.ts'));
			assert.ok(
				tsFiles.length > 0,
				'Erwartet mindestens eine .ts-Datei im Prototyp (TS-Einstieg ueber den Agent SDK).',
			);
		});

		it('bindet den Agent SDK ein und ruft query() auf', () => {
			const source = prototypeSource();
			assert.match(
				source,
				/@anthropic-ai\/claude-agent-sdk/,
				'Prototyp muss das Agent-SDK-Paket @anthropic-ai/claude-agent-sdk einbinden (nicht die fertige Action).',
			);
			assert.match(
				source,
				/\bquery\s*\(/,
				'Prototyp muss den Agent-SDK-Einstiegspunkt query() aufrufen (die programmatische Einbettung).',
			);
		});

		it('authentifiziert headless ueber eine Umgebungsvariable (Secret), nicht interaktiv', () => {
			const source = prototypeSource();
			assert.match(
				source,
				/process\.env\.(?:ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN)/,
				'Prototyp muss sich headless ueber ANTHROPIC_API_KEY bzw. CLAUDE_CODE_OAUTH_TOKEN aus der Umgebung authentifizieren.',
			);
		});

		it('ist lokal reproduzierbar (dokumentierter Startbefehl)', () => {
			// Entweder ein eigenes package.json mit Start-Skript oder eine README mit Aufrufbeschreibung.
			const pkgPath = join(SPIKE_DIR, 'package.json');
			const hasRunnableScript = existsSync(pkgPath) && /"scripts"\s*:\s*\{[^}]*\}/s.test(read(pkgPath));
			const readme = walk(SPIKE_DIR).find((f) => /readme\.md$/i.test(f));
			const readmeDescribesRun = readme ? /\b(?:pnpm|npm|node|tsx)\b/.test(read(readme)) : false;
			assert.ok(
				hasRunnableScript || readmeDescribesRun,
				'Prototyp muss lokal reproduzierbar sein: package.json-Skript oder README mit Startbefehl (pnpm/npm/node/tsx).',
			);
		});
	});

	describe('DoD 2 — Vergleichsdokument .ai-knowledge/agent-sdk-spike.md', () => {
		it('existiert', () => {
			assert.ok(
				existsSync(SPIKE_DOC),
				'Erwartet das Vergleichsdokument .ai-knowledge/agent-sdk-spike.md mit Vergleichstabelle und Empfehlung.',
			);
		});

		const CRITERIA = ['Kontrolle', 'Aufwand', 'Kosten', 'AI_AGENT', 'Determinismus'];

		for (const criterion of CRITERIA) {
			it(`fuehrt das Vergleichskriterium "${criterion}" als Tabellenzeile mit ausgefuellter Beobachtung`, () => {
				const doc = read(SPIKE_DOC);
				const row = doc.split('\n').find((line) => line.includes('|') && line.includes(criterion));
				assert.ok(row, `Vergleichskriterium "${criterion}" fehlt als Tabellenzeile.`);

				// Zellen einer Markdown-Tabellenzeile; fuehrendes/abschliessendes | entfernen.
				const cells = row
					.replace(/^\s*\|/, '')
					.replace(/\|\s*$/, '')
					.split('|')
					.map((c) => c.trim());
				const observation = cells.slice(1).join(' ').trim();
				assert.ok(
					observation.length > 0 && !PLACEHOLDER.test(observation),
					`Kriterium "${criterion}" braucht eine ausgefuellte Beobachtung (kein leerer/Platzhalter-Eintrag).`,
				);
			});
		}

		it('belegt den Prototyp-Bezug (verweist auf Paket bzw. Prototyp-Verzeichnis)', () => {
			const doc = read(SPIKE_DOC);
			assert.match(
				doc,
				/@anthropic-ai\/claude-agent-sdk|spikes\/agent-sdk/,
				'Das Dokument muss den Prototyp belegen (Agent-SDK-Paket oder spikes/agent-sdk/ referenzieren).',
			);
		});
	});

	describe('DoD 3 — klare Empfehlung inkl. AI_AGENT-Auswirkung', () => {
		it('nennt eine eindeutige Empfehlung (ja / nein / teilweise)', () => {
			const doc = read(SPIKE_DOC).toLowerCase();
			const empfehlungIdx = doc.indexOf('empfehlung');
			assert.ok(empfehlungIdx >= 0, 'Es fehlt ein Empfehlungs-Abschnitt ("Empfehlung").');
			const section = doc.slice(empfehlungIdx);
			assert.match(
				section,
				/\b(ja|nein|teilweise)\b/,
				'Die Empfehlung muss eindeutig ja / nein / teilweise nennen (klare, abnehmbare Richtungsentscheidung).',
			);
		});

		it('benennt die Auswirkung auf den AI_AGENT-Umschalter (Claude/Mistral)', () => {
			const doc = read(SPIKE_DOC);
			assert.match(
				doc,
				/AI_AGENT/,
				'Die Empfehlung muss die Auswirkung auf den AI_AGENT-Umschalter (Claude<->Mistral) benennen.',
			);
		});
	});
});
