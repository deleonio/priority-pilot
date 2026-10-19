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
		'Diese Bedingungen gelten für die Nutzung von Balamentum im Browser und in der Android-App. Vor der ersten Nutzung stimmst du ihnen in der App zu.',
	description:
		'Nutzungsbedingungen von Balamentum: Konto, Pakete und Abo mit Laufzeit, Upgrade, Downgrade und Kündigung, Zahlungswege PayPal und Google Play, Haftung.',
	sections: [
		{
			heading: 'Konto',
			paragraphs: [
				'Dein Konto entsteht bei der ersten erfolgreichen Anmeldung mit deinem Google-Konto oder über einen Anmeldelink per E-Mail. Es ist persönlich und nicht übertragbar; halte den Zugang zu deinem Google-Konto und deinem E-Mail-Postfach geschützt.',
				'Du kannst dein Konto jederzeit in den Einstellungen löschen. Dabei werden deine Daten gelöscht; Rechnungen bewahren wir auf, solange das Gesetz es verlangt. Solange ein Abo läuft, kannst du das Konto nicht löschen; kündige es vorher.',
			],
		},
		{
			heading: 'Pakete und Abo',
			priceLead:
				'Balamentum gibt es in drei Paketen: eines ist kostenlos und zeitlich unbegrenzt, die übrigen sind Abos. Die Preise sind Endpreise; nach § 19 UStG wird keine Umsatzsteuer berechnet:',
			paragraphs: [
				'Laufzeit: Ein Abo läuft zunächst über den gewählten Zeitraum (Monat, Quartal oder Jahr) und verlängert sich danach automatisch, solange du es nicht kündigst. Ein Monatsabo verlängert sich jeweils um einen Monat. Ein Quartals- oder Jahresabo verlängert sich auf unbestimmte Zeit und ist dann jederzeit mit einer Frist von einem Monat kündbar; im Voraus gezahlte Beträge für die Zeit nach dem Vertragsende erstatten wir anteilig.',
				'Upgrade: Wechselst du in ein höheres Paket, wird es sofort freigeschaltet.',
				'Downgrade: Wechselst du in ein niedrigeres Paket, behältst du das bezahlte Paket bis zum Ende des laufenden Zeitraums; danach gilt das niedrigere Paket.',
				'Kündigung: Du kannst dein Abo jederzeit kündigen, ohne Angabe von Gründen. Ein über PayPal abgeschlossenes Abo kündigst du in der App im Bereich Abo; dein bezahltes Paket bleibt bis zum Ende des laufenden Zeitraums aktiv, danach fällt das Konto auf Free zurück. Für den Rest der ersten Laufzeit gibt es keine Erstattung. Ohne Anmeldung kündigst du über die Seite „Kündigen“ dieser Website. Ein über Google Play abgeschlossenes Abo kündigst du in Google Play; es endet nach den Regeln von Google Play. Dein Konto und deine Daten bleiben nach der Kündigung erhalten.',
				'Widerruf: Schließt du als Verbraucher ein Abo im Browser ab, hast du ein gesetzliches Widerrufsrecht. Einzelheiten stehen in der Widerrufsbelehrung.',
			],
		},
		{
			heading: 'Zahlungswege',
			paragraphs: [
				'Im Browser bezahlst du ein Abo über PayPal. Die Abbuchung erfolgt zu Beginn jedes Zeitraums; für jede Zahlung stellen wir eine Rechnung aus. Schlägt ein Einzug fehl, bleibt das Paket noch 15 Tage aktiv.',
				'In der Android-App kaufst du ein Abo über Google Play. Zahlung, Rechnung, Kündigung und Erstattung laufen dann über Google Play und dessen Bedingungen.',
			],
		},
		{
			heading: 'Haftung',
			paragraphs: [
				'Balamentum dient der Lebensbalance und Selbstfürsorge. Es ist kein Medizinprodukt und ersetzt keinen ärztlichen Rat; bei seelischen Krisen erreichst du die TelefonSeelsorge kostenfrei unter 0800 111 0 111.',
				'Balamentum bildet nur die Tätigkeiten ab, die du selbst erfasst. Es leistet keine Lebensrettung, keine Krisenintervention und keine medizinische Betreuung.',
				'Die KI-generierten Vorschläge der App (etwa Fürsorge- und Aufgabenvorschläge) sind eine Hilfe ohne Gewähr für ihre Richtigkeit. Über den letzten Absatz hinaus haften wir nicht für sie; deine eigene Bewertung und Entscheidung zählt.',
				'Balamentum ist ein Werkzeug zur persönlichen Planung. Für Folgen verpasster oder falsch eingetragener Aufgaben und Termine haften wir nur nach dem letzten Absatz; Erinnerungen und Hinweise sind eine Hilfe, keine Gewähr.',
				'Wir bemühen uns um einen störungsfreien Betrieb, eine ständige Verfügbarkeit können wir nicht zusagen.',
				'Bei Vorsatz und grober Fahrlässigkeit, bei Schäden an Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz haften wir nach den gesetzlichen Vorschriften. Bei leichter Fahrlässigkeit haften wir nur, wenn wir eine wesentliche Vertragspflicht verletzen: eine Pflicht, die den Vertrag erst möglich macht und auf die du dich verlassen darfst, etwa die Bereitstellung deines bezahlten Pakets. Die Haftung ist dann auf den Schaden begrenzt, der bei Vertragsschluss vorhersehbar und typisch war.',
			],
		},
	],
};

