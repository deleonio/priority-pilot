/**
 * Dünner, fetch-basierter Mistral-Client (ESM, Node >= 22 — globales `fetch`/`AbortController`,
 * kein externes SDK). Klassifiziert einen Task anhand von Titel/Beschreibung/Kontext auf die fünf
 * Lebensbalance-Säulen und liefert je vorgeschlagener Säule eine Konfidenz (0–100).
 *
 * Der Aufruf hängt von zwei Env-Variablen ab:
 * - `MISTRAL_API_KEY` (erforderlich) — fehlt er, wird {@link MissingApiKeyError} geworfen
 *   (der Route-Handler bildet das auf HTTP 503 ab, statt zu crashen).
 * - `MISTRAL_MODEL` (optional, Default `mistral-small-latest`).
 */

/** Eine vorgeschlagene Säulen-Einzahlung: Säulen-ID plus Konfidenz in Prozent (0–100). */
export interface PillarSuggestion {
	pillarId: number;
	confidence: number;
}

/** Eingabe für die Klassifikation. `pillars` gibt die gültigen Säulen-IDs samt Namen vor. */
export interface ClassifyPillarsInput {
	title: string;
	description?: string;
	context?: string;
	pillars: { id: number; name: string }[];
}

/** Funktionssignatur des Klassifikators — injizierbar, damit Tests ohne echten API-Call laufen. */
export type PillarClassifier = (input: ClassifyPillarsInput) => Promise<PillarSuggestion[]>;

/** Fehlt der API-Key, ist der Dienst nicht konfiguriert → der Handler antwortet mit HTTP 503. */
export class MissingApiKeyError extends Error {
	constructor() {
		super('MISTRAL_API_KEY ist nicht gesetzt — die Säulen-Klassifikation ist nicht konfiguriert.');
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
 * Konfidenz-Obergrenze für die „weichen" Säulen: Laut #39 sind Körper/Beziehungen/Wirksamkeit
 * zuverlässig aus dem Text ableitbar, Sinn/Mentale Gesundheit nur ein schwaches Signal — deren
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
	'- "Körper": körperliche Gesundheit, Bewegung, Sport, Ernährung, Schlaf, Arzt/Vorsorge.',
	'- "Beziehungen": Familie, Freunde, Partnerschaft, soziale Kontakte, gemeinsame Zeit.',
	'- "Wirksamkeit": Beruf, Projekte, Lernen, Kompetenzen, Dinge erledigen, sichtbarer Output.',
	'- "Sinn": Werte, Lebensziele, Spiritualität, Ehrenamt, das „Wofür".',
	'- "Mentale Gesundheit": Stressabbau, Ruhe, Achtsamkeit, Emotionen, psychisches Wohlbefinden.',
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

/** Few-Shot-Beispiele, damit das Modell Format und Konfidenz-Niveau übernimmt. */
const FEW_SHOT = [
	{
		title: 'Dreimal pro Woche joggen gehen',
		description: 'Ausdauer aufbauen und morgens 5 km laufen.',
		pillars: [{ pillarId: 1, confidence: 95 }],
	},
	{
		title: 'Wochenende mit den Eltern verbringen',
		description: 'Besuch über zwei Tage, gemeinsam kochen.',
		pillars: [
			{ pillarId: 2, confidence: 90 },
			{ pillarId: 4, confidence: 40 },
		],
	},
	{
		title: 'Zertifizierung für Cloud-Architektur abschließen',
		description: 'Lernen und Prüfung ablegen.',
		pillars: [
			{ pillarId: 3, confidence: 92 },
			{ pillarId: 4, confidence: 35 },
		],
	},
] as const;

/** Begrenzt einen Wert auf [0, 100] und rundet auf eine Ganzzahl (NaN → 0). */
const clampConfidence = (value: unknown): number => {
	const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
	return Math.min(100, Math.max(0, Math.round(numeric)));
};

/** Baut die Nutzer-Nachricht aus Task-Daten und gültiger Säulen-Liste. */
const buildUserMessage = (input: ClassifyPillarsInput): string => {
	const pillarList = input.pillars.map((pillar) => `  - pillarId ${pillar.id}: ${pillar.name}`).join('\n');
	const lines = [
		'Gültige Säulen (nur diese pillarId-Werte verwenden):',
		pillarList,
		'',
		'Aufgabe:',
		`- Titel: ${input.title}`,
	];
	if (input.description) {
		lines.push(`- Beschreibung: ${input.description}`);
	}
	if (input.context) {
		lines.push(`- Kontext (abhängige Aufgaben): ${input.context}`);
	}
	return lines.join('\n');
};

/** Wandelt die Few-Shot-Beispiele in abwechselnde user/assistant-Nachrichten. */
const fewShotMessages = (pillars: { id: number; name: string }[]): { role: string; content: string }[] =>
	FEW_SHOT.flatMap((example) => [
		{
			role: 'user',
			content: buildUserMessage({ title: example.title, description: example.description, pillars }),
		},
		{ role: 'assistant', content: JSON.stringify({ pillars: example.pillars }) },
	]);

/**
 * Liest aus der (bereits geparsten) Modell-Antwort die Säulen-Vorschläge: nur bekannte `pillarId`,
 * dublettenfrei, Konfidenz auf [0,100] geclamped und für die schwachen Säulen zusätzlich gedeckelt.
 */
const extractSuggestions = (parsed: unknown, input: ClassifyPillarsInput): PillarSuggestion[] => {
	if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { pillars?: unknown }).pillars)) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format ({ pillars: [...] }).');
	}
	const validIds = new Map(input.pillars.map((pillar) => [pillar.id, pillar.name]));
	const ceilingPillarIds = new Set(
		input.pillars.filter((pillar) => WEAK_SIGNAL_PILLARS.includes(pillar.name)).map((pillar) => pillar.id),
	);

	const suggestions: PillarSuggestion[] = [];
	const seen = new Set<number>();
	for (const raw of (parsed as { pillars: unknown[] }).pillars) {
		if (typeof raw !== 'object' || raw === null) {
			continue;
		}
		const { pillarId } = raw as Record<string, unknown>;
		if (typeof pillarId !== 'number' || !Number.isInteger(pillarId) || !validIds.has(pillarId) || seen.has(pillarId)) {
			continue;
		}
		let confidence = clampConfidence((raw as Record<string, unknown>).confidence);
		if (ceilingPillarIds.has(pillarId)) {
			confidence = Math.min(confidence, WEAK_SIGNAL_CONFIDENCE_CEILING);
		}
		seen.add(pillarId);
		suggestions.push({ pillarId, confidence });
	}
	return suggestions.sort((a, b) => a.pillarId - b.pillarId);
};

