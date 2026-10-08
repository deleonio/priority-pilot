/**
 * Kuratierte Fürsorge-Vorlagen als Stammdaten (#1791) — je feste Säule (`SEED_PILLARS`, ids 1–5)
 * mindestens fünf Vorlagen in jeder der zwei App-Sprachen (Spiegel zu `frontend/src/i18n/locales/`;
 * eine neue App-Sprache → `CARE_SPRACHEN` erweitern). Der `key` ist sprachunabhängig und damit
 * stabiler Dismissal-Bezug (`models/careSuggestionDismissal.ts`) — niemals den Titel als Schlüssel
 * nehmen (Sprachwechsel). Texte folgen dem Ton-Leitfaden (`docs/fuersorge-tonalitaet.md`): warm,
 * nicht belehrend, konkret für heute. Kanonische Stammdaten an einer Stelle, Muster
 * `models/pillarData.ts`; #1804 (KI-Vorschläge Plus/Pro) ergänzt später dynamische Vorschläge
 * daneben, statt diesen Katalog zu ersetzen.
 */
export const CARE_SPRACHEN = ['de', 'en'] as const;

export type CareSprache = (typeof CARE_SPRACHEN)[number];

/** App-Sprache im Request-Kontext aus `Accept-Language`: `en…` → `en`, sonst `de`. */
export const spracheAusHeader = (header: string | undefined): CareSprache =>
	header?.trim().toLowerCase().startsWith('en') ? 'en' : 'de';

/** Gespeicherte App-Sprache (`users.sprache`, #1879) für Hintergrund-Jobs; fehlt sie → `de`. */
export const spracheVon = (sprache: string | null | undefined): CareSprache =>
	CARE_SPRACHEN.find((code) => code === sprache) ?? 'de';

interface VorlagenText {
	titel: string;
	beschreibung: string;
}

