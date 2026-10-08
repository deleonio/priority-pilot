/**
 * Text der Widerrufsbelehrung und des Muster-Widerrufsformulars (#2307): Deutsch unter der festen URL
 * `/widerruf/` (verbindlich), Englisch unter `/en/withdrawal/`, Muster `terms.ts`. Grundlage sind die Muster der Anlagen 1 und 2 zu Art. 246a § 1
 * EGBGB für Dienstleistungsverträge. `{anbieter}` setzt `renderWithdrawal` aus den Betreiberangaben.
 */
export interface WithdrawalSection {
	heading: string;
	paragraphs: string[];
}

export interface WithdrawalText {
	title: string;
	/** Beschriftung der E-Mail-Adresse in `{anbieter}`. */
	emailLabel: string;
	intro: string;
	description: string;
	sections: WithdrawalSection[];
}

const DE: WithdrawalText = {
	title: 'Widerrufsbelehrung',
	emailLabel: 'E-Mail',
	intro:
		'Wenn du als Verbraucher ein kostenpflichtiges Paket von Balamentum im Browser abschließt, hast du ein gesetzliches Widerrufsrecht. Hier findest du die Widerrufsbelehrung und das Muster-Widerrufsformular.',
	description:
		'Widerrufsbelehrung und Muster-Widerrufsformular von Balamentum: Widerrufsrecht, Folgen des Widerrufs und vorzeitiges Erlöschen bei sofortigem Leistungsbeginn.',
	sections: [
		{
			heading: 'Widerrufsrecht',
			paragraphs: [
				'Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
				'Um dein Widerrufsrecht auszuüben, musst du uns ({anbieter}) mittels einer eindeutigen Erklärung (zum Beispiel ein mit der Post versandter Brief oder eine E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.',
				'Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.',
			],
		},
		{
			heading: 'Folgen des Widerrufs',
			paragraphs: [
				'Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.',
				'Hast du verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem du uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichtest, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.',
			],
		},
		{
			heading: 'Vorzeitiges Erlöschen des Widerrufsrechts',
			paragraphs: [
				'Dein Widerrufsrecht erlischt bei einem Vertrag über die Erbringung von Dienstleistungen vorzeitig, wenn wir die Dienstleistung vollständig erbracht haben und mit der Ausführung der Dienstleistung erst begonnen haben, nachdem du dazu deine ausdrückliche Zustimmung gegeben und gleichzeitig deine Kenntnis davon bestätigt hast, dass du dein Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlierst. Diese Zustimmung und Bestätigung gibst du vor dem Kauf mit dem Haken im Bestellvorgang.',
			],
		},
		{
			heading: 'Muster-Widerrufsformular',
			paragraphs: [
				'Wenn du den Vertrag widerrufen willst, dann fülle bitte dieses Formular aus und sende es an uns zurück.',
				'An {anbieter}:',
				'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*):',
				'Bestellt am (*): ____________________',
				'Name des/der Verbraucher(s): ____________________',
				'Anschrift des/der Verbraucher(s): ____________________',
				'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ____________________',
				'Datum: ____________________',
				'(*) Unzutreffendes streichen.',
			],
		},
	],
};

const EN: WithdrawalText = {
	title: 'Right of withdrawal',
	emailLabel: 'email',
	intro:
		'If you, as a consumer, take out a paid Balamentum plan in the browser, you have a statutory right of withdrawal. Here you will find the withdrawal instructions and the model withdrawal form.',
	description:
		'Withdrawal instructions and model withdrawal form of Balamentum: right of withdrawal, consequences of withdrawal and early expiry when the service starts immediately.',
	sections: [
		{
			heading: 'Right of withdrawal',
			paragraphs: [
				'You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day the contract is concluded.',
				'To exercise your right of withdrawal, you must inform us ({anbieter}) of your decision to withdraw from this contract by means of a clear statement (for example a letter sent by post or an email). You may use the model withdrawal form below, but it is not obligatory.',
				'To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired.',
			],
		},
		{
			heading: 'Consequences of withdrawal',
			paragraphs: [
				'If you withdraw from this contract, we shall reimburse to you all payments received from you without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.',
				'If you requested the service to begin during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated to us your withdrawal from this contract, in comparison with the full coverage of the contract.',
			],
		},
		{
			heading: 'Early expiry of the right of withdrawal',
			paragraphs: [
				'In the case of a contract for the provision of services, your right of withdrawal expires early if we have fully performed the service and only began performing it after you gave your express consent and at the same time confirmed your knowledge that you lose your right of withdrawal once we have fully performed the contract. You give this consent and confirmation before the purchase by ticking the box in the order process.',
			],
		},
		{
			heading: 'Model withdrawal form',
			paragraphs: [
				'If you want to withdraw from the contract, please complete this form and return it to us.',
				'To {anbieter}:',
				'I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract for the provision of the following service (*):',
				'Ordered on (*): ____________________',
				'Name of consumer(s): ____________________',
				'Address of consumer(s): ____________________',
				'Signature of consumer(s) (only if this form is notified on paper): ____________________',
				'Date: ____________________',
				'(*) Delete as appropriate.',
			],
		},
	],
};

export const WITHDRAWAL: Record<'de' | 'en', WithdrawalText> = { de: DE, en: EN };
