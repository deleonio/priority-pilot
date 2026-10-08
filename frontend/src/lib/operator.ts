/**
 * Pflichtangaben des Diensteanbieters (§ 5 DDG). Einzige Quelle für das Impressum der App
 * (`components/Impress.tsx`) und der öffentlichen Website (`website/`, ADR 0015).
 */
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
	de: { terms: '/nutzungsbedingungen/', privacy: '/datenschutz/' },
	en: { terms: '/en/terms/', privacy: '/en/privacy/' },
} as const;

export type LegalKey = keyof typeof LEGAL_LINKS.de;

/** Sprache der Rechtsseiten: Englisch hat eigene Seiten, sonst gilt die deutsche Fassung. */
export const legalLanguage = (language: string): keyof typeof LEGAL_LINKS => (language === 'en' ? 'en' : 'de');

/** Pfad der Rechtsseite in der Sprache `language`. */
export const legalPath = (key: LegalKey, language: string): string => LEGAL_LINKS[legalLanguage(language)][key];
