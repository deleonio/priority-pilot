/**
 * Dünner, fetch-basierter Mistral-Client (ESM, Node >= 22 – globales `fetch`/`AbortController`,
 * kein externes SDK). Klassifiziert einen Task anhand von Titel/Beschreibung/Kontext auf die fünf
 * Lebensbalance-Säulen und liefert je vorgeschlagener Säule eine Konfidenz (0–100).
 *
 * Der Aufruf hängt von zwei Env-Variablen ab:
 * - `MISTRAL_API_KEY` (erforderlich) – fehlt er, wird {@link MissingApiKeyError} geworfen
 *   (der Route-Handler bildet das auf HTTP 503 ab, statt zu crashen).
 * - `MISTRAL_MODEL` (optional, Default `mistral-small-latest`).
 */

/** Eine vorgeschlagene Säulen-Einzahlung: Säulen-ID plus Konfidenz in Prozent (0–100). */
export interface PillarSuggestion {
	pillarId: number;
	confidence: number;
}

/**
 * Ein gelerntes Few-Shot-Beispiel aus einer früheren Nutzer-Korrektur (Feedback-Loop, #45): der
 * damals eingegebene Titel/Beschreibung plus die vom Nutzer **bestätigten** Säulen-Beiträge.
 */
export interface FeedbackExample {
	title: string;
	description?: string;
	pillars: PillarSuggestion[];
}

/** Eingabe für die Klassifikation. `pillars` gibt die gültigen Säulen-IDs samt Namen vor. */
export interface ClassifyPillarsInput {
	title: string;
	description?: string;
	context?: string;
	pillars: { id: number; name: string; description?: string }[];
	/**
	 * Optionale, aus Nutzer-Korrekturen gelernte Beispiele. Sie werden **nach** den statischen
	 * {@link FEW_SHOT}-Beispielen als zusätzliche user/assistant-Paare in den Prompt gehängt und
	 * kalibrieren so die Vorschläge personalisiert (siehe #45). Nur Beiträge zu aktuell gültigen
	 * Säulen-IDs werden übernommen.
	 */
	examples?: FeedbackExample[];
}

/** Funktionssignatur des Klassifikators – injizierbar, damit Tests ohne echten API-Call laufen. */
export type PillarClassifier = (input: ClassifyPillarsInput) => Promise<PillarSuggestion[]>;

/**
 * Aus einem frei formulierten Text extrahierte Task-Felder (Schnellerfassung, #235). Nur `title`
 * ist Pflicht; die restlichen Felder liefert das Modell nur, wenn der Text sie hergibt.
 */
export interface ParsedTask {
	title: string;
	description?: string;
	/** Priorität 1–5 (analog zur Task-Priorität). */
	priority?: number;
	/** Geschätzter Aufwand in Personentagen (z. B. 0.25 ≈ 2 h). */
	estimatedEffort?: number;
	/** Deadline als ISO-8601-Datum/Zeit-String. */
	deadline?: string;
}

/** Funktionssignatur des Task-Text-Parsers – injizierbar, damit Tests ohne echten API-Call laufen. */
export type ParseTaskParser = (text: string) => Promise<ParsedTask>;

/** Fehlt der API-Key, ist der Dienst nicht konfiguriert → der Handler antwortet mit HTTP 503. */
export class MissingApiKeyError extends Error {
	constructor() {
		super('MISTRAL_API_KEY ist nicht gesetzt – die Säulen-Klassifikation ist nicht konfiguriert.');
		this.name = 'MissingApiKeyError';
	}
}

/** Upstream-Fehler (HTTP-Fehlerstatus, Timeout, unlesbare/ungültige Antwort) → der Handler mappt auf 502. */
export class MistralRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MistralRequestError';
	}
}

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';
const REQUEST_TIMEOUT_MS = 30_000;
/**
 * Konfidenz-Obergrenze für die „weichen“ Säulen: Laut #39 sind Körper/Beziehungen/Wirksamkeit
 * zuverlässig aus dem Text ableitbar, Sinn/Mentale Gesundheit nur ein schwaches Signal – deren
 * Konfidenz wird daher gedeckelt, auch falls das Modell sie zu selbstbewusst einschätzt.
 */
const WEAK_SIGNAL_CONFIDENCE_CEILING = 60;
const WEAK_SIGNAL_PILLARS = ['Sinn', 'Mentale Gesundheit'];

/** System-Prompt: feste Rubrik der fünf Säulen + Ausgabeformat (reines JSON). */
const SYSTEM_PROMPT = [
	'Du klassifizierst Aufgaben (Tasks) eines Lebensbalance-Tools auf fünf feste Säulen und schätzt je Säule,',
	'wie sicher die Aufgabe auf sie einzahlt (Konfidenz 0–100).',
	'',
	'Rubrik der fünf Säulen:',
	'- "Körper": Leiblichkeit – biopsychologische Basis wie Schlaf, Ernährung und Bewegung, die hormonell und neuronal die Resilienz steuern.',
	'- "Mentale Gesundheit": Emotionsregulation – kognitive Flexibilität und Affektregulation, z. B. durch Techniken wie Achtsamkeit, um in die innere Homöostase zurückzukehren.',
	'- "Beziehungen": Bindung – sichere, wertungsfreie Räume für emotionale Resonanz und Zugehörigkeit, vollständig entkoppelt von eigener Leistung.',
	'- "Wirksamkeit": Selbstwirksamkeit – aktives Gestalten der Umwelt durch Arbeit, Projekte oder Output, um Kompetenz zu erleben.',
	'- "Sinn": Transzendenz & Werte – das existenzielle „Wofür“, das Handeln in einen größeren, wertorientierten Kontext einordnet.',
	'',
	'Hinweise zur Konfidenz:',
	'- Körper, Beziehungen und Wirksamkeit lassen sich meist zuverlässig erkennen → hohe Konfidenz möglich.',
	`- Sinn und Mentale Gesundheit sind nur ein schwaches Signal → Konfidenz höchstens ${WEAK_SIGNAL_CONFIDENCE_CEILING}.`,
	'- Nenne nur Säulen, auf die die Aufgabe plausibel einzahlt. Passt keine, gib eine leere Liste zurück.',
	'',
	'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
	'{ "pillars": [ { "pillarId": <ganzzahl>, "confidence": <0-100> } ] }',
	'Verwende nur die pillarId-Werte aus der vom Nutzer übergebenen Säulen-Liste.',
].join('\n');

/**
 * Few-Shot-Beispiele, damit das Modell Format und Konfidenz-Niveau übernimmt. Die Säulen werden über
 * ihren **Namen** referenziert (nicht über hartkodierte IDs) und erst in {@link fewShotMessages} gegen
 * die real injizierte Säulen-Liste aufgelöst – so passen die Beispiel-IDs immer zur Seed-Reihenfolge.
 */
const FEW_SHOT = [
	{
		title: 'Dreimal pro Woche joggen gehen',
