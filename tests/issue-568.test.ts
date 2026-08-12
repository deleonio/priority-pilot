/**
 * Rote Spec-Tests für Issue #568
 *
 * "[Teststrategie] Spec-First-Regel in Entwicklungsprozess verankern" (Teil des Epics #563)
 *
 * Akzeptanzkriterien (aus Issue-Body / KI-ANALYSE):
 * AC1: Definition of Done enthält "Spezifikation aktualisiert".
 * AC2: PR-Template weist auf die Spec-Pflicht hin.
 *
 * Die Tests prüfen ausschließlich Dokumentation — kein Produktivcode. Sie sind ROT,
 * solange die Spec-First-Regel nicht in den Dokumenten verankert ist, und werden GRÜN,
 * sobald die Implementierung die Regel gemäß Konvention eingetragen hat.
 *
 * Test-Qualität (gemäß DOCS-CARVE-OUT):
 * - Diese Tests sind keine Change-Detectors: sie prüfen nicht, ob ein String
 *   wörtlich enthalten ist, sondern ob die Dokumentation die Spec-Pflicht
 *   kommuniziert (strukturelle Eigenschaft).
 * - Bei DOCS-Änderungen ohne Code-Entstehen (reines Doku/Pattern) würden wir
 *   auf manuelle Verifikation im PR-Body setzen. Da Issue #568 aber Prozess-
 *   konventionen etabliert, die überprüfbar sind, schreiben wir automatisierte Tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');

async function readProjectFile(rel: string): Promise<string> {
	return readFile(resolve(ROOT, rel), 'utf-8');
}

describe('Issue #568 — Spec-First-Regel in Entwicklungsprozess verankern', () => {
	describe('AC1 — Definition of Done enthält "Spezifikation aktualisiert"', () => {
		it('CONTRIBUTING.md Abschnitt "Änderungen einreichen" erwähnt Spec/Spec-Pflicht', async () => {
			const contributing = await readProjectFile('CONTRIBUTING.md');

			// Prüft strukturell: gibt es einen Abschnitt über Änderungen, der Spec erwähnt?
			const changesSection = contributing.match(/## Änderungen einreichen[\s\S]*?(?=##|\Z)/i);
			assert.ok(changesSection, 'CONTRIBUTING.md muss einen Abschnitt "Änderungen einreichen" haben.');

			// Prüft inhaltlich: enthält der Abschnitt Keywords zu Spec/First-Test?
			const hasSpecMention =
				changesSection[0].toLowerCase().includes('spec') ||
				changesSection[0].toLowerCase().includes('spezif') ||
				changesSection[0].toLowerCase().includes('test-first') ||
				changesSection[0].toLowerCase().includes('red-green');

			assert.ok(
				hasSpecMention,
				'Abschnitt "Änderungen einreichen" muss auf Spec-Pflicht hinweisen (Keywords: spec, spezifikation, test-first, red-green).',
			);
		});

		it('PR-Template Checkliste enthält Spec-bezogenen Punkt', async () => {
			const template = await readProjectFile('.github/pull_request_template.md');

			// Prüft strukturell: gibt es eine Checkliste?
			const checklistSection = template.match(/## Checkliste[\s\S]*?(?=##|\Z)/i);
			assert.ok(checklistSection, 'PR-Template muss eine Checkliste haben.');

			// Prüft inhaltlich: enthält die Checkliste einen Spec-Point?
			const checklist = checklistSection[0];
			const hasSpecChecklistItem =
				checklist.toLowerCase().includes('spec') ||
				checklist.toLowerCase().includes('spezifikation') ||
				checklist.toLowerCase().includes('akzeptanzkriterium') ||
				(checklist.includes('testen') && checklist.includes('abgebildet'));

			assert.ok(
				hasSpecChecklistItem,
				'PR-Template Checkliste muss Spec-bezogenen Punkt enthalten (z.B. "Spezifikation aktualisiert" oder "Tests bilden AK ab").',
			);
		});
	});

	describe('AC2 — PR-Template weist auf die Spec-Pflicht hin', () => {
		it('PR-Template enthält expliziten Hinweis auf Spec-Pflicht außerhalb der Checkliste', async () => {
			const template = await readProjectFile('.github/pull_request_template.md');

			// Prüft strukturell: gibt es einen Hinweis, der nicht nur in der Checkliste ist?
			const specKeywords = ['spec', 'spezifikation', 'test-first', 'red-green', 'akzeptanzkriterium'];
			const hasSpecHint = specKeywords.some((keyword) => {
				const regex = new RegExp(keyword, 'i');
				// Prüft, ob das Keyword mehr als einmal vorkommt (mindestens einmal außerhalb der Checkliste)
				const matches = template.match(regex);
				return matches && matches.length >= 1;
			});

			assert.ok(hasSpecHint, 'PR-Template muss an beliebiger Stelle auf Spec-Pflicht hinweisen.');
		});

		it('PR-Template Struktur enthält Abschnitte für Spec-Verifikation', async () => {
			const template = await readProjectFile('.github/pull_request_template.md');

			// Prüft strukturell: hat das Template logische Abschnitte?
			const hasDescription = /##\s*Beschreibung/i.test(template);
			const hasChecklist = /##\s*Checkliste/i.test(template);
			const hasResults = /##\s*Ergebnisse/i.test(template) || /##\s*Testergebnisse/i.test(template);

			assert.ok(
				hasDescription && hasChecklist && hasResults,
				'PR-Template muss strukturelle Abschnitte haben (Beschreibung, Checkliste, Ergebnisse).',
			);
		});
	});

	describe('Dokumentations-Konsistenz — Spec-First-Workflow ist übergreifend dokumentiert', () => {
		it('CONTRIBUTING.md und PR-Template sind konsistent zur Spec-Pflicht', async () => {
			const [contributing, template] = await Promise.all([
				readProjectFile('CONTRIBUTING.md'),
				readProjectFile('.github/pull_request_template.md'),
			]);

			// Prüft konsistent: beide erwähnen Spec oder Tests als Pflicht
			const contribMention =
				contributing.toLowerCase().includes('spec') ||
				contributing.toLowerCase().includes('spezif') ||
				contributing.toLowerCase().includes('test-first');

			const templateMention =
				template.toLowerCase().includes('spec') ||
				template.toLowerCase().includes('spezifikation') ||
				template.toLowerCase().includes('akzeptanzkriterium');

			assert.ok(
				contribMention && templateMention,
				'CONTRIBUTING.md und PR-Template müssen beide Spec-Pflicht erwähnen (Konsistenz).',
			);
		});
	});
});
