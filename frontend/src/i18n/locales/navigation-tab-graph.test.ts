import { describe, expect, it } from 'vitest';
import de from './de/navigation.json';
import en from './en/navigation.json';
import es from './es/navigation.json';
import fr from './fr/navigation.json';
import itLocale from './it/navigation.json';
import nl from './nl/navigation.json';
import pl from './pl/navigation.json';
import pt from './pt/navigation.json';
import ru from './ru/navigation.json';
import sv from './sv/navigation.json';

/**
 * Rote Spec-Tests für #1618 AK2 (Vertrag: `docs/spec/issue-1618.md`).
 *
 * Der Haupt-Tab „Wald" (i18n-Key `tabs.forest`) heißt in allen zehn Sprachen ein
 * „Graph"-Äquivalent. Der Schlüsselname bleibt (interner Bezeichner), nur der Wert ändert sich.
 */
describe('#1618 AK2 — navigation:tabs.forest ist ein "Graph"-Äquivalent', () => {
	const expected: Record<string, string> = {
		de: 'Graph',
		en: 'Graph',
		es: 'Grafo',
		fr: 'Graphe',
		it: 'Grafo',
		nl: 'Grafiek',
		pl: 'Graf',
		pt: 'Grafo',
		ru: 'Граф',
		sv: 'Graf',
	};
	const locales: Record<string, unknown> = { de, en, es, fr, it: itLocale, nl, pl, pt, ru, sv };

	// "Wald" in jeder Landessprache — darf im Tab-Wert nicht mehr vorkommen.
	const forestWords = [
		'Wald',
		'Forest',
		'Bosque',
		'Foret',
		'Forêt',
		'Foresta',
		'Bos',
		'Las',
		'Floresta',
		'Лес',
		'Skog',
	];

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
