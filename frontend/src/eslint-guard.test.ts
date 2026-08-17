import { describe, it } from 'vitest';

/**
 * Issue 824 AK2: ESLint-Guard aktiv und gescoped
 *
 * Spec: docs/spec/issue-824.md → Schritt 1: ESLint-Guard implementieren
 *
 * Dieser Test prüft, ob die ESLint-Config die KoliBri-Guard-Regeln enthält:
 * - Verbot von .shadowRoot-Zugriff in Test-Dateien
 * - Verbot interner KoliBri-Klassen
 * - Scope nur auf Test-Dateien (e2e-Wildcard-.ts, src-Wildcard-.test.-Wildcard.)
 * - Host-Locators erlaubt
 */

describe('Issue 824: KoliBri ESLint-Guard', () => {
	it('AK2: ESLint-Config enthält KoliBri-Guard für Test-Dateien', async () => {
		// Dieser Test wird erst grün nach Implementation des Guards in eslint.config.mjs
		// TODO: Implementieren und Test auf Grün bringen
		throw new Error('ESLint-Guard noch nicht implementiert');
	});

	it('AK2: Guard ist auf Test-Dateien gescoped', async () => {
		// Guard darf nur Test-Dateien betreffen, nicht Produktivcode
		throw new Error('Scope-Validierung noch nicht implementiert');
	});

	it('AK2: Guard erlaubt Host-Locators (kol-button, kol-input-range)', async () => {
		// Regex darf Host-Locators nicht verbieten
		throw new Error('Host-Locator-Whitelist noch nicht implementiert');
	});
});
