/**
 * Pflichtangaben des Diensteanbieters (§ 5 DDG). Einzige Quelle für das Impressum der App
 * (`components/Impress.tsx`) und der öffentlichen Website (`website/`, ADR 0015).
 */
// Bewusst das `i18next`-Paket statt `../i18n/config` (Muster `journalDate.ts`): `website/` baut
// diese Datei per tsx mit, der Vite-only `import.meta.glob` dort würde den Build brechen. Der
// Default-Export des Pakets ist dieselbe Singleton-Instanz, die `i18n/config.ts` initialisiert.
import i18next from 'i18next';

export const OPERATOR = {
	/** Vollständiger Name des Diensteanbieters (natürliche Person oder Firma). */
	name: 'Martin Oppitz Development',
	/** Ladungsfähige Anschrift (Zeilen). */
	address: ['Am Silberblick 32', '98716 Elgersburg'],
	/** Erreichbarkeit: mindestens eine gültige E-Mail-Adresse. */
	email: 'balamentum@modevel.de',
	/** Bei Einzelunternehmen: Inhaber; bei Gesellschaft: gesetzliche Vertretung. */
	representative: 'Martin Oppitz (Inhaber)',
	/** Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG — nur bei Vorhandensein. */
	ustId: '',
	/** Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV — nur bei redaktionell gestalteten Inhalten nötig. */
	contentResponsible: '',
};

/** Rechtsseiten der öffentlichen Website (#1891, #1892) je Sprache — einzige Textquelle, same-origin geladen (#2227). */
const LEGAL_LINKS = {
	de: { terms: '/nutzungsbedingungen/', privacy: '/datenschutz/', withdrawal: '/widerruf/' },
	en: { terms: '/en/terms/', privacy: '/en/privacy/', withdrawal: '/en/withdrawal/' },
} as const;

export type LegalKey = keyof typeof LEGAL_LINKS.de;

/** Sprache der Rechtsseiten: Englisch hat eigene Seiten, sonst gilt die deutsche Fassung. */
// Bewusst NICHT exportiert (#2775): einzige Verbraucher sind legalPath/currentLegalLanguage hier;
// website/ importiert nur OPERATOR, knip würde den toten Export bemängeln.
const legalLanguage = (language: string): keyof typeof LEGAL_LINKS => (language === 'en' ? 'en' : 'de');

/** Rechtssprache der aktuellen App-Sprache: liest die globale i18next-Instanz (resolvedLanguage ?? language). */
export const currentLegalLanguage = (): keyof typeof LEGAL_LINKS =>
	legalLanguage(i18next.resolvedLanguage ?? i18next.language);

/** Pfad der Rechtsseite in der Sprache `language`. */
export const legalPath = (key: LegalKey, language: string): string => LEGAL_LINKS[legalLanguage(language)][key];
