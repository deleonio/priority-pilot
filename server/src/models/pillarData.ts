/**
 * Kanonische Stammdaten der fünf festen Lebensbalance-Säulen. Pillars sind **globale Stammdaten**
 * (für alle Nutzer identisch, nicht pro Nutzer isoliert) – daher liegen Name, Kurzbeschreibung und
 * Default-Gewichtung hier an **einer** Stelle. Genutzt vom Seed (`index.ts`) und der Migration
 * (`migrate.ts`), damit beide zwingend dieselben Werte verwenden und nicht auseinander driften.
 *
 * Die Kurzbeschreibungen sind bewusst einzeilig und UI-tauglich (Einstellungs-Menü).
 *
 * Wissenschaftliche Fundierung:
 * - Basierend auf Hilarion Petzolds **„Fünf Säulen der Identität“**
 * - Ergänzt um Konzepte der **Positiven Psychologie**
 */
export const SEED_PILLARS: readonly {
	name: string;
	description: string;
	weight: number;
}[] = [
	{
		name: 'Körper',
		description: 'Leiblichkeit: Biopsychologische Basis – Schlaf, Ernährung und Bewegung steuern hormonell und neuronal die Resilienz.',
		weight: 20,
	},
	{
		name: 'Mentale Gesundheit',
		description: 'Emotionsregulation: Kognitive Flexibilität und Affektregulation – Techniken wie Achtsamkeit führen in die innere Homöostase zurück.',
		weight: 20,
	},
	{
		name: 'Beziehungen',
		description: 'Bindung: Sichere, wertungsfreie Räume – emotionale Resonanz und Zugehörigkeit, vollständig entkoppelt von eigener Leistung.',
		weight: 20,
	},
	{
		name: 'Wirksamkeit',
		description: 'Selbstwirksamkeit: Aktives Gestalten der Umwelt – das tiefe Bedürfnis, durch Arbeit, Projekte oder Output Kompetenz zu erleben.',
		weight: 20,
	},
	{
		name: 'Sinn',
		description: 'Transzendenz & Werte: Das existenzielle „Wofür“ – ordnet Handeln in einen größeren, wertorientierten Kontext ein.',
		weight: 20,
	},
] as const;
