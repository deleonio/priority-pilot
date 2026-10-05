/**
 * Vorlagen-Bibliothek (#1976): deutsche Checklisten für typische DACH-Lebensprojekte unter
 * `/vorlagen/`. Liegt als Modul neben dem Renderer und nicht in den i18n-Dateien, weil der
 * Key-Parity-Test den Text sonst in alle zehn Sprachen duplizieren würde (Muster `mcp-guide.ts`).
 * Die Struktur (`id`, `after`) ist die Eingabe des späteren Vorlagen-Imports (#1993).
 */

export interface TemplateStep {
	/** Stabile Kennung innerhalb der Vorlage. */
	id: string;
	title: string;
	/** `id`s der Vorgänger-Schritte; sie stehen in `steps` immer davor. */
	after: string[];
}

export interface LifeTemplate {
	slug: string;
	title: string;
	description: string;
	steps: TemplateStep[];
}

export const TEMPLATES: LifeTemplate[] = [
	{
		slug: 'hausbau',
		title: 'Hausbau',
		description: 'Von der Finanzierung bis zum Einzug: Checkliste für den Hausbau in sinnvoller Reihenfolge.',
		steps: [
			{ id: 'budget', title: 'Budget und Eigenkapital klären', after: [] },
			{ id: 'grundstueck', title: 'Grundstück suchen und prüfen', after: ['budget'] },
			{ id: 'finanzierung', title: 'Baufinanzierung abschließen', after: ['budget', 'grundstueck'] },
			{ id: 'bauantrag', title: 'Bauantrag stellen', after: ['grundstueck'] },
			{ id: 'bauvertrag', title: 'Bauvertrag unterzeichnen', after: ['finanzierung', 'bauantrag'] },
			{ id: 'rohbau', title: 'Rohbau begleiten und abnehmen', after: ['bauvertrag'] },
			{ id: 'ausbau', title: 'Innenausbau abstimmen', after: ['rohbau'] },
			{ id: 'abnahme', title: 'Haus abnehmen und Mängel dokumentieren', after: ['ausbau'] },
			{ id: 'einzug', title: 'Einziehen und Ummeldungen erledigen', after: ['abnahme'] },
		],
	},
	{
		slug: 'umzug',
		title: 'Umzug',
		description: 'Umzug ohne Chaos: Kündigungen, Termine und Ummeldungen in der richtigen Reihenfolge.',
		steps: [
			{ id: 'mietvertrag', title: 'Alte Wohnung kündigen', after: [] },
			{ id: 'neue-wohnung', title: 'Neue Wohnung verbindlich zusagen', after: [] },
			{
				id: 'termin',
				title: 'Umzugstermin und Helfer oder Umzugsfirma festlegen',
				after: ['mietvertrag', 'neue-wohnung'],
			},
			{ id: 'vertraege', title: 'Strom, Internet und Versicherungen ummelden', after: ['neue-wohnung'] },
			{ id: 'packen', title: 'Kisten packen und beschriften', after: ['termin'] },
			{ id: 'umzugstag', title: 'Umzugstag durchführen und Zählerstände notieren', after: ['packen', 'vertraege'] },
			{ id: 'uebergabe', title: 'Alte Wohnung übergeben', after: ['umzugstag'] },
			{ id: 'ummelden', title: 'Beim Einwohnermeldeamt ummelden', after: ['umzugstag'] },
		],
	},
	{
		slug: 'steuererklaerung',
		title: 'Steuererklärung',
		description: 'Steuererklärung vorbereiten: Belege sammeln, Formulare ausfüllen und fristgerecht abgeben.',
		steps: [
			{ id: 'frist', title: 'Abgabefrist prüfen', after: [] },
			{ id: 'belege', title: 'Lohnsteuerbescheinigung und Belege sammeln', after: [] },
			{ id: 'werbungskosten', title: 'Werbungskosten und Sonderausgaben zusammenstellen', after: ['belege'] },
			{ id: 'formular', title: 'Steuerformulare ausfüllen', after: ['frist', 'werbungskosten'] },
			{ id: 'abgabe', title: 'Erklärung elektronisch abgeben', after: ['formular'] },
			{ id: 'bescheid', title: 'Steuerbescheid prüfen', after: ['abgabe'] },
			{ id: 'einspruch', title: 'Bei Fehlern fristgerecht Einspruch einlegen', after: ['bescheid'] },
		],
	},
	{
		slug: 'hochzeit',
		title: 'Hochzeit',
		description: 'Hochzeit planen: vom Termin über Standesamt und Location bis zur Feier.',
		steps: [
			{ id: 'budget', title: 'Budget und Gästezahl festlegen', after: [] },
			{ id: 'termin', title: 'Termin wählen', after: ['budget'] },
			{ id: 'standesamt', title: 'Standesamt anmelden', after: ['termin'] },
			{ id: 'location', title: 'Location und Catering buchen', after: ['termin', 'budget'] },
			{ id: 'einladungen', title: 'Einladungen verschicken', after: ['location'] },
			{ id: 'dienstleister', title: 'Fotograf und Musik buchen', after: ['location'] },
			{ id: 'feier', title: 'Trauung und Feier durchführen', after: ['standesamt', 'einladungen', 'dienstleister'] },
			{ id: 'namensaenderung', title: 'Namensänderung bei Ämtern und Banken melden', after: ['feier'] },
		],
	},
	{
		slug: 'geburt-elternzeit',
		title: 'Geburt und Elternzeit',
		description: 'Geburt und Elternzeit organisieren: Anträge, Fristen und Behördengänge im Überblick.',
		steps: [
			{ id: 'mutterschutz', title: 'Mutterschutz mit dem Arbeitgeber abstimmen', after: [] },
			{ id: 'klinik', title: 'Klinik oder Hebamme anmelden', after: [] },
			{ id: 'geburt', title: 'Geburt', after: ['klinik'] },
			{ id: 'urkunde', title: 'Geburtsurkunde beim Standesamt beantragen', after: ['geburt'] },
			{ id: 'versicherung', title: 'Kind krankenversichern', after: ['urkunde'] },
			{ id: 'elternzeit', title: 'Elternzeit beim Arbeitgeber beantragen', after: ['mutterschutz', 'geburt'] },
			{ id: 'elterngeld', title: 'Elterngeld beantragen', after: ['urkunde', 'elternzeit'] },
			{ id: 'kindergeld', title: 'Kindergeld beantragen', after: ['urkunde'] },
		],
	},
	{
		slug: 'jobwechsel',
		title: 'Jobwechsel',
		description: 'Jobwechsel sauber vorbereiten: Kündigung, Übergabe und Start im neuen Unternehmen.',
		steps: [
			{ id: 'unterlagen', title: 'Bewerbungsunterlagen aktualisieren', after: [] },
			{ id: 'zusage', title: 'Neuen Vertrag prüfen und unterschreiben', after: ['unterlagen'] },
			{ id: 'kuendigung', title: 'Kündigung einreichen', after: ['zusage'] },
			{ id: 'zeugnis', title: 'Arbeitszeugnis anfordern', after: ['kuendigung'] },
			{ id: 'uebergabe', title: 'Aufgaben und Wissen übergeben', after: ['kuendigung'] },
			{ id: 'resturlaub', title: 'Resturlaub und Überstunden klären', after: ['kuendigung'] },
			{ id: 'start', title: 'Im neuen Unternehmen starten', after: ['zeugnis', 'uebergabe', 'resturlaub'] },
		],
	},
];
