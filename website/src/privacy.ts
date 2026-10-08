import { OPERATOR } from '../../frontend/src/lib/operator.ts';

/**
 * Text der Datenschutzerklärung (#1672): Deutsch unter der festen URL `/datenschutz/` (verbindlich),
 * Englisch unter `/en/privacy/` als Übersetzung. Liegt als Modul neben dem Renderer und nicht in den
 * i18n-Dateien, weil der Key-Parity-Test den Text sonst in alle zehn Sprachen duplizieren würde.
 */
export interface PrivacySection {
	heading: string;
	paragraphs: string[];
	/** Pflichtangaben einer Verarbeitung (#1892), gerendert als Aufzählung. */
	facts?: { purpose: string; legalBasis: string; retention: string; recipients: string };
}

export interface PrivacyText {
	title: string;
	intro: string;
	description: string;
	/** Beschriftung der Pflichtangaben in `facts`. */
	factLabels: { purpose: string; legalBasis: string; retention: string; recipients: string };
	sections: PrivacySection[];
}

const ACCOUNT_LIFETIME = 'bis du dein Konto löschst; beim Löschen des Kontos werden die Daten sofort entfernt.';
const ACCOUNT_LIFETIME_EN =
	'until you delete your account; when the account is deleted, the data is removed immediately.';

