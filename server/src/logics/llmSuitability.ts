/**
 * KI-Eignung von Aufgaben (#2349): Schlüsselwort-Heuristik ohne LLM-Aufruf, ohne Persistenz.
 * Erkennt „Vorarbeit"-Aufgaben (Entwerfen, Zusammenfassen, Recherchieren) in den zehn App-Sprachen
 * (de, en, es, fr, it, nl, pl, pt, ru, sv) an Verb-Stämmen im Titel bzw. der Beschreibung.
 */

export type LlmSuitability = 'draft' | 'summary' | 'research';

/** Wortanfang statt `\b` — `\b` kennt keine Nicht-ASCII-Buchstaben (ä, é, ł, кириллица). */
const START = '(?<!\\p{L})';

const rx = (pattern: string): RegExp => new RegExp(`${START}(?:${pattern})`, 'iu');

const SUMMARY = rx(
	[
		'zusammenfass',
		'summar',
		'r[eé]sum(?:er|ir|ar|en)',
		'riassum',
		'samenvat',
		'stre[sś]c[iź]|streszcz',
		'кратко|резюмир|суммир|пересказ|конспект',
		'sammanfatt',
	].join('|'),
);

const RESEARCH = rx(
	[
		'recherch|herausfind|vergleich',
		'research|look up|find out|investigat|compar',
		'investig|averigu|comparar',
		'chercher|renseign|comparer',
		'cercare|ricerc|confront',
		'opzoek|onderzoek|zoek .* uit|vergelijk',
		'wyszuk|zbada|por[oó]wn',
		'pesquis|comparar',
		'найти информац|исследова|изучить|сравни',
		'undersök|utred|ta reda på|jämför',
	].join('|'),
);

/** Eindeutige Entwurfs-Verben. */
const DRAFT_STRONG = rx(
	[
		'entwerf|entwirf|entwürf|verfass|formulier|aufsetz',
		'draft|compose',
		'redact|redacci',
		'r[eé]dig|redig',
		'formuleer|concept',
		'sformu[lł]uj|przygotuj .* tekst',
		'сформулир|подготовить текст',
		'formulera|utforma|avfatta',
	].join('|'),
);

/** Allgemeine Schreib-Verben — nur zusammen mit einem Schriftstück-Substantiv ein Entwurf. */
const DRAFT_WEAK_VERB = rx(
	'schreib|write|escrib|écri|ecri|scriv|schrijf|opstell|napisa|pisa[cć]|escrev|написа|составить|состав[ие]|skriv',
);
const DRAFT_DOCUMENT = rx(
	'e-?mail|e-?post|brief|letter|carta|correo|lettre|courrier|lettera|antrag|pism|wniosek|письм|заявлен|brev|ansökan|meddelande',
);

/**
 * Ordnet eine Aufgabe einer KI-Eignungs-Kategorie zu; `null` heißt „kein Vorarbeit-Charakter".
 * Rein und synchron — der Aufrufer entscheidet über das Paketmerkmal `ai_assist`.
 */
export const classifyLlmSuitability = (title: string, description?: string | null): LlmSuitability | null => {
	const text = `${title} ${description ?? ''}`.trim();
	if (text === '') {
		return null;
	}
	if (SUMMARY.test(text)) {
		return 'summary';
	}
	if (RESEARCH.test(text)) {
		return 'research';
	}
	if (DRAFT_STRONG.test(text) || (DRAFT_WEAK_VERB.test(text) && DRAFT_DOCUMENT.test(text))) {
		return 'draft';
	}
	return null;
};
