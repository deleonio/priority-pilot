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
}

export const PRIVACY: { intro: string; description: string; sections: PrivacySection[] } = {
	intro:
		'Balamentum kommt mit so wenig Daten wie möglich aus. Diese Erklärung zählt auf, welche das sind, wer sie außerdem sieht und welche Grundsätze für uns gelten.',
	description:
		'Datenschutzerklärung von Balamentum: Datensparsamkeit, keine Auswertung, keine Weitergabe an Dritte, Ende-zu-Ende-Verschlüsselung, wo es technisch möglich ist.',
	sections: [
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
			],
		},
		{
			heading: 'Keine Weitergabe an Dritte',
			paragraphs: [
				'Wir geben deine Daten nicht an Dritte weiter und verkaufen sie nicht. Nur die unten genannten Dienste erhalten die Angaben, die ihre jeweilige Aufgabe braucht, und nur solange du die zugehörige Funktion nutzt.',
			],
		},
		{
			heading: 'Verschlüsselung',
			paragraphs: [
				'Wo es technisch möglich ist, werden deine Daten Ende-zu-Ende-verschlüsselt, sodass nur du sie lesen kannst.',
			],
		},
		{
			heading: 'Empfänger',
			paragraphs: ['An die folgenden Dienste gelangen Daten, wenn du die jeweilige Funktion nutzt:'],
			list: [
				'PayPal: Zahlung und Abrechnung, wenn du ein Abo über PayPal abschließt.',
				'Google-Login: Anmeldung mit deinem Google-Konto, wenn du diese Anmeldeart wählst.',
				'Firebase Cloud Messaging: Zustellung von Push-Benachrichtigungen auf deine Geräte.',
				'Google Play: Kauf und Abrechnung von Abos innerhalb der Android-App.',
			],
		},
	],
};
