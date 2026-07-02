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
	pillars: { id: number; name: string }[];
	/**
	 * Optionale, aus Nutzer-Korrekturen gelernte Beispiele. Sie werden **nach** den statischen
	 * {@link FEW_SHOT}-Beispielen als zusätzliche user/assistant-Paare in den Prompt gehängt und
	 * kalibrieren so die Vorschläge personalisiert (siehe #45). Nur Beiträge zu aktuell gültigen
	 * Säulen-IDs werden übernommen.
	 */
	examples?: FeedbackExample[];
}

/** Funktionssignatur des Klassifikators — injizierbar, damit Tests ohne echten API-Call laufen. */
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

/** Funktionssignatur des Task-Text-Parsers — injizierbar, damit Tests ohne echten API-Call laufen. */
export type ParseTaskParser = (text: string) => Promise<ParsedTask>;

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

/**
 * Few-Shot-Beispiele, damit das Modell Format und Konfidenz-Niveau übernimmt. Die Säulen werden über
 * ihren **Namen** referenziert (nicht über hartkodierte IDs) und erst in {@link fewShotMessages} gegen
 * die real injizierte Säulen-Liste aufgelöst — so passen die Beispiel-IDs immer zur Seed-Reihenfolge.
 */
const FEW_SHOT = [
	{
		title: 'Dreimal pro Woche joggen gehen',
		description: 'Ausdauer aufbauen und morgens 5 km laufen.',
		pillars: [{ name: 'Körper', confidence: 95 }],
	},
	{
		title: 'Wochenende mit den Eltern verbringen',
		description: 'Besuch über zwei Tage, gemeinsam kochen.',
		pillars: [
			{ name: 'Beziehungen', confidence: 90 },
			{ name: 'Mentale Gesundheit', confidence: 40 },
		],
	},
	{
		title: 'Zertifizierung für Cloud-Architektur abschließen',
		description: 'Lernen und Prüfung ablegen.',
		pillars: [
			{ name: 'Wirksamkeit', confidence: 92 },
			{ name: 'Mentale Gesundheit', confidence: 35 },
		],
	},
] as const;

/** Begrenzt einen Wert auf [0, 100] und rundet auf eine Ganzzahl (NaN → 0). */
const clampConfidence = (value: unknown): number => {
	const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
	return Math.min(100, Math.max(0, Math.round(numeric)));
};

/** Bestimmt die pillarIds der „weichen" Säulen (Sinn / Mentale Gesundheit) aus der gültigen Säulen-Liste. */
const weakSignalPillarIds = (pillars: { id: number; name: string }[]): Set<number> =>
	new Set(pillars.filter((pillar) => WEAK_SIGNAL_PILLARS.includes(pillar.name)).map((pillar) => pillar.id));

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

/**
 * Wandelt die Few-Shot-Beispiele in abwechselnde user/assistant-Nachrichten. Die in den Beispielen
 * über den Namen referenzierten Säulen werden gegen die übergebene Säulen-Liste zu deren realen IDs
 * aufgelöst; nicht vorhandene Namen werden übersprungen, damit die Beispiel-Antworten immer nur
 * gültige, zur Seed-Reihenfolge passende `pillarId`-Werte enthalten.
 */
const fewShotMessages = (pillars: { id: number; name: string }[]): { role: string; content: string }[] => {
	const idByName = new Map(pillars.map((pillar) => [pillar.name, pillar.id]));
	return FEW_SHOT.flatMap((example) => {
		const resolved: PillarSuggestion[] = [];
		for (const { name, confidence } of example.pillars) {
			const pillarId = idByName.get(name);
			if (pillarId !== undefined) {
				resolved.push({ pillarId, confidence });
			}
		}
		return [
			{
				role: 'user',
				content: buildUserMessage({ title: example.title, description: example.description, pillars }),
			},
			{ role: 'assistant', content: JSON.stringify({ pillars: resolved }) },
		];
	});
};

/**
 * Wandelt die aus Nutzer-Korrekturen gelernten Beispiele in user/assistant-Paare. Anders als die
 * statischen {@link FEW_SHOT}-Beispiele referenzieren sie die Säulen direkt über `pillarId`; Beiträge
 * zu nicht (mehr) gültigen Säulen werden verworfen, ebenso Beispiele ohne verbleibende Säule
 * (kein leeres `{ pillars: [] }`-Sample, das das Modell zur Enthaltung verleiten würde). Die Konfidenz
 * der schwachen Säulen wird — analog zu {@link extractSuggestions} — auf das Ceiling gedeckelt, damit
 * eine vom Nutzer bestätigte Säule (oft `confidence: 100`) das In-Context-Signal nicht über die
 * System-Prompt-Regel „Sinn/Mentale Gesundheit ≤ Ceiling" hinaus hochzieht (siehe #45).
 *
 * Bewusste Entscheidung (Kreuzverhör #67): Das Ceiling gilt **auch** für gelernte (= bestätigte)
 * Beispiele, nicht nur für rohe Modellausgaben. Begründung, warum die Zielsäulen aus #45 trotzdem
 * profitieren:
 * 1. Der Hebel des Feedback-Loops für Sinn / Mentale Gesundheit ist primär die gelernte
 *    Assoziation Titel→Säule (welche Aufgaben überhaupt auf diese Säulen einzahlen) — die
 *    vermittelt das Few-Shot-Paar auch bei gedeckelter Konfidenz.
 * 2. Die im Frontend manuell ergänzten Säulen erhalten dort den UI-Default `confidence: 100`
 *    (`TaskFormModal`), also einen nicht kalibrierten Wert. Ihn als autoritatives Signal in
 *    den Prompt zu heben, würde Rauschen statt Kalibrierung einspeisen.
 * 3. Ein ungedeckeltes In-Context-Signal stünde im direkten Widerspruch zur System-Prompt-Regel und
 *    zu {@link extractSuggestions}; widersprüchliche Signale verschlechtern die Konsistenz mehr, als
 *    ein höherer Cap nützt. Soll sich diese Annahme ändern, ist hier der eine Ort zum Lockern.
 */
