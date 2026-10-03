/**
 * Kanonische Stammdaten der fünf festen Lebensbalance-Säulen. Der Katalog ist **global** (für alle
 * Nutzer identisch); jede Nutzerin und jeder Nutzer besitzt in `pillar.ts` eine eigene Kopie –
 * daher liegen Name, Kurzbeschreibung und Default-Gewichtung hier an **einer** Stelle. Genutzt vom
 * Seed (`index.ts`) und der Migration
 * (`migrate.ts`), damit beide zwingend dieselben Werte verwenden und nicht auseinander driften.
 *
 * Die Reihenfolge folgt der wissenschaftlichen Systematik von Hilarion Petzolds „Fünf Säulen
 * der Identität" (vom Körperlichen zum Transzendenten) und wird so vom Seed als positionsbasierte
 * id (1–5) vergeben. Die Beschreibungen sind wissenschaftlich fundiert (nicht zwingend einzeilig)
 * und fließen u. a. über `buildSystemPrompt` in die LLM-Klassifikation ein; im Einstellungs-Menü
 * werden sie als längere Erläuterungstexte angezeigt.
 *
 * Wissenschaftliche Fundierung:
 * - Basierend auf Hilarion Petzolds **„Fünf Säulen der Identität“**
 * - Ergänzt um Konzepte der **Positiven Psychologie**
 */
export const SEED_PILLARS: readonly {
	key: string;
	name: string;
	description: string;
	weight: number;
	rhythmusProWoche: number;
}[] = [
	{
		key: 'koerper',
		name: 'Körper',
		description:
			'Leiblichkeit: Biopsychologische Basis – Schlaf, Ernährung und Bewegung steuern hormonell und neuronal die Resilienz. Erledigte Aufgaben stärken den Körper; Ziel sind 5 Erledigungen pro Woche.',
		weight: 20,
		rhythmusProWoche: 5,
	},
	{
		key: 'mental',
		name: 'Mentale Gesundheit',
		description:
			'Emotionsregulation: Kognitive Flexibilität und Affektregulation – Techniken wie Achtsamkeit führen in die innere Homöostase zurück. Erledigte Aufgaben stärken diese Säule; Ziel sind 3 Erledigungen pro Woche.',
		weight: 20,
		rhythmusProWoche: 3,
	},
	{
		key: 'beziehungen',
		name: 'Beziehungen',
		description:
			'Bindung: Sichere, wertungsfreie Räume – emotionale Resonanz und Zugehörigkeit, vollständig entkoppelt von eigener Leistung. Erledigte Aufgaben stärken die Beziehungen; Ziel sind 3 Erledigungen pro Woche.',
		weight: 20,
		rhythmusProWoche: 3,
	},
	{
		key: 'wirksamkeit',
		name: 'Wirksamkeit',
		description:
			'Selbstwirksamkeit: Aktives Gestalten der Umwelt – das tiefe Bedürfnis, durch Arbeit, Projekte oder Output Kompetenz zu erleben. Erledigte Aufgaben stärken die Wirksamkeit; Ziel sind 5 Erledigungen pro Woche.',
		weight: 20,
		rhythmusProWoche: 5,
	},
	{
		key: 'sinn',
		name: 'Sinn',
		description:
			'Transzendenz & Werte: Das existenzielle „Wofür“ – ordnet Handeln in einen größeren, wertorientierten Kontext ein. Erledigte Aufgaben stärken den Sinn; Ziel ist 1 Erledigung pro Woche – Sinn ist damit am schnellsten im grünen Bereich.',
		weight: 20,
		rhythmusProWoche: 1,
	},
] as const;

/**
 * Soll-Rhythmus je Säule in Erledigungen pro Woche (#1638, Kadenz-Modell), aus {@link SEED_PILLARS}
 * abgeleitet. Feste Stammdaten, bewusst nicht über API/UI änderbar.
 */
export const PILLAR_RHYTHMS: readonly { name: string; rhythmusProWoche: number }[] = SEED_PILLARS.map(
	({ name, rhythmusProWoche }) => ({ name, rhythmusProWoche }),
);

/** Katalogeintrag zu einer stabilen Säulen-`key`-Kennung (#1848); `undefined` für eigene/unbekannte Säulen. */
export const findSeedPillar = (key: string | null | undefined): (typeof SEED_PILLARS)[number] | undefined =>
	SEED_PILLARS.find((pillar) => pillar.key === key);

/**
 * Beschreibung einer Säule (#1848): für Standard-Säulen (bekannter `key`) der zentrale Katalogtext,
 * sonst der DB-Wert — so wirkt eine Textänderung ohne Datenmigration für alle Konten.
 */
export const resolvePillarDescription = (pillar: { key?: string | null; description: string }): string =>
	findSeedPillar(pillar.key)?.description ?? pillar.description;
