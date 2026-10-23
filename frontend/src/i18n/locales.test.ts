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

// #2225 AK5: Der Satz im Import-Schritt ohne KI-Paket existiert in jeder Sprache und ist nicht leer
// (der Gleichstand-Test oben prüft nur Schlüsselnamen, nicht den Wert).
describe('onboarding.importAiHint (#2225)', () => {
	it.each([REFERENCE_LANGUAGE, ...otherLanguages])('%s hat einen nicht-leeren Text', (language) => {
		const common = modules[`./locales/${language}/common.json`].default as { onboarding?: { importAiHint?: unknown } };
		const value = common.onboarding?.importAiHint;
		expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
	});
});

// #2361 AK4: Die neue Aufgaben-Aktion „Als Vorlage speichern" braucht einen eigenen Label-Schlüssel
// (Klartext-`_label` des Icon-Buttons = aria-label + Tooltip). Der Gleichstand-Test oben zieht nur
// dann, wenn der Schlüssel existiert — ein komplett fehlender Schlüssel fiele durchs Netz und würde
// live den Fallback-Text zeigen. Deshalb hier wie bei #2225 die Existenz je Sprache.
describe('common:actions.saveAsTemplate (#2361)', () => {
	it.each([REFERENCE_LANGUAGE, ...otherLanguages])('%s hat einen nicht-leeren Text', (language) => {
		const common = modules[`./locales/${language}/common.json`].default as { actions?: { saveAsTemplate?: unknown } };
		const value = common.actions?.saveAsTemplate;
		expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
	});
});

// #2635: Frage-Antwort-Einheit im MissedCompleteDialog — die Frage nennt die Entscheidung
// (Wann?), beide Knöpfe sind vollständige Antworten ohne Ja/Nein-Partikel, und der neue
// Folge-Halbsatz nennt die Punkte-/Streak-Folge (pünktlich = volle Punkte, jetzt = halbe,
// der Fälligkeitstag zählt trotzdem für den Streak). Vertrag: docs/spec/issue-2635.md.
describe('tasks:missedComplete (#2635)', () => {
	it.each([REFERENCE_LANGUAGE, ...otherLanguages])(
		'%s bildet eine Frage-Antwort-Einheit mit Folge-Halbsatz',
		(language) => {
			const tasks = modules[`./locales/${language}/tasks.json`].default as {
				missedComplete?: { question?: string; onTime?: string; now?: string; consequence?: string };
			};
			const block = tasks.missedComplete;
			const question = (block?.question ?? '').replace(/<[^>]+>/g, '');
			expect(question).toMatch(language === 'de' ? /^Wann\b/ : /^When\b/);
			expect(question.trimEnd()).toMatch(/\?$/);
			expect(block?.onTime ?? '').not.toMatch(/^(ja|nein|yes|no)\b/i);
			expect(block?.now ?? '').not.toMatch(/^(ja|nein|yes|no)\b/i);
			expect(block?.onTime ?? '').toMatch(language === 'de' ? /^pünktlich/i : /^on time/i);
			expect(block?.now ?? '').toMatch(language === 'de' ? /^erst jetzt/i : /^just now/i);
			const consequence = block?.consequence ?? '';
			expect(consequence).toMatch(language === 'de' ? /punkt/i : /point/i);
			expect(consequence).toMatch(language === 'de' ? /halb/i : /half/i);
			expect(consequence).toMatch(/streak/i);
		},
	);
});
