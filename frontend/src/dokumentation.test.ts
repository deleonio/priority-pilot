import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Issue 824 AK4: Doku vorhanden
 *
 * Spec: docs/spec/issue-824.md → Schritt 3: Doku aktualisieren
 *
 * Dieser Test prüft, ob die Dokumentation die KoliBri-Test-Regel enthält:
 * - docs/testing.md §4: Erlaubt/Verboten/Ausnahme/Verweis auf Guard
 * - .ai-knowledge/conventions.md: Link auf testing.md
 */

describe('Issue 824: KoliBri Doku', () => {
	it('AK4: docs/testing.md §4 dokumentiert KoliBri-Regel', async () => {
		// Prüft, ob testing.md existiert und §4 die Regel enthält
		assert.fail('testing.md §4 noch nicht aktualisiert');
	});

	it('AK4: Doku unterscheidet Erlaubt vs Verboten', async () => {
		// Erlaubt: Host-Locators, Rollen-/Namenens-Locators, Interaktion, Unit-_Prop-Assertions
		// Verboten: .shadowRoot, interne Klassen, Struktur-/Style-Checks im Schatten
		assert.fail('Erlaubt/Verboten-Dokumentation noch nicht vorhanden');
	});

	it('AK4: Doku nennt Ausnahme (Hydration-Probe helpers.ts)', async () => {
		// Die bewusste Ausnahme muss dokumentiert sein
		assert.fail('Ausnahme-Dokumentation noch nicht vorhanden');
	});

	it('AK4: Doku verweist auf Guard', async () => {
		// Verweis auf ESLint-Guard in testing.md
		assert.fail('Guard-Verweis noch nicht implementiert');
	});

	it('AK4: .ai-knowledge/conventions.md enthält Link auf testing.md', async () => {
		// conventions.md muss auf die KoliBri-Regel verweisen
		assert.fail('Conventions-Link noch nicht implementiert');
	});
});
