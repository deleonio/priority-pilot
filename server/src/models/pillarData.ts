/**
 * Kanonische Stammdaten der fünf festen Lebensbalance-Säulen. Pillars sind **globale Stammdaten**
 * (für alle Nutzer identisch, nicht pro Nutzer isoliert) — daher liegen Name, Kurzbeschreibung und
 * Default-Gewichtung hier an **einer** Stelle. Genutzt vom Seed (`index.ts`) und der Migration
 * (`migrate.ts`), damit beide zwingend dieselben Werte verwenden und nicht auseinander driften.
 *
 * Die Kurzbeschreibungen sind bewusst einzeilig und UI-tauglich (Einstellungs-Menü).
 */
export const SEED_PILLARS: readonly {
	name: string;
	description: string;
	weight: number;
}[] = [
	{
		name: 'Körper',
		description: 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.',
		weight: 20,
	},
	{
		name: 'Beziehungen',
		description: 'Soziale Verbundenheit: Familie, Freunde, Partnerschaft, gemeinsame Zeit.',
		weight: 20,
	},
	{
		name: 'Sinn',
		description: 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.',
		weight: 20,
	},
	{
		name: 'Mentale Gesundheit',
		description: 'Psychisches Wohlbefinden: Stressabbau, Ruhe, Achtsamkeit, Emotionen klären.',
		weight: 20,
	},
	{
		name: 'Wirksamkeit',
		description: 'Etwas bewirken: Beruf, Projekte, Lernen, sichtbarer Output.',
		weight: 20,
	},
] as const;
