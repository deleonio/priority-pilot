import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/**
 * Übersetzungen werden per Glob eingesammelt statt einzeln importiert. Der Glob ist auf die
 * Allowlist-Sprachen beschränkt (`import.meta.glob` verlangt ein String-Literal, die Liste im
 * Muster spiegelt `LANGUAGE_ALLOWLIST` unten): nur übersetzte Sprachen landen im Bundle, die
 * übrigen Locale-Dateien bleiben für den Schlüssel-Gleichstand-Test in `locales.test.ts` bestehen.
 * `eager: true` bündelt die JSONs fest mit — bei vier kleinen Namespaces je Sprache ist das
 * billiger als ein Nachladen zur Laufzeit und erspart einen Ladezustand beim Sprachwechsel.
 *
 * Die Dateien liegen bewusst unter `src/` und nicht unter `public/`: Vite kopiert `public/`
 * unverändert ins dist-Root, ein zusätzlicher Import von dort läge doppelt im Build.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/{de,en}/*.json', {
	eager: true,
});

/**
 * Sprach-Allowlist: nur vollständig übersetzte Sprachen erscheinen in der App — Kriterium ist der
 * Schlüssel-Gleichstand gegen `de`, geprüft in `locales.test.ts`. Eine fertige Sprache kehrt durch
 * Aufnahme in diese Liste UND ins Glob-Muster oben zurück.
 */
const LANGUAGE_ALLOWLIST = ['de', 'en'];

const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, module] of Object.entries(modules)) {
	// './locales/de/common.json' -> ['de', 'common']
	const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
	if (match === null) continue;
	const [, language, namespace] = match;
	if (!LANGUAGE_ALLOWLIST.includes(language)) continue;
	resources[language] ??= {};
	resources[language][namespace] = module.default;
}

/** Sprachcodes mit vorhandenen Übersetzungen — Quelle für die Auswahl in den Einstellungen. */
export const SUPPORTED_LANGUAGES = Object.keys(resources).sort();

// Kein `await`: die Ressourcen liegen inline vor, i18next ist damit sofort nach `init` bereit —
// ein Top-Level-await würde nur das Build-Target verschärfen, ohne etwas abzusichern.
void i18next
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		supportedLngs: SUPPORTED_LANGUAGES,
		fallbackLng: 'de',
		defaultNS: 'common',
		// React maskiert selbst; i18nexts zusätzliches Escaping würde Umlaute zerlegen.
		interpolation: { escapeValue: false },
		detection: {
			order: ['localStorage', 'navigator'],
			caches: ['localStorage'],
		},
	});

export default i18next;
