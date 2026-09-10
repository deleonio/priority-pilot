import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// i18next global initialisieren: `initReactI18next` hinterlegt die Instanz als Default, damit
// Komponenten mit `useTranslation` auch ohne eigenen Provider im Test übersetzte Texte rendern.
import i18next from './src/i18n/config';

/**
 * Tests laufen fest auf Deutsch. Ohne diese Festlegung folgt der `LanguageDetector` dem
 * `navigator.language` der jsdom-Umgebung (`en-US`) — jede Text-Assertion hinge dann an der
 * Host-Umgebung statt am Code. Die Sprachwahl selbst wird in `src/i18n/locales.test.ts` und
 * gezielt in den Sprach-Tests geprüft, nicht implizit über die Umgebung.
 */
await i18next.changeLanguage('de');

/**
 * Globaler RTL-Auto-Cleanup: `@testing-library/react` registriert seinen `afterEach(cleanup)`
 * nur, wenn Vitest-Globals aktiv sind (`globals: true`) — hier ist das nicht der Fall, deshalb
 * explizit. Ohne diesen Aufruf bleibt das gerenderte DOM über alle Tests einer Datei hinweg
 * stehen und `getByRole`-Abfragen werden mehrdeutig (`Found multiple elements with the role …`).
 */
afterEach(() => {
	cleanup();
});

// Der Web-Storage-Shim steht in `vitest.storage-shim.ts` und läuft laut `vitest.config.ts` vor
// dieser Datei — er muss vor dem i18n-Import unten greifen (Begründung im Kopf der Shim-Datei).

// jsdom implementiert window.matchMedia nicht — minimaler Stub damit Theme-Code in Tests nicht crasht.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}
