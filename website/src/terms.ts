/**
 * Text der Nutzungsbedingungen (#1891): Deutsch unter der festen URL `/nutzungsbedingungen/`
 * (verbindlich), Englisch unter `/en/terms/`, Muster `privacy.ts`. Preise stehen hier nicht:
 * `renderTerms` setzt sie aus `plans.ts` als Liste hinter `priceLead`, Format `priceLine`.
 */
export interface TermsSection {
	heading: string;
	/** Einleitung der Preisliste aus `plans.ts`; steht mit ihr vor den Absätzen. */
	priceLead?: string;
	paragraphs: string[];
}

export interface TermsText {
	title: string;
	intro: string;
	description: string;
	/** Preiszeile eines Abo-Pakets mit `{monthly}`, `{quarterly}` und `{yearly}`. */
	priceLine: string;
	sections: TermsSection[];
}

const DE: TermsText = {
	title: 'Nutzungsbedingungen',
	priceLine: '{monthly} im Monat, {quarterly} im Quartal oder {yearly} im Jahr',
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

const EN: TermsText = {
	title: 'Terms of use',
	priceLine: '{monthly} per month, {quarterly} per quarter or {yearly} per year',
	intro:
		'These terms apply to the use of Balamentum in the browser and in the Android app. By creating an account you accept them.',
	description:
		'Terms of use of Balamentum: account, plans and subscription term, upgrade, downgrade and cancellation, payment via PayPal and Google Play, liability.',
	sections: [
		{
			heading: 'Account',
			paragraphs: [
				'Your account is created the first time you sign in successfully with your Google account or via a sign-in link sent by email. It is personal and not transferable; keep access to your Google account and your email inbox protected.',
				'You can delete your account at any time in the settings. This deletes your data; you should cancel an active subscription beforehand.',
			],
		},
		{
			heading: 'Plans and subscription',
			priceLead:
				'Balamentum comes in three plans: one is free and unlimited in time, the others are subscriptions. The prices are final prices; no VAT is charged under Section 19 of the German VAT Act (UStG):',
			paragraphs: [
				'Term: A subscription runs for the chosen period (month, quarter or year) and renews automatically for the same period unless you cancel it.',
				'Upgrade: If you switch to a higher plan, it is unlocked immediately.',
				'Downgrade: If you switch to a lower plan, you keep the paid plan until the end of the current period; after that the lower plan applies.',
				'Cancellation: You can cancel your subscription at any time without giving reasons. You cancel a subscription taken out via PayPal in the app under Subscription; your paid plan stays active until the end of the current period, after which the account falls back to Free. There is no refund for the remaining period. You cancel a subscription taken out via Google Play in Google Play; it ends according to the rules of Google Play. Your account and your data are kept after cancellation.',
			],
		},
		{
			heading: 'Payment methods',
			paragraphs: [
				'In the browser you pay for a subscription via PayPal. The charge is made at the start of each period; we issue an invoice for every payment. If a charge fails, the plan stays active for a grace period.',
				'In the Android app you buy a subscription via Google Play. Payment, invoice, cancellation and refund are then handled by Google Play under its terms.',
			],
		},
		{
			heading: 'Liability',
			paragraphs: [
				'Balamentum serves life balance and self-care. It is not a medical device and does not replace medical advice; in a mental health crisis you can reach the German TelefonSeelsorge free of charge at 0800 111 0 111.',
				'Balamentum only reflects the activities you record yourself. It provides no life-saving services, no crisis intervention and no medical care.',
				'The AI-generated suggestions in the app (such as care and task suggestions) are an aid without guarantee. We are not liable for them; your own assessment and decision is what counts.',
				'Balamentum is a tool for personal planning. We are not liable for the consequences of missed or incorrectly entered tasks and appointments; reminders and hints are an aid, not a guarantee.',
				'We strive for trouble-free operation, but we cannot promise constant availability.',
				'We are liable without limitation for intent and gross negligence as well as for damage resulting from injury to life, body or health. In the case of slight negligence, we are only liable for the breach of essential contractual obligations, limited to the foreseeable, typical damage.',
			],
		},
	],
};

export const TERMS: Record<'de' | 'en', TermsText> = { de: DE, en: EN };