export const CARE_VORLAGEN: readonly { key: string; saeuleId: number; texte: Record<CareSprache, VorlagenText> }[] = [
	// ── Säule 1: Körper ──
	{
		key: 'koerper-1',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Spaziergang an der frischen Luft',
				beschreibung: 'Ein kurzer Gang um den Block reicht schon – Bewegung wirkt auch in kleinen Portionen.',
			},
			en: {
				titel: 'A walk in the fresh air',
				beschreibung: 'A short walk around the block is enough – movement helps even in small doses.',
			},
		},
	},
	{
		key: 'koerper-2',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Bewusst früher ins Bett',
				beschreibung: 'Etwas mehr Schlaf ist eine Geste der Fürsorge, kein Versäumnis – dein Körper dankt es dir.',
			},
			en: {
				titel: 'Go to bed a little earlier',
				beschreibung: 'A bit more sleep is an act of care, not a failure – your body will thank you.',
			},
		},
	},
	{
		key: 'koerper-3',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Ein Glas Wasser trinken',
				beschreibung: 'Kleine Aufmerksamkeit zählt: trink ein Glas Wasser und atme dabei einmal tief durch.',
			},
			en: {
				titel: 'Drink a glass of water',
				beschreibung: 'Small gestures count: drink a glass of water and take one deep breath.',
			},
		},
	},
	{
		key: 'koerper-4',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Zehn Minuten dehnen',
				beschreibung: 'Sanftes Dehnen löst Verspannungen – zehn Minuten reichen, um dich leichter zu fühlen.',
			},
			en: {
				titel: 'Ten minutes of stretching',
				beschreibung: 'Gentle stretching eases tension – ten minutes are enough to feel lighter.',
			},
		},
	},
	{
		key: 'koerper-5',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Kurze Pause ohne Bildschirm',
				beschreibung: 'Deine Augen dürfen ausruhen: schau aus dem Fenster und lass die Gedanken wandern.',
			},
			en: {
				titel: 'A short screen-free break',
				beschreibung: 'Your eyes deserve a rest: look out of the window and let your thoughts wander.',
			},
		},
	},
	// ── Säule 2: Mentale Gesundheit ──
	{
		key: 'mental-1',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Fünf Minuten bewusst atmen',
				beschreibung: 'Setz dich bequem hin und atme fünfmal tief ein und aus – das nimmt den Druck von heute.',
			},
			en: {
				titel: 'Breathe consciously for five minutes',
				beschreibung: 'Sit comfortably and take five slow breaths in and out – it eases the pressure of today.',
			},
		},
	},
	{
		key: 'mental-2',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Drei Dankbarkeiten notieren',
				beschreibung: 'Schreib drei Dinge auf, die heute gut waren – kleine Momente zählen ausdrücklich mit.',
			},
			en: {
				titel: 'Note three things you are grateful for',
				beschreibung: 'Write down three things that were good today – small moments count, explicitly.',
			},
		},
	},
	{
		key: 'mental-3',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Eine kurze Achtsamkeitspause',
				beschreibung: 'Ein paar Minuten achtsam sein ist keine verlorene Zeit, sondern eine Pause, die trägt.',
			},
			en: {
				titel: 'A short mindfulness pause',
				beschreibung: 'A few mindful minutes are not wasted time but a pause that carries you.',
			},
		},
	},
	{
		key: 'mental-4',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Drei Sätze ins Tagebuch',
				beschreibung: 'Schreib auf, was dich heute beschäftigt – auf Papier darf sein, was da ist.',
			},
			en: {
				titel: 'Three sentences in your journal',
				beschreibung: 'Write down what is on your mind today – on paper, whatever is there is allowed.',
			},
		},
	},
	{
		key: 'mental-5',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Eine Stunde ohne Handy',
				beschreibung: 'Eine Auszeit vom Bildschirm schenkt dir Raum – die Welt wartet geduldig.',
			},
			en: {
				titel: 'One hour without your phone',
				beschreibung: 'A break from the screen gives you room – the world will wait patiently.',
			},
		},
	},
	// ── Säule 3: Beziehungen ──
	{
		key: 'beziehungen-1',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Einer wichtigen Person schreiben',
				beschreibung: 'Ein kurzer Gruß verbindet – auch mitten in einem vollen Alltag.',
			},
			en: {
				titel: 'Write to someone who matters',
				beschreibung: 'A short greeting connects – even in the middle of a busy day.',
			},
		},
	},
	{
		key: 'beziehungen-2',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Anrufen statt tippen',
				beschreibung: 'Stimmen verbinden mehr als Nachrichten: ein kurzer Anruf reicht, um Nähe zu spüren.',
			},
			en: {
				titel: 'Call instead of typing',
				beschreibung: 'Voices connect more than messages: a brief call is enough to feel close.',
			},
		},
	},
	{
		key: 'beziehungen-3',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Gemeinsam essen',
				beschreibung: 'Eine Mahlzeit zu zweit ist Nähe im kleinsten Rahmen – lade jemanden zu etwas Einfachem ein.',
			},
			en: {
				titel: 'Share a meal',
				beschreibung: 'A meal for two is closeness in its smallest form – invite someone to something simple.',
			},
		},
	},
	{
		key: 'beziehungen-4',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Ein ehrliches Dankeschön',
				beschreibung: 'Ein aufrichtiges Danke stärkt Beziehungen: wer freut sich heute über deine Worte?',
			},
			en: {
				titel: 'Say an honest thank you',
				beschreibung: 'A sincere thank-you strengthens bonds: who would be happy about your words today?',
			},
		},
	},
	{
		key: 'beziehungen-5',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Einen gemeinsamen Moment ausmachen',
				beschreibung: 'Ein fester Termin für eine wichtige Person nimmt sich selbst ernst – trag ihn schon ein.',
			},
			en: {
				titel: 'Plan a shared moment',
				beschreibung: 'A set time for an important person takes itself seriously – put it in the calendar now.',
			},
		},
	},
	// ── Säule 4: Wirksamkeit ──
	{
		key: 'wirksamkeit-1',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Eine Mini-Aufgabe erledigen',
				beschreibung: 'Ein Schritt genügt: such dir die kleinste offene Aufgabe und lass sie heute erledigt sein.',
			},
			en: {
				titel: 'Finish one tiny task',
				beschreibung: 'One step is enough: pick the smallest open task and let it be done today.',
			},
		},
	},
	{
		key: 'wirksamkeit-2',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Zehn Minuten an einem Projekt',
				beschreibung: 'Zehn Minuten Fokus wirken Wunder – heute zählt der Anfang, nicht das Ende.',
			},
			en: {
				titel: 'Ten minutes on a project',
				beschreibung: 'Ten minutes of focus work wonders – today counts the beginning, not the end.',
			},
		},
	},
	{
		key: 'wirksamkeit-3',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Eine Ecke aufräumen',
				beschreibung: 'Ein aufgeräumter Ort macht Platz für Neues – fang mit der Ecke an, die dich stört.',
			},
			en: {
				titel: 'Clear one small corner',
				beschreibung: 'A tidy place makes room for new things – start with the corner that bothers you.',
			},
		},
	},
	{
		key: 'wirksamkeit-4',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Einen Erfolg festhalten',
				beschreibung: 'Schreib einen Erfolg von heute auf – auch kleine Siege verdienen Erinnerung.',
			},
			en: {
				titel: 'Record one win',
				beschreibung: 'Write down one success from today – small victories deserve to be remembered.',
			},
		},
	},
	{
		key: 'wirksamkeit-5',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Eine Aufgabe streichen',
				beschreibung: 'Manchmal ist Weglassen die wirksamste Tat: streich eine Aufgabe, die heute niemand braucht.',
			},
			en: {
				titel: 'Cross off one task',
				beschreibung: 'Sometimes letting go is the most effective act: cross off a task nobody needs today.',
			},
		},
	},
	// ── Säule 5: Sinn ──
	{
		key: 'sinn-1',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Ein Moment für deine Werte',
				beschreibung: 'Frag dich kurz: Was war heute wichtig für dich? Deine Antwort zeigt, worauf du baust.',
			},
			en: {
				titel: 'A moment for your values',
				beschreibung: 'Ask yourself briefly: what mattered to you today? Your answer shows what you stand on.',
			},
		},
	},
	{
		key: 'sinn-2',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Jemanden unterstützen',
				beschreibung: 'Eine kleine Hilfe verbindet dich mit etwas Größerem – biete heute jemandem deine Hilfe an.',
			},
			en: {
				titel: 'Support someone',
				beschreibung: 'A small act of help connects you to something bigger – offer your help to someone today.',
			},
		},
	},
	{
		key: 'sinn-3',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Bewusst draußen sein',
				beschreibung: 'Ein Moment in der Natur erinnert daran, wozu du gehörst – schau einmal richtig hin.',
			},
			en: {
				titel: 'Be outdoors consciously',
				beschreibung: 'A moment in nature reminds you what you belong to – take a good look.',
			},
		},
	},
	{
		key: 'sinn-4',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Eine Minute Stille',
				beschreibung: 'Eine Minute Stille ohne Ziel schenkt dir Nähe zu dir selbst – einfach da sein reicht.',
			},
			en: {
				titel: 'One minute of silence',
				beschreibung: 'A minute of silence without a goal brings you close to yourself – simply being is enough.',
			},
		},
	},
	{
		key: 'sinn-5',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Ein inspirierender Text',
				beschreibung: 'Lies ein paar Zeilen, die dich bewegen – gute Worte tragen weiter, als man denkt.',
			},
			en: {
				titel: 'An inspiring text',
				beschreibung: 'Read a few lines that move you – good words carry further than you think.',
			},
		},
	},
	// ── Erholungs-Vorlage bei Überlast (#1795): zielt auf Mentale Gesundheit; erscheint nur als
	// Überlast-Vorschlag (`PAUSE_VORLAGE_KEY`), nie als Defizit-Vorschlag der Säule. ──
	{
		key: 'pause-1',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Eine Pause einlegen',
				beschreibung: 'Gönn dir heute fünf Minuten ohne Aufgabe – danach fällt das Weitermachen oft leichter.',
			},
			en: {
				titel: 'Take a break',
				beschreibung: 'Give yourself five minutes without a task today – carrying on often feels easier afterwards.',
			},
		},
	},
];

/**
 * Generische Vorlage für Säulen ohne kuratierte Vorlagen, vor allem eigene Säulen (#2146) —
 * `{name}` ist der Platzhalter für den Säulennamen. Texte folgen dem Ton-Leitfaden
 * (`docs/fuersorge-tonalitaet.md`): warm, drängt nicht, konkret für heute.
 */
export const CARE_GENERISCH: Record<CareSprache, VorlagenText> = {
	de: {
		titel: '{name}: ein kleiner Schritt',
		beschreibung: 'Gönn dir heute einen kleinen Moment für „{name}“ – schon fünf Minuten zählen.',
	},
	en: {
		titel: '{name}: one small step',
		beschreibung: 'Give “{name}” a small moment today – even five minutes count.',
	},
};
