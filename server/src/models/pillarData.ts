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
	/** Englische Fassung für Konten mit App-Sprache `en` (Anzeige, nicht gespeichert). */
	en: { name: string; description: string };
	weight: number;
	rhythmusProWoche: number;
}[] = [
	{
		key: 'koerper',
		name: 'Körper',
		description:
			'Leiblichkeit: Biopsychologische Basis – Schlaf, Ernährung und Bewegung steuern hormonell und neuronal die Resilienz. Erledigte Aufgaben stärken den Körper; Ziel sind 5 Erledigungen pro Woche.',
		en: {
			name: 'Body',
			description:
				'Physicality: the biopsychological basis – sleep, nutrition and exercise regulate resilience hormonally and neurally. Completed tasks strengthen the body; the goal is 5 completions per week.',
		},
		weight: 20,
		rhythmusProWoche: 5,
	},
	{
		key: 'mental',
		name: 'Mentale Gesundheit',
		description:
			'Emotionsregulation: Kognitive Flexibilität und Affektregulation – Techniken wie Achtsamkeit führen in die innere Homöostase zurück. Erledigte Aufgaben stärken diese Säule; Ziel sind 3 Erledigungen pro Woche.',
		en: {
			name: 'Mental health',
			description:
				'Emotion regulation: cognitive flexibility and affect regulation – techniques such as mindfulness lead back to inner homeostasis. Completed tasks strengthen this pillar; the goal is 3 completions per week.',
		},
		weight: 20,
		rhythmusProWoche: 3,
	},
	{
		key: 'beziehungen',
		name: 'Beziehungen',
		description:
			'Bindung: Sichere, wertungsfreie Räume – emotionale Resonanz und Zugehörigkeit, vollständig entkoppelt von eigener Leistung. Erledigte Aufgaben stärken die Beziehungen; Ziel sind 3 Erledigungen pro Woche.',
		en: {
			name: 'Relationships',
			description:
				'Attachment: safe, non-judgemental spaces – emotional resonance and belonging, completely decoupled from your own performance. Completed tasks strengthen relationships; the goal is 3 completions per week.',
		},
		weight: 20,
		rhythmusProWoche: 3,
	},
	{
		key: 'wirksamkeit',
		name: 'Wirksamkeit',
		description:
			'Selbstwirksamkeit: Aktives Gestalten der Umwelt – das tiefe Bedürfnis, durch Arbeit, Projekte oder Output Kompetenz zu erleben. Erledigte Aufgaben stärken die Wirksamkeit; Ziel sind 5 Erledigungen pro Woche.',
		en: {
			name: 'Impact',
			description:
				'Self-efficacy: actively shaping your environment – the deep need to experience competence through work, projects or output. Completed tasks strengthen impact; the goal is 5 completions per week.',
		},
		weight: 20,
		rhythmusProWoche: 5,
	},
	{
		key: 'sinn',
		name: 'Sinn',
		description:
			'Transzendenz & Werte: Das existenzielle „Wofür“ – ordnet Handeln in einen größeren, wertorientierten Kontext ein. Erledigte Aufgaben stärken den Sinn; Ziel ist 1 Erledigung pro Woche – Sinn ist damit am schnellsten im grünen Bereich.',
		en: {
			name: 'Meaning',
			description:
				'Transcendence & values: the existential "what for" – places action in a larger, value-oriented context. Completed tasks strengthen meaning; the goal is 1 completion per week – which makes meaning the quickest to reach the green zone.',
		},
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

/**
 * Anzeigetext einer Standard-Säule in der App-Sprache: Nur unveränderte Katalogwerte (deutscher
 * Seed-Name bzw. -Beschreibung) werden übersetzt, eine umbenannte Säule bleibt, wie sie ist.
 */
export const pillarTextIn = (sprache: string, text: string): string => {
	if (sprache !== 'en') return text;
	const seed = SEED_PILLARS.find((pillar) => pillar.name === text || pillar.description === text);
	if (seed === undefined) return text;
	return seed.name === text ? seed.en.name : seed.en.description;
};

/** Umkehrung von {@link pillarTextIn} für `en`: der englische Katalogtext wird wieder der deutsche Seed-Wert. */
export const pillarTextFromEn = (text: string): string => {
	const seed = SEED_PILLARS.find((pillar) => pillar.en.name === text || pillar.en.description === text);
	if (seed === undefined) return text;
	return seed.en.name === text ? seed.name : seed.description;
};
