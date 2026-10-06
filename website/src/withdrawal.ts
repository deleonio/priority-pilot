/**
 * Text der Widerrufsbelehrung und des Muster-Widerrufsformulars (#2307): nur Deutsch, feste URL
 * `/widerruf/`, Muster `terms.ts`. Grundlage sind die Muster der Anlagen 1 und 2 zu Art. 246a § 1
 * EGBGB für Dienstleistungsverträge. `{anbieter}` setzt `renderWithdrawal` aus den Betreiberangaben.
 */
export interface WithdrawalSection {
	heading: string;
	paragraphs: string[];
}

export const WITHDRAWAL: { intro: string; description: string; sections: WithdrawalSection[] } = {
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