const feedbackMessages = (input: ClassifyPillarsInput): { role: string; content: string }[] => {
	const validIds = new Set(input.pillars.map((pillar) => pillar.id));
	const ceilingPillarIds = weakSignalPillarIds(input.pillars);
	return (input.examples ?? []).flatMap((example) => {
		const resolved = example.pillars
			.filter((entry) => validIds.has(entry.pillarId))
			.map((entry) => {
				const clamped = clampConfidence(entry.confidence);
				const confidence = ceilingPillarIds.has(entry.pillarId)
					? Math.min(clamped, WEAK_SIGNAL_CONFIDENCE_CEILING)
					: clamped;
				return { pillarId: entry.pillarId, confidence };
			});
		if (resolved.length === 0) {
			return [];
		}
		return [
			{
				role: 'user',
				content: buildUserMessage({ title: example.title, description: example.description, pillars: input.pillars }),
			},
			{ role: 'assistant', content: JSON.stringify({ pillars: resolved }) },
		];
	});
};

/**
 * Liest aus der (bereits geparsten) Modell-Antwort die Säulen-Vorschläge: nur bekannte `pillarId`,
 * dublettenfrei, Konfidenz auf [0,100] geclamped und für die schwachen Säulen zusätzlich gedeckelt.
 */
const extractSuggestions = (parsed: unknown, input: ClassifyPillarsInput): PillarSuggestion[] => {
	if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { pillars?: unknown }).pillars)) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format ({ pillars: [...] }).');
	}
	const validIds = new Map(input.pillars.map((pillar) => [pillar.id, pillar.name]));
	const ceilingPillarIds = weakSignalPillarIds(input.pillars);

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
					...feedbackMessages(input),
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

/** System-Prompt für die Task-Schnellerfassung: extrahiert strukturierte Felder aus Freitext. */
const PARSE_TASK_SYSTEM_PROMPT = [
	'Du extrahierst aus einem frei formulierten deutschen Text die strukturierten Felder einer Aufgabe (Task).',
	'',
	'Gib genau diese Felder zurück (nur was der Text hergibt):',
	'- "title" (Pflicht): kurzer, prägnanter Titel der Aufgabe.',
	'- "description" (optional): ergänzende Details, falls im Text vorhanden.',
	'- "priority" (optional): Ganzzahl 1–5 (1 = niedrig, 3 = mittel, 5 = hoch), falls eine Priorität genannt/erkennbar ist.',
	'- "estimatedEffort" (optional): geschätzter Aufwand in Personentagen als Dezimalzahl (z. B. 2 Stunden ≈ 0.25).',
	'- "deadline" (optional): Fälligkeitsdatum als ISO-8601-String (z. B. "2026-07-31T00:00:00.000Z"), falls ein Datum genannt ist.',
	'',
	'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
	'{ "title": <string>, "description": <string?>, "priority": <1-5?>, "estimatedEffort": <zahl?>, "deadline": <iso-string?> }',
	'Lasse optionale Felder weg, wenn der Text keine Angabe dazu enthält.',
].join('\n');

/** Liest aus der (bereits geparsten) Modell-Antwort die Task-Felder defensiv aus. */
const extractParsedTask = (parsed: unknown): ParsedTask => {
	if (typeof parsed !== 'object' || parsed === null) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format (Objekt erwartet).');
	}
	const raw = parsed as Record<string, unknown>;
	if (typeof raw.title !== 'string' || raw.title.trim() === '') {
		throw new MistralRequestError('Antwort des Modells enthielt keinen gültigen title.');
	}
	const result: ParsedTask = { title: raw.title.trim() };
	if (typeof raw.description === 'string' && raw.description.trim() !== '') {
		result.description = raw.description.trim();
	}
	if (typeof raw.priority === 'number' && Number.isFinite(raw.priority)) {
		result.priority = Math.min(5, Math.max(1, Math.round(raw.priority)));
	}
	if (typeof raw.estimatedEffort === 'number' && Number.isFinite(raw.estimatedEffort) && raw.estimatedEffort >= 0) {
		result.estimatedEffort = raw.estimatedEffort;
	}
	if (typeof raw.deadline === 'string' && raw.deadline.trim() !== '') {
		const d = new Date(raw.deadline.trim());
		if (!isNaN(d.getTime())) {
			result.deadline = d.toISOString();
		}
	}
	return result;
};

/**
 * Realer Task-Text-Parser: ruft die Mistral-Chat-Completions-API auf und extrahiert strukturierte
 * Task-Felder aus Freitext (Schnellerfassung, #235). Wirft {@link MissingApiKeyError}, wenn kein
 * API-Key gesetzt ist, und {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
export const parseTaskTextWithMistral: ParseTaskParser = async (text) => {
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
					{ role: 'system', content: PARSE_TASK_SYSTEM_PROMPT },
					{ role: 'user', content: text },
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

	return extractParsedTask(parseModelContent(payload));
};