/** Extrahiert den JSON-String aus der Chat-Completion-Antwort und parst ihn defensiv. */
const parseModelContent = (payload: unknown): unknown => {
	const content = (payload as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
	if (typeof content !== 'string') {
		throw new MistralRequestError('Antwort des Modells enthielt keinen Text.');
	}
	try {
		return JSON.parse(content);
	} catch {
		throw new MistralRequestError('Antwort des Modells war kein gültiges JSON.');
	}
};

/**
 * Realer Klassifikator: ruft die Mistral-Chat-Completions-API auf. Wirft {@link MissingApiKeyError},
 * wenn kein API-Key gesetzt ist, und {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
export const classifyPillarsWithMistral: PillarClassifier = async (input) => {
	const apiKey = process.env.MISTRAL_API_KEY;
	if (!apiKey) {
		throw new MissingApiKeyError();
	}
	const model = process.env.MISTRAL_MODEL ?? DEFAULT_MODEL;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(MISTRAL_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				temperature: 0,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					...fewShotMessages(input.pillars),
					{ role: 'user', content: buildUserMessage(input) },
				],
			}),
			signal: controller.signal,
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unbekannter Fehler';
		throw new MistralRequestError(`Mistral-Anfrage fehlgeschlagen: ${reason}`);
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		throw new MistralRequestError(`Mistral antwortete mit HTTP ${response.status}.`);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new MistralRequestError('Mistral-Antwort konnte nicht als JSON gelesen werden.');
	}

	return extractSuggestions(parseModelContent(payload), input);
};
