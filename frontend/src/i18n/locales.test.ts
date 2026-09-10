import { describe, expect, it } from 'vitest';

/**
 * Schlüssel-Gleichstand über alle Sprachen (#1339).
 *
 * Eine fehlende Übersetzung ist ein stiller Ausfall: i18next fällt wortlos auf `fallbackLng` zurück,
 * die Oberfläche zeigt dann mitten im spanischen Text einen deutschen Satz. Auffallen würde das
 * erst dem Nutzer. Dieser Test zieht die Lücke beim Hinzufügen eines neuen Schlüssels sofort ans
 * Licht — deshalb gibt es ihn, und deshalb genau diesen einen.
 */

const modules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', { eager: true });

/** Referenzsprache: `de` ist die Quelle, aus der die übrigen Sprachen abgeleitet sind. */
const REFERENCE_LANGUAGE = 'de';

/** Alle Blattpfade eines Übersetzungsobjekts, z. B. `menu.settings`. */
const leafKeys = (value: unknown, prefix = ''): string[] => {
	if (typeof value !== 'object' || value === null) return [prefix];
	return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix === '' ? key : `${prefix}.${key}`));
};

/** `{ de: { common: [...keys], … }, … }` */
const keysByLanguage: Record<string, Record<string, string[]>> = {};
for (const [path, module] of Object.entries(modules)) {
	const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
	if (match === null) continue;
	const [, language, namespace] = match;
	keysByLanguage[language] ??= {};
	keysByLanguage[language][namespace] = leafKeys(module.default).sort();
}

const reference = keysByLanguage[REFERENCE_LANGUAGE];
const otherLanguages = Object.keys(keysByLanguage)
	.filter((language) => language !== REFERENCE_LANGUAGE)
	.sort();

describe('Übersetzungsdateien', () => {
	it('findet Sprachen und eine Referenzsprache', () => {
		expect(reference).toBeDefined();
		expect(otherLanguages.length).toBeGreaterThan(0);
	});

	it.each(otherLanguages)('%s hat dieselben Namespaces wie die Referenzsprache', (language) => {
		expect(Object.keys(keysByLanguage[language]).sort()).toEqual(Object.keys(reference).sort());
	});

	it.each(otherLanguages)('%s hat dieselben Schlüssel wie die Referenzsprache', (language) => {
		for (const namespace of Object.keys(reference)) {
			expect(keysByLanguage[language][namespace], `${language}/${namespace}.json`).toEqual(reference[namespace]);
		}
	});
});