const EN: TermsText = {
	title: 'Terms of use',
	priceLine: '{monthly} per month, {quarterly} per quarter or {yearly} per year',
	intro:
		'These terms apply to the use of Balamentum in the browser and in the Android app. You agree to them in the app before using it for the first time.',
	description:
		'Terms of use of Balamentum: account, plans and subscription term, upgrade, downgrade and cancellation, payment via PayPal and Google Play, liability.',
	sections: [
		{
			heading: 'Account',
			paragraphs: [
				'Your account is created the first time you sign in successfully with your Google account or via a sign-in link sent by email. It is personal and not transferable; keep access to your Google account and your email inbox protected.',
				'You can delete your account at any time in the settings. This deletes your data; we keep invoices for as long as the law requires. While a subscription is running you cannot delete the account; cancel it first.',
			],
		},
		{
			heading: 'Plans and subscription',
			priceLead:
				'Balamentum comes in three plans: one is free and unlimited in time, the others are subscriptions. The prices are final prices; no VAT is charged under Section 19 of the German VAT Act (UStG):',
			paragraphs: [
				'Term: A subscription first runs for the chosen period (month, quarter or year) and then renews automatically unless you cancel it. A monthly subscription renews for one month at a time. A quarterly or yearly subscription renews for an indefinite period and can then be cancelled at any time with one month’s notice; we refund amounts paid in advance for the time after the contract ends on a pro rata basis.',
				'Upgrade: If you switch to a higher plan, it is unlocked immediately.',
				'Downgrade: If you switch to a lower plan, you keep the paid plan until the end of the current period; after that the lower plan applies.',
				'Cancellation: You can cancel your subscription at any time without giving reasons. You cancel a subscription taken out via PayPal in the app under Subscription; your paid plan stays active until the end of the current period, after which the account falls back to Free. There is no refund for the rest of the first term. Without signing in, you can cancel via the “Cancel” page of this website. You cancel a subscription taken out via Google Play in Google Play; it ends according to the rules of Google Play. Your account and your data are kept after cancellation.',
				'Withdrawal: If you take out a subscription in the browser as a consumer, you have a statutory right of withdrawal. Details are in the withdrawal policy.',
			],
		},
		{
			heading: 'Payment methods',
			paragraphs: [
				'In the browser you pay for a subscription via PayPal. The charge is made at the start of each period; we issue an invoice for every payment. If a charge fails, the plan stays active for another 15 days.',
				'In the Android app you buy a subscription via Google Play. Payment, invoice, cancellation and refund are then handled by Google Play under its terms.',
			],
		},
		{
			heading: 'Liability',
			paragraphs: [
				'Balamentum serves life balance and self-care. It is not a medical device and does not replace medical advice; in a mental health crisis you can reach the German TelefonSeelsorge free of charge at 0800 111 0 111.',
				'Balamentum only reflects the activities you record yourself. It provides no life-saving services, no crisis intervention and no medical care.',
				'The AI-generated suggestions in the app (such as care and task suggestions) are an aid without guarantee of accuracy. We are not liable for them beyond the last paragraph; your own assessment and decision is what counts.',
				'Balamentum is a tool for personal planning. We are liable for the consequences of missed or incorrectly entered tasks and appointments only under the last paragraph; reminders and hints are an aid, not a guarantee.',
				'We strive for trouble-free operation, but we cannot promise constant availability.',
				'In the case of intent and gross negligence, injury to life, body or health, and under the German Product Liability Act, we are liable in accordance with the statutory provisions. In the case of slight negligence, we are only liable if we breach an essential contractual obligation: an obligation that makes the contract possible in the first place and on which you may rely, such as providing your paid plan. Liability is then limited to the damage that was foreseeable and typical when the contract was concluded.',
			],
		},
	],
};

export const TERMS: Record<'de' | 'en', TermsText> = { de: DE, en: EN };
