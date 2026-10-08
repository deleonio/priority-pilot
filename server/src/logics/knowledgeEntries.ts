/**
 * Relevanzfilter der Wissens-Einträge (#1936 AK3): deterministisch, ohne zweiten LLM-Aufruf. Ein
 * Eintrag passt, wenn eines seiner Wörter mit einem Wort aus Titel, Beschreibung, Kontext oder einem
 * Säulennamen in den ersten 5 Zeichen übereinstimmt; kürzere Wörter müssen bis zu ihrer Länge
 * übereinstimmen („Hund“/„Hundeschule“).
 */

/** Höchstzahl der Einträge, die ein Aufruf an den Klassifikator weitergibt. */
const MAX_RELEVANT_KNOWLEDGE = 10;

const PREFIX_LENGTH = 5;
const MIN_WORD_LENGTH = 4;

const STOP_WORDS = new Set([
	'aber',
	'alle',
	'auch',
	'dass',
	'dein',
	'deine',
	'denn',
	'dies',
	'diese',
	'doch',
	'eine',
	'einem',
	'einen',
	'einer',
	'eines',
	'etwas',
	'habe',
	'haben',
	'immer',
	'mein',
	'meine',
	'meinem',
	'meinen',
	'meiner',
	'mich',
	'nach',
	'nicht',
	'noch',
	'oder',
	'schon',
	'sehr',
	'sein',
	'seine',
	'sich',
	'sind',
	'über',
	'unter',
	'wenn',
	'werden',
	'wird',
]);

const wordsOf = (text: string): string[] =>
	text
		.toLowerCase()
		.split(/[^\p{L}]+/u)
		.filter((word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word));

const related = (a: string, b: string): boolean => {
	const length = Math.min(PREFIX_LENGTH, a.length, b.length);
	return a.slice(0, length) === b.slice(0, length);
};

export interface KnowledgeContext {
	title: string;
	description?: string;
	context?: string;
	pillars: { id: number; name: string }[];
}

/** Die zum Kontext passenden Einträge in Eingabereihenfolge, höchstens {@link MAX_RELEVANT_KNOWLEDGE}. */
export const selectRelevantKnowledge = <T extends { id: number; text: string }>(
	entries: readonly T[],
	context: KnowledgeContext,
): T[] => {
	const contextWords = wordsOf(
		[context.title, context.description ?? '', context.context ?? '', ...context.pillars.map((p) => p.name)].join(' '),
	);
	return entries
		.filter((entry) => wordsOf(entry.text).some((word) => contextWords.some((other) => related(word, other))))
		.slice(0, MAX_RELEVANT_KNOWLEDGE);
};
