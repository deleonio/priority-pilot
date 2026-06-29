import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Rote Spec-Tests für #175 — Kreuzverhoer-Agent als .claude/agents/kreuzverhoer.md anlegen.
//
// Vertrag: Die Tests prüfen Existenz und Inhalt der Agent-Definitionsdatei.
// Sie werden grün, sobald die Datei mit korrektem Frontmatter und Body existiert.
// Keinen Produktivcode schreiben — nur Vertragsbestimmung.

// Root: zwei Verzeichnisse über server/src/
const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const AGENT_PATH = resolve(ROOT, '.claude/agents/kreuzverhoer.md');

describe('Issue #175 — Kreuzverhoer-Agent-Definition', () => {
	describe('AK-1 — Datei existiert', () => {
		it('.claude/agents/kreuzverhoer.md muss nach dem Merge existieren', () => {
			assert.ok(existsSync(AGENT_PATH), '.claude/agents/kreuzverhoer.md wurde nicht gefunden – Datei anlegen');
		});
	});

	describe('AK-2 — Frontmatter: name', () => {
		it('enthält "name: kreuzverhoer" im Frontmatter', () => {
			assert.ok(existsSync(AGENT_PATH), '.claude/agents/kreuzverhoer.md fehlt');
			const content = readFileSync(AGENT_PATH, 'utf-8');
			assert.match(content, /^name:\s*kreuzverhoer\s*$/m, 'Frontmatter muss "name: kreuzverhoer" enthalten');
		});
	});

	describe('AK-3 — Frontmatter: Trigger-Phrasen in description', () => {
		it('description enthält die Trigger-Phrase "nimm das auseinander"', () => {
			assert.ok(existsSync(AGENT_PATH), '.claude/agents/kreuzverhoer.md fehlt');
			const content = readFileSync(AGENT_PATH, 'utf-8');
			assert.match(
				content,
				/nimm das auseinander/i,
				'description muss Trigger-Phrase "nimm das auseinander" enthalten',
			);
		});
	});

	describe('AK-4 — Body: Kern-Prompt vorhanden', () => {
		it('Body enthält "Hinterfrage jede Annahme"', () => {
			assert.ok(existsSync(AGENT_PATH), '.claude/agents/kreuzverhoer.md fehlt');
			const content = readFileSync(AGENT_PATH, 'utf-8');
			assert.match(
				content,
				/Hinterfrage jede Annahme/,
				'Body muss "Hinterfrage jede Annahme" aus dem vorgegebenen Prompt enthalten',
			);
		});
	});
});
