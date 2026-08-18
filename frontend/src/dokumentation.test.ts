import { describe, it } from 'vitest';

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
	it.skip('AK4: docs/testing.md §4 dokumentiert KoliBri-Regel', async () => {
		// Prüft, ob testing.md existiert und §4 die Regel enthält
		throw new Error('testing.md §4 noch nicht aktualisiert');
	});

	it.skip('AK4: Doku unterscheidet Erlaubt vs Verboten', async () => {
		// Erlaubt: Host-Locators, Rollen-/Namenens-Locators, Interaktion, Unit-_Prop-Assertions
		// Verboten: .shadowRoot, interne Klassen, Struktur-/Style-Checks im Schatten
		throw new Error('Erlaubt/Verboten-Dokumentation noch nicht vorhanden');
	});

	it.skip('AK4: Doku nennt Ausnahme (Hydration-Probe helpers.ts)', async () => {
		// Die bewusste Ausnahme muss dokumentiert sein
		throw new Error('Ausnahme-Dokumentation noch nicht vorhanden');
	});

	it.skip('AK4: Doku verweist auf Guard', async () => {
		// Verweis auf ESLint-Guard in testing.md
		throw new Error('Guard-Verweis noch nicht implementiert');
	});

	it.skip('AK4: .ai-knowledge/conventions.md enthält Link auf testing.md', async () => {
		// conventions.md muss auf die KoliBri-Regel verweisen
		throw new Error('Conventions-Link noch nicht implementiert');
	});
});