const DE: PrivacyText = {
	title: 'Datenschutz',
	factLabels: { purpose: 'Zweck', legalBasis: 'Rechtsgrundlage', retention: 'Speicherdauer', recipients: 'Empfänger' },
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
				retention: `Kontodaten ${ACCOUNT_LIFETIME} Anmelde-Links gelten 15 Minuten und werden kurz nach Ablauf gelöscht.`,
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
					'Photon (komoot) und Nominatim (OpenStreetMap Foundation) für Adresssuche und Umwandlung von Koordinaten in Adressen.',
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
					'Abo-Datensätze und Zahlungsbelege für die gesetzliche Aufbewahrungsfrist, auch über das Löschen des Kontos hinaus (siehe Rechnungen).',
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
					'Abo-Datensätze und Zahlungsbelege für die gesetzliche Aufbewahrungsfrist, auch über das Löschen des Kontos hinaus (siehe Rechnungen).',
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
					'Für die gesetzliche Aufbewahrungsfrist (derzeit 8 Jahre, § 147 Abs. 3 AO, § 14b Abs. 1 UStG), auch über das Löschen des Kontos hinaus; ein laufendes Abo verhindert das Löschen des Kontos.',
				recipients: 'Unser E-Mail-Versanddienstleister; bei Prüfungen gegebenenfalls Steuerberater und Finanzbehörden.',
			},
		},
		{
			heading: 'Feedback',
			paragraphs: [],
			facts: {
				purpose:
					'Rückmeldungen, die du in der App abschickst, lesen und die App verbessern. Mit der Rückmeldung speichern wir deine E-Mail-Adresse, damit wir nachfragen können.',
				legalBasis: 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Verbesserung der App).',
				retention:
					'Rückmeldungen liegen mit deiner E-Mail-Adresse in unserem GitHub-Repository, bis wir sie bearbeitet haben; beim Löschen deines Kontos entfernen wir sie dort. Auf Anfrage löschen wir sie auch früher.',
				recipients: 'GitHub, wo wir die Rückmeldungen samt E-Mail-Adresse zur Bearbeitung ablegen.',
			},
		},
		{
			heading: 'Gruppen und Einladungen',
			paragraphs: [],
			facts: {
				purpose:
					'Aufgaben mit anderen in einer Gruppe teilen. Wir speichern, wer zu welcher Gruppe gehört, wer wen eingeladen hat und die Einladungslinks.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag), nur wenn du eine Gruppe nutzt.',
				retention: `Mitgliedschaften und Einladungen, bis du die Gruppe verlässt, die Einladung erledigt ist oder du dein Konto löschst; beim Löschen des Kontos werden sie sofort entfernt.`,
				recipients: 'Die anderen Mitglieder der Gruppe sehen die geteilten Aufgaben und deinen Namen.',
			},
		},
		{
			heading: 'E-Mail-Benachrichtigungen',
			paragraphs: [],
			facts: {
				purpose:
					'Erinnerungen an fällige Aufgaben sowie Hinweise zu erledigten Aufgaben und neu angelegten Serienterminen per E-Mail an die Adresse deines Kontos.',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag).',
				retention: `Ein Versandprotokoll gegen doppelte Nachrichten, ${ACCOUNT_LIFETIME}`,
				recipients: 'Unser E-Mail-Versanddienstleister.',
			},
		},
		{
			heading: 'Betrieb, Hosting und Sitzungs-Cookie',
			paragraphs: [],
			facts: {
				purpose:
					'Die App und die Website bereitstellen. Nach der Anmeldung setzt der Server ein Sitzungs-Cookie, dazu ein Cookie, das nur den angemeldeten Zustand anzeigt; beide sind technisch notwendig (§ 25 Abs. 2 TDDDG).',
				legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und lit. f (berechtigtes Interesse am sicheren Betrieb).',
				retention: 'Die Cookies bis zum Abmelden oder bis zum Ablauf der Sitzung.',
				recipients:
					'Unser Hosting-Anbieter Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland, der den Server in unserem Auftrag in Deutschland betreibt (Art. 28 DSGVO).',
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

const EN: PrivacyText = {
	title: 'Privacy policy',
	factLabels: {
		purpose: 'Purpose',
		legalBasis: 'Legal basis',
		retention: 'Retention period',
		recipients: 'Recipients',
	},
	intro:
		'Balamentum gets by with as little data as possible. This policy lists which data we process for what purpose, who else sees it and which rights you have.',
	description:
		'Privacy policy of Balamentum: data minimisation, no analysis, sharing only with the services involved, HTTPS encryption and your rights.',
	sections: [
		{
			heading: 'Controller',
			paragraphs: [
				`${[OPERATOR.name, ...OPERATOR.address].join(', ')}. Contact for all privacy questions: ${OPERATOR.email}.`,
			],
		},
		{
			heading: 'Data minimisation',
			paragraphs: [
				'We only collect and store the data the service needs: the name and email address of your account as well as your tasks, series and settings. We do not ask for anything else.',
			],
		},
		{
			heading: 'No analysis',
			paragraphs: [
				'We do not analyse your data. There is no usage profile, no tracking and no advertising; the content of your tasks serves your own planning alone.',
				'The only exception is an anonymous count of whether care suggestions help: how often suggestions are shown, accepted or declined (without reference to your account) and how many accounts are still completing tasks 4 and 12 weeks after sign-up, split by care hints switched on and off. For this we store when you switch the care hints on or off; this history is deleted with your account. Only totals are evaluated; groups of fewer than five people are not reported.',
			],
		},
		{
			heading: 'Sharing only with the services involved',
			paragraphs: [
				'We do not sell your data and do not pass it on for other purposes. The recipients named in the following sections only receive the information their respective task requires, and only if you use the corresponding feature.',
			],
		},
		{
			heading: 'Encryption',
			paragraphs: [
				'All connections between app, website and server are encrypted via HTTPS. We store sign-in links and access tokens only as a hash, never in plain text.',
			],
		},
		{
			heading: 'Sign-in (Google login and email link)',
			paragraphs: [],
			facts: {
				purpose:
					'Signing in and maintaining your account. You sign in with your Google account or with a sign-in link sent by email; we store your name and email address.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract for the use of the app).',
				retention: `Account data ${ACCOUNT_LIFETIME_EN} Sign-in links are valid for 15 minutes and are deleted shortly after they expire.`,
				recipients:
					'Google (Google login), if you choose this sign-in method; our email delivery provider for the sign-in link.',
			},
		},
		{
			heading: 'Location and saved places',
			paragraphs: [],
			facts: {
				purpose:
					'Showing tasks near you, searching addresses and saving places as favourites. Your device only determines your location if you switch on the location feature.',
				legalBasis: 'Art. 6(1)(a) GDPR (consent by switching on the feature).',
				retention: `Saved places, addresses on tasks and your distance settings ${ACCOUNT_LIFETIME_EN}`,
				recipients:
					'Photon (komoot) and Nominatim (OpenStreetMap Foundation) for address search and converting coordinates into addresses.',
			},
		},
		{
			heading: 'Push notifications',
			paragraphs: [],
			facts: {
				purpose: 'Sending reminders and hints as push notifications to your devices, if you allow it.',
				legalBasis: 'Art. 6(1)(a) GDPR (consent via the push permission).',
				retention: 'The device address for push notifications, until you switch off push or delete your account.',
				recipients:
					'The push service of your browser (for example Google, Mozilla or Apple) and Firebase Cloud Messaging (Google) in the Android app.',
			},
		},
		{
			heading: 'AI providers',
			paragraphs: [],
			facts: {
				purpose:
					'AI features such as suggestions and writing help. For this we send the text of your request to an AI provider and count the monthly usage.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract), only when you use an AI feature.',
				retention: `The provider processes the request to answer it; we only keep the monthly usage counter and your provider settings, ${ACCOUNT_LIFETIME_EN}`,
				recipients: 'Mistral AI or OpenRouter, or the AI provider you enter yourself.',
			},
		},
		{
			heading: 'Payments via PayPal',
			paragraphs: [],
			facts: {
				purpose: 'Taking out and billing a subscription via PayPal.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract).',
				retention:
					'Subscription records and payment receipts for the statutory retention period, even beyond the deletion of the account (see Invoices).',
				recipients: 'PayPal (Europe) S.à r.l. et Cie, S.C.A.',
			},
		},
		{
			heading: 'Purchases via Google Play',
			paragraphs: [],
			facts: {
				purpose: 'Buying and billing subscriptions within the Android app; we verify the purchase with Google.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract).',
				retention:
					'Subscription records and payment receipts for the statutory retention period, even beyond the deletion of the account (see Invoices).',
				recipients: 'Google (Google Play).',
			},
		},
		{
			heading: 'Invoices',
			paragraphs: [],
			facts: {
				purpose: 'Creating invoices for paid subscriptions and sending them by email.',
				legalBasis: 'Art. 6(1)(c) GDPR (obligations under tax law).',
				retention:
					'For the statutory retention period (currently 8 years, Section 147(3) of the German Fiscal Code (AO), Section 14b(1) of the German VAT Act (UStG)), even beyond the deletion of the account; an active subscription prevents the account from being deleted.',
				recipients:
					'Our email delivery provider; in the event of audits, tax advisers and tax authorities where applicable.',
			},
		},
		{
			heading: 'Feedback',
			paragraphs: [],
			facts: {
				purpose:
					'Reading feedback you send in the app and improving the app. Together with the feedback we store your email address so that we can follow up.',
				legalBasis: 'Art. 6(1)(f) GDPR (legitimate interest in improving the app).',
				retention:
					'Feedback is kept with your email address in our GitHub repository until we have dealt with it; when you delete your account, we remove it there. On request we also delete it earlier.',
				recipients: 'GitHub, where we store the feedback including the email address for processing.',
			},
		},
		{
			heading: 'Groups and invitations',
			paragraphs: [],
			facts: {
				purpose:
					'Sharing tasks with others in a group. We store who belongs to which group, who invited whom and the invitation links.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract), only if you use a group.',
				retention:
					'Memberships and invitations, until you leave the group, the invitation is settled or you delete your account; when the account is deleted, they are removed immediately.',
				recipients: 'The other members of the group see the shared tasks and your name.',
			},
		},
		{
			heading: 'Email notifications',
			paragraphs: [],
			facts: {
				purpose:
					'Reminders of due tasks as well as notes on completed tasks and newly created series dates by email to the address of your account.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract).',
				retention: `A delivery log against duplicate messages, ${ACCOUNT_LIFETIME_EN}`,
				recipients: 'Our email delivery provider.',
			},
		},
		{
			heading: 'Operation, hosting and session cookie',
			paragraphs: [],
			facts: {
				purpose:
					'Providing the app and the website. After sign-in, the server sets a session cookie plus a cookie that only indicates the signed-in state; both are technically necessary (Section 25(2) of the German TDDDG).',
				legalBasis: 'Art. 6(1)(b) GDPR (contract) and (f) (legitimate interest in secure operation).',
				retention: 'The cookies until you sign out or until the session expires.',
				recipients:
					'Our hosting provider Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany, which operates the server on our behalf in Germany (Art. 28 GDPR).',
			},
		},
		{
			heading: 'MCP access with access tokens',
			paragraphs: [],
			facts: {
				purpose:
					'Access to your tasks from your own tools (for example AI assistants via MCP) with an access token you create yourself.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract), only if you create an access token.',
				retention: 'We store the token only as a hash, until you revoke it or delete your account.',
				recipients: 'None on our part. The tool you give the token to receives the requested data on your behalf.',
			},
		},
		{
			heading: 'Android app',
			paragraphs: [],
			facts: {
				purpose:
					'The Android app shows the same web app as the browser; in addition it uses push notifications and purchases via Google Play.',
				legalBasis: 'Art. 6(1)(b) GDPR (contract).',
				retention: 'The periods of the individual features above apply.',
				recipients: 'Google (Google Play, Firebase Cloud Messaging).',
			},
		},
		{
			heading: 'Your rights',
			paragraphs: [
				'You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and objection (Art. 21). You can withdraw consent at any time, for example by switching off the feature. You can delete your account yourself in the settings.',
				`To do so, write to us at ${OPERATOR.email}.`,
				'You also have the right to lodge a complaint with a supervisory authority (Art. 77 GDPR). The authority responsible for us is the Thuringian State Commissioner for Data Protection and Freedom of Information (Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit), Häßlerstraße 8, 99096 Erfurt, Germany.',
			],
		},
	],
};

export const PRIVACY: Record<'de' | 'en', PrivacyText> = { de: DE, en: EN };
