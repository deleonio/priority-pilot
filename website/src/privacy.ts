import { OPERATOR } from '../../frontend/src/lib/operator.ts';

/**
 * Text der Datenschutzerklärung (#1672): nur Deutsch, feste URL `/datenschutz/`. Liegt als Modul
 * neben dem Renderer und nicht in den i18n-Dateien, weil der Key-Parity-Test den Text sonst in
 * alle zehn Sprachen duplizieren würde.
 */
export interface PrivacySection {
	heading: string;
	paragraphs: string[];
	/** Optionale Aufzählung unter den Absätzen (Empfänger-Dienste). */
	list?: string[];
	/** Pflichtangaben einer Verarbeitung (#1892), gerendert als Aufzählung. */
	facts?: { purpose: string; legalBasis: string; retention: string; recipients: string };
}

const ACCOUNT_LIFETIME = 'bis du dein Konto löschst; beim Löschen des Kontos werden die Daten sofort entfernt.';

export const PRIVACY: { intro: string; description: string; sections: PrivacySection[] } = {
	intro:
		'Balamentum kommt mit so wenig Daten wie möglich aus. Diese Erklärung zählt auf, welche Daten wir wofür verarbeiten, wer sie außerdem sieht und welche Rechte du hast.',
	description:
		'Datenschutzerklärung von Balamentum: Datensparsamkeit, keine Auswertung, Weitergabe nur an beteiligte Dienste, HTTPS-Verschlüsselung und deine Rechte.',
	sections: [
		{
			heading: 'Verantwortlicher',
			paragraphs: [
				`${[OPERATOR.name, ...OPERATOR.address].join(', ')}. Kontakt für alle Fragen zum Datenschutz: ${OPERATOR.email}.`,
			],
		},
		{
			heading: 'Datensparsamkeit',
			paragraphs: [
				'Wir erheben und speichern nur die Daten, die das Funktionsangebot braucht: den Namen und die E-Mail-Adresse deines Kontos sowie deine Aufgaben, Serien und Einstellungen. Mehr fragen wir nicht ab.',
			],
		},
		{
			heading: 'Keine Auswertung',
			paragraphs: [
				'Wir werten deine Daten nicht aus. Es gibt kein Nutzungsprofil, kein Tracking und keine Werbung; die Inhalte deiner Aufgaben dienen allein deiner eigenen Planung.',
				'Einzige Ausnahme ist eine anonyme Zählung, ob Fürsorge-Vorschläge helfen: wie oft Vorschläge angezeigt, übernommen oder abgelehnt werden (ohne Bezug zu deinem Konto) und wie viele Konten 4 und 12 Wochen nach der Registrierung noch Aufgaben erledigen, getrennt nach eingeschalteten und ausgeschalteten Fürsorge-Hinweisen. Dafür speichern wir, wann du die Fürsorge-Hinweise ein- oder ausschaltest; dieser Verlauf wird mit deinem Konto gelöscht. Ausgewertet werden nur Summen, Gruppen mit weniger als fünf Personen werden nicht ausgewiesen.',
			],
		},
		{
			heading: 'Weitergabe nur an beteiligte Dienste',
			paragraphs: [
				'Wir verkaufen deine Daten nicht und geben sie nicht zu fremden Zwecken weiter. Die in den folgenden Abschnitten genannten Empfänger erhalten nur die Angaben, die ihre jeweilige Aufgabe braucht, und nur, wenn du die zugehörige Funktion nutzt.',
			],
		},
		{
			heading: 'Verschlüsselung',
			paragraphs: [
				'Alle Verbindungen zwischen App, Website und Server laufen verschlüsselt über HTTPS. Anmelde-Links und Access-Tokens speichern wir nur als Hash, nie im Klartext.',
			],
		},
		{
			heading: 'Anmeldung (Google-Login und E-Mail-Link)',
			paragraphs: [],
			facts: {
				purpose:
					'Anmeldung und Führen deines Kontos. Du meldest dich mit deinem Google-Konto oder mit einem Anmelde-Link per E-Mail an; wir speichern Name und E-Mail-Adresse.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag über die Nutzung der App).',
				retention: `Kontodaten ${ACCOUNT_LIFETIME} Anmelde-Links gelten 15 Minuten und werden danach gelöscht.`,
				recipients:
					'Google (Google-Login), wenn du diese Anmeldeart wählst; unser E-Mail-Versanddienstleister für den Anmelde-Link.',
			},
		},
		{
			heading: 'Standort und gespeicherte Orte',
			paragraphs: [],
			facts: {
				purpose:
					'Aufgaben in deiner Nähe anzeigen, Adressen suchen und Orte als Favoriten speichern. Den Standort ermittelt dein Gerät nur, wenn du die Standortfunktion einschaltest.',
				legalBasis: 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch Einschalten der Funktion).',
				retention: `Gespeicherte Orte, Adressen an Aufgaben und deine Entfernungs-Einstellungen ${ACCOUNT_LIFETIME}`,
				recipients:
					'Photon (komoot) und Nominatim (OpenStreetMap Foundation) für Adresssuche und Umwandlung von Koordinaten in Adressen; Transitous für die Suche nach ÖPNV-Verbindungen.',
			},
		},
		{
			heading: 'Push-Nachrichten',
			paragraphs: [],
			facts: {
				purpose: 'Erinnerungen und Hinweise als Push-Nachricht auf deine Geräte schicken, wenn du das erlaubst.',
				legalBasis: 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung über die Push-Erlaubnis).',
				retention: 'Die Geräteadresse für Push-Nachrichten, bis du Push abschaltest oder dein Konto löschst.',
				recipients:
					'Der Push-Dienst deines Browsers (zum Beispiel Google, Mozilla oder Apple) und Firebase Cloud Messaging (Google) in der Android-App.',
			},
		},
		{
			heading: 'KI-Anbieter',
			paragraphs: [],
			facts: {
				purpose:
					'KI-Funktionen wie Vorschläge und Formulierungshilfen. Dafür senden wir den Text deiner Anfrage an einen KI-Anbieter und zählen den monatlichen Verbrauch.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag), nur wenn du eine KI-Funktion aufrufst.',
				retention: `Der Anbieter verarbeitet die Anfrage zur Beantwortung; bei uns bleiben nur der monatliche Verbrauchszähler und deine Anbieter-Einstellungen, ${ACCOUNT_LIFETIME}`,
				recipients: 'Mistral AI oder OpenRouter, oder der KI-Anbieter, den du selbst einträgst.',
			},
		},
		{
			heading: 'Zahlungen über PayPal',
			paragraphs: [],
			facts: {
				purpose: 'Abschluss und Abrechnung eines Abos über PayPal.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag).',
				retention:
					'Abo-Status für die Laufzeit des Abos; Zahlungsbelege nach den gesetzlichen Aufbewahrungsfristen (siehe Rechnungen).',
				recipients: 'PayPal (Europe) S.à r.l. et Cie, S.C.A.',
			},
		},
		{
			heading: 'Käufe über Google Play',
			paragraphs: [],
			facts: {
				purpose: 'Kauf und Abrechnung von Abos innerhalb der Android-App; wir prüfen den Kauf bei Google.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag).',
				retention:
					'Abo-Status für die Laufzeit des Abos; Zahlungsbelege nach den gesetzlichen Aufbewahrungsfristen (siehe Rechnungen).',
				recipients: 'Google (Google Play).',
			},
		},
		{
			heading: 'Rechnungen',
			paragraphs: [],
			facts: {
				purpose: 'Rechnungen über bezahlte Abos erstellen und per E-Mail zusenden.',
				legalBasis: 'Art. 6 Abs. 1 lit. c DSGVO (steuerrechtliche Pflichten).',
				retention:
					'10 Jahre nach § 147 AO und § 14b UStG, auch über das Löschen des Kontos hinaus; ein laufendes Abo verhindert das Löschen des Kontos.',
				recipients: 'Unser E-Mail-Versanddienstleister; bei Prüfungen gegebenenfalls Steuerberater und Finanzbehörden.',
			},
		},
		{
			heading: 'Feedback',
			paragraphs: [],
			facts: {
				purpose: 'Rückmeldungen, die du in der App abschickst, lesen und die App verbessern.',
				legalBasis: 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Verbesserung der App).',
				retention: `In der App gespeicherte Rückmeldungen ${ACCOUNT_LIFETIME}`,
				recipients: 'GitHub, wo wir die Rückmeldungen zur Bearbeitung ablegen.',
			},
		},
		{
			heading: 'MCP-Zugriff mit Access-Tokens',
			paragraphs: [],
			facts: {
				purpose:
					'Zugriff auf deine Aufgaben aus eigenen Werkzeugen (zum Beispiel KI-Assistenten über MCP) mit einem Access-Token, das du selbst anlegst.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag), nur wenn du ein Access-Token anlegst.',
				retention: 'Das Token speichern wir nur als Hash, bis du es widerrufst oder dein Konto löschst.',
				recipients:
					'Keine durch uns. Das Werkzeug, dem du das Token gibst, erhält die abgefragten Daten in deinem Auftrag.',
			},
		},
		{
			heading: 'Android-App',
			paragraphs: [],
			facts: {
				purpose:
					'Die Android-App zeigt dieselbe Web-App wie der Browser an; zusätzlich nutzt sie Push-Nachrichten und Käufe über Google Play.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag).',
				retention: 'Es gelten die Fristen der einzelnen Funktionen oben.',
				recipients: 'Google (Google Play, Firebase Cloud Messaging).',
			},
		},
		{
			heading: 'Deine Rechte',
			paragraphs: [
				'Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Eine Einwilligung kannst du jederzeit widerrufen, zum Beispiel indem du die Funktion abschaltest. Dein Konto kannst du in den Einstellungen selbst löschen.',
				`Schreib uns dafür an ${OPERATOR.email}.`,
				'Außerdem hast du das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO). Zuständig für uns ist der Thüringer Landesbeauftragte für den Datenschutz und die Informationsfreiheit, Häßlerstraße 8, 99096 Erfurt.',
			],
		},
	],
};
