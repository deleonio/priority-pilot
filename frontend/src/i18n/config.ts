import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

/**
 * Übersetzungen werden per Glob eingesammelt statt einzeln importiert: eine neue Sprache braucht
 * dann nur einen weiteren Ordner unter `locales/`, keine Änderung an dieser Datei. `eager: true`
 * bündelt die JSONs fest mit — bei vier kleinen Namespaces je Sprache ist das billiger als ein
 * Nachladen zur Laufzeit und erspart einen Ladezustand beim Sprachwechsel.
 *
 * Die Dateien liegen bewusst unter `src/` und nicht unter `public/`: Vite kopiert `public/`
 * unverändert ins dist-Root, ein zusätzlicher Import von dort läge doppelt im Build.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', { eager: true });

const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, module] of Object.entries(modules)) {
	// './locales/de/common.json' -> ['de', 'common']
	const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
	if (match === null) continue;
	const [, language, namespace] = match;
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
