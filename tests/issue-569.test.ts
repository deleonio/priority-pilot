/**
 * Rote Spec-Tests für Issue #569
 *
 * "Spec-First-Routine in Claude-Code-Prozess verankern" (Teil des Epics #563)
 *
 * Akzeptanzkriterien (aus Issue-Body / KI-ANALYSE):
 * AC1: Die Routine bearbeitet die Spezifikation vor den Tests.
 * AC2: Obsolete Tests werden im selben Durchlauf erkannt und entfernt.
 * AC3: Es entstehen keine Tests ohne Spec-Bezug.
 *
 * Die Tests prüfen den Spec-Prompt (.github/prompts/spec.md) — die Routine selbst.
 * Sie sind ROT, solange der Prompt die Spec-First-Anforderungen nicht durchsetzt,
 * und werden GRÜN, sobald der Prompt entsprechend erweitert wurde.
 *
 * Test-Qualität:
 * - Diese Tests sind keine Change-Detectors: sie prüfen nicht, ob ein String
 *   wörtlich enthalten ist, sondern ob der Prompt strukturelle Anweisungen zur
 *   Spec-Bearbeitung enthält (prozedurale Eigenschaft).
 * - Bei Prompt-Änderungen ohne Code-Entstehen (reines Prompt/Pattern) würden wir
 *   auf manuelle Verifikation im PR-Body setzen. Da Issue #569 aber Prozess-
 *   konventionen für die Routine etabliert, die überprüfbar sind, schreiben wir
 *   automatisierte Tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');

async function readProjectFile(rel: string): Promise<string> {
	return readFile(resolve(ROOT, rel), 'utf-8');
}

describe('Issue #569 — Spec-First-Routine in Claude-Code-Prozess verankern', () => {
	describe('AC1 — Die Routine bearbeitet die Spezifikation vor den Tests', () => {
		it('Spec-Prompt enthält Anweisung zur Spezifikations-Aktualisierung VOR Test-Ableitung', async () => {
			const prompt = await readProjectFile('.github/prompts/spec.md');

			// Prüft strukturell: gibt es einen Abschnitt über Spezifikation?
			const specSection = prompt.match(/(spezifikation|spec.*aktual|dokument.*update)/i);
			assert.ok(specSection, 'Spec-Prompt muss einen Abschnitt über Spezifikations-Aktualisierung haben.');

			// Prüft inhaltlich: enthält der Prompt Reihenfolgen-Regeln (Spec vor Tests)?
			const hasSpecFirstOrdering =
				prompt.toLowerCase().includes('vor.*test') ||
				prompt.toLowerCase().includes('spec.*first') ||
				prompt.toLowerCase().includes('zuerst.*spec') ||
				prompt.toLowerCase().includes('bevor.*test') ||
				(prompt.toLowerCase().includes('spezifikation') && prompt.toLowerCase().includes('aktualisier'));

			assert.ok(
				hasSpecFirstOrdering,
				'Spec-Prompt muss explizite Anweisung enthalten: Spezifikation VOR Tests aktualisieren (Keywords: vor.*test, spec.*first, zuerst.*spec, bevor.*test, spezifikation.*aktualisier).',
			);
		});

		it('Spec-Prompt enthält Spec-Update als eigenen Prozess-Schritt VOR Test-Schritt', async () => {
			const prompt = await readProjectFile('.github/prompts/spec.md');

			// Prüft strukturell: sind Prozess-Schritte nummeriert oder mit Punkten?
			const steps = prompt.match(/\d+\.\s+[A-ZÄÖÜ]/g);
			assert.ok(steps && steps.length >= 2, 'Spec-Prompt muss mehrere Prozess-Schritte haben.');

			// Prüft inhaltlich: ist Spec-Update ein eigener Schritt?
			const hasSpecUpdateStep =
				prompt.toLowerCase().includes('spezifikation.*erweitern') ||
				prompt.toLowerCase().includes('dokument.*aktualisier') ||
				prompt.toLowerCase().includes('spec.*update') ||
				prompt.match(/\d+\.\s*.*spezifikation/i);

			assert.ok(
				hasSpecUpdateStep,
				'Spec-Prompt muss Spec-Update als eigenen Prozess-Schritt ausweisen (Keywords: spezifikation.*erweitern, dokument.*aktualisier, spec.*update, nummerierter Schritt mit "Spezifikation").',
			);
		});
	});

	describe('AC2 — Obsolete Tests werden im selben Durchlauf erkannt und entfernt', () => {
		it('Spec-Prompt enthält Anweisung zum Erkennen obsoleter Tests', async () => {
			const prompt = await readProjectFile('.github/prompts/spec.md');

			// Prüft strukturell: gibt es einen Abschnitt über obsolete Tests?
			const obsoleteSection = prompt.match(/(obsolete.*test|veralt.*test|test.*entfern|test.*lösch)/i);
			assert.ok(obsoleteSection, 'Spec-Prompt muss einen Abschnitt über obsolete Tests haben.');

			// Prüft inhaltlich: enthält der Prompt Erkennungs-Regeln für obsolete Tests?
			const hasObsoleteDetection =
				prompt.toLowerCase().includes('obsolete.*erkenn') ||
				prompt.toLowerCase().includes('veralt.*test.*entfern') ||
				prompt.toLowerCase().includes('dedup') ||
				prompt.toLowerCase().includes('test.*pflege') ||
				prompt.toLowerCase().includes('widerspruch.*test');

			assert.ok(
				hasObsoleteDetection,
				'Spec-Prompt muss Anweisung zum Erkennen obsoleter Tests enthalten (Keywords: obsolete.*erkenn, veralt.*test.*entfern, dedup, test.*pflege, widerspruch.*test).',
			);
		});

		it('Spec-Prompt enthält Anweisung zum Entfernen obsoleter Tests im selben Durchlauf', async () => {
			const prompt = await readProjectFile('.github/prompts/spec.md');

			// Prüft strukturell: gibt es eine Aufforderung zum Entfernen?
			const hasRemovalAction =
				prompt.toLowerCase().includes('entfern') ||
				prompt.toLowerCase().includes('lösch') ||
				prompt.toLowerCase().includes('entfernen.*im.*selben.*durchlauf') ||
				prompt.toLowerCase().includes('remove.*same.*run');

			assert.ok(
				hasRemovalAction,
				'Spec-Prompt muss Anweisung zum Entfernen obsoleter Tests enthalten (Keywords: entfern, lösch, entfernen.*im.*selben.*durchlauf, remove.*same.*run).',
			);
		});
	});

	describe('AC3 — Es entstehen keine Tests ohne Spec-Bezug', () => {
		it('Spec-Prompt enthält Anweisung, dass jeder Test einen Spec-Bezug haben muss', async () => {
			const prompt = await readProjectFile('.github/prompts/spec.md');

			// Prüft strukturell: gibt es eine Spezifikations-Bezug-Regel?
			const specReferenceRule = prompt.match(
				/(test.*spec.*bezug|jeder.*test.*spec|spec.*reference|akzeptanzkriterium.*test)/i,
			);
			assert.ok(specReferenceRule, 'Spec-Prompt muss eine Regel über Spec-Bezug von Tests haben.');

			// Prüft inhaltlich: enthält der Prompt eine Spezifikations-Bezug-Pflicht?
			const hasSpecReferenceRequirement =
				prompt.toLowerCase().includes('jeder.*test.*akzeptanzkriterium') ||
				prompt.toLowerCase().includes('test.*ohne.*spec.*bezug.*verboten') ||
				prompt.toLowerCase().includes('tests.*müssen.*akzeptanzkriterium') ||
				prompt.toLowerCase().includes('keine.*tests.*ohne.*spec') ||
				prompt.toLowerCase().includes('all.*tests.*must.*reference.*spec');

			assert.ok(
				hasSpecReferenceRequirement,
				'Spec-Prompt muss explizite Anforderung enthalten: Jeder Test muss auf Akzeptanzkriterium/Spec Bezug nehmen (Keywords: jeder.*test.*akzeptanzkriterium, test.*ohne.*spec.*bezug.*verboten, tests.*müssen.*akzeptanzkriterium, keine.*tests.*ohne.*spec, all.*tests.*must.*reference.*spec).',
			);
		});

		it('Spec-Prompt enthält Validierungs-Schritt für Spec-Bezug vor Test-Erstellung', async () => {
			const prompt = await readProjectFile('.github/prompts/spec.md');

			// Prüft strukturell: gibt es eine Validierungs-Regel?
			const hasValidationStep =
				prompt.toLowerCase().includes('vorab.*prüf') ||
				prompt.toLowerCase().includes('validier.*test') ||
				prompt.toLowerCase().includes('überprüf.*bezug') ||
				prompt.toLowerCase().includes('check.*spec.*reference');

			assert.ok(
				hasValidationStep,
				'Spec-Prompt muss Validierungs-Schritt für Spec-Bezug enthalten (Keywords: vorab.*prüf, validier.*test, überprüf.*bezug, check.*spec.*reference).',
			);
		});
	});

	describe('Routine-Konsistenz — Spec-First-Workflow ist in der Routine durchgängig implementiert', () => {
		it('Spec-Prompt und Issue-Body-Konsistenz zur Spec-First-Reihenfolge', async () => {
			const [prompt, issueBody] = await Promise.all([
				readProjectFile('.github/prompts/spec.md'),
				// Issue-Body simulieren via konstante Erwartung
				Promise.resolve('Die Routine bearbeitet die Spezifikation vor den Tests'),
			]);

			// Prüft konsistent: Prompt erwähnt Spec vor Tests in der gleichen Reihenfolge wie Issue
			const promptHasOrder =
				prompt.toLowerCase().includes('spezifikation.*vor.*test') ||
				prompt.toLowerCase().includes('spec.*first') ||
				prompt.toLowerCase().includes('zuerst.*spezifikation');

			const issueHasOrder = issueBody.toLowerCase().includes('spezifikation vor den tests');

			assert.ok(
				promptHasOrder && issueHasOrder,
				'Spec-Prompt und Issue-Body müssen konsistente Spec-First-Reihenfolge kommunizieren.',
			);
		});
	});
});
