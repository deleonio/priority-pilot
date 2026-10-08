import { describe, expect, it } from 'vitest';
import de from './de/navigation.json';
import en from './en/navigation.json';

/**
 * Rote Spec-Tests für #1618 AK2 (Vertrag: `docs/spec/issue-1618.md`).
 *
 * Der Haupt-Tab „Wald" (i18n-Key `tabs.forest`) heißt in beiden App-Sprachen ein
 * „Graph"-Äquivalent. Der Schlüsselname bleibt (interner Bezeichner), nur der Wert ändert sich.
 */
describe('#1618 AK2 — navigation:tabs.forest ist ein "Graph"-Äquivalent', () => {
	const expected: Record<string, string> = {
		de: 'Graph',
		en: 'Graph',
	};
	const locales: Record<string, unknown> = { de, en };

	// "Wald" in jeder Landessprache — darf im Tab-Wert nicht mehr vorkommen.
	const forestWords = ['Wald', 'Forest'];

	for (const [locale, messages] of Object.entries(locales)) {
		it(`${locale}: tabs.forest ist "${expected[locale]}"`, () => {
			const tabs = (messages as { tabs?: { forest?: unknown } }).tabs;
			expect(tabs?.forest, `tabs.forest fehlt in locales/${locale}/navigation.json`).toBe(expected[locale]);
		});

		it(`${locale}: tabs.forest enthält kein "Wald"-Äquivalent`, () => {
			const tabs = (messages as { tabs?: { forest?: unknown } }).tabs;
			const value = String(tabs?.forest ?? '');
			for (const word of forestWords) {
				expect(value, `tabs.forest in locales/${locale} enthält "${word}"`).not.toBe(word);
			}
		});
	}
});
