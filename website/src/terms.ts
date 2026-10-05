/**
 * Text der Nutzungsbedingungen (#1891): nur Deutsch, feste URL `/nutzungsbedingungen/`, Muster
 * `privacy.ts`. Preise stehen hier nicht: `renderTerms` setzt sie aus `plans.ts` als Liste hinter
 * `priceLead`.
 */
export interface TermsSection {
	heading: string;
	/** Einleitung der Preisliste aus `plans.ts`; steht mit ihr vor den Absätzen. */
	priceLead?: string;
	paragraphs: string[];
}

export const TERMS: { intro: string; description: string; sections: TermsSection[] } = {
	intro:
		'Diese Bedingungen gelten für die Nutzung von Balamentum im Browser und in der Android-App. Mit dem Anlegen eines Kontos erkennst du sie an.',
	description:
		'Nutzungsbedingungen von Balamentum: Konto, Pakete und Abo mit Laufzeit, Upgrade, Downgrade und Kündigung, Zahlungswege PayPal und Google Play, Haftung.',
	sections: [
		{
			heading: 'Konto',
			paragraphs: [
				'Dein Konto entsteht bei der ersten erfolgreichen Anmeldung mit deinem Google-Konto oder über einen Anmeldelink per E-Mail. Es ist persönlich und nicht übertragbar; halte den Zugang zu deinem Google-Konto und deinem E-Mail-Postfach geschützt.',
				'Du kannst dein Konto jederzeit in den Einstellungen löschen. Dabei werden deine Daten gelöscht; ein laufendes Abo solltest du vorher kündigen.',
			],
		},
		{
			heading: 'Pakete und Abo',
			priceLead:
				'Balamentum gibt es in drei Paketen: eines ist kostenlos und zeitlich unbegrenzt, die übrigen sind Abos. Die Preise sind Endpreise; nach § 19 UStG wird keine Umsatzsteuer berechnet:',
			paragraphs: [
				'Laufzeit: Ein Abo läuft über den gewählten Zeitraum (Monat, Quartal oder Jahr) und verlängert sich automatisch um denselben Zeitraum, solange du es nicht kündigst.',
				'Upgrade: Wechselst du in ein höheres Paket, wird es sofort freigeschaltet.',
				'Downgrade: Wechselst du in ein niedrigeres Paket, behältst du das bezahlte Paket bis zum Ende des laufenden Zeitraums; danach gilt das niedrigere Paket.',
				'Kündigung: Du kannst dein Abo jederzeit kündigen, ohne Angabe von Gründen. Ein über PayPal abgeschlossenes Abo kündigst du in der App im Bereich Abo; dein bezahltes Paket bleibt bis zum Ende des laufenden Zeitraums aktiv, danach fällt das Konto auf Free zurück. Für den restlichen Zeitraum gibt es keine Erstattung. Ein über Google Play abgeschlossenes Abo kündigst du in Google Play; es endet nach den Regeln von Google Play. Dein Konto und deine Daten bleiben nach der Kündigung erhalten.',
			],
		},
		{
			heading: 'Zahlungswege',
			paragraphs: [
				'Im Browser bezahlst du ein Abo über PayPal. Die Abbuchung erfolgt zu Beginn jedes Zeitraums; für jede Zahlung stellen wir eine Rechnung aus. Schlägt ein Einzug fehl, bleibt das Paket für eine Übergangsfrist aktiv.',
				'In der Android-App kaufst du ein Abo über Google Play. Zahlung, Rechnung, Kündigung und Erstattung laufen dann über Google Play und dessen Bedingungen.',
			],
		},
		{
			heading: 'Haftung',
			paragraphs: [
				'Balamentum dient der Lebensbalance und Selbstfürsorge. Es ist kein Medizinprodukt und ersetzt keinen ärztlichen Rat; bei seelischen Krisen erreichst du die TelefonSeelsorge kostenfrei unter 0800 111 0 111.',
				'Balamentum bildet nur die Tätigkeiten ab, die du selbst erfasst. Es leistet keine Lebensrettung, keine Krisenintervention und keine medizinische Betreuung.',
				'Die KI-generierten Vorschläge der App (etwa Fürsorge- und Aufgabenvorschläge) sind eine Hilfe ohne Gewähr. Dafür haften wir nicht; deine eigene Bewertung und Entscheidung zählt.',
				'Balamentum ist ein Werkzeug zur persönlichen Planung. Für Folgen verpasster oder falsch eingetragener Aufgaben und Termine haften wir nicht; Erinnerungen und Hinweise sind eine Hilfe, keine Gewähr.',
				'Wir bemühen uns um einen störungsfreien Betrieb, eine ständige Verfügbarkeit können wir nicht zusagen.',
				'Unbeschränkt haften wir bei Vorsatz und grober Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, typischen Schaden.',
			],
		},
	],
};
