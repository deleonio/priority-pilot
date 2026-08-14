/**
 * Dünner, fetch-basierter LLM-Client (ESM, Node >= 22 — globales `fetch`/`AbortController`,
 * kein externes SDK). Spricht die OpenAI-kompatible Chat-Completions-API an.
 *
 * **Kaskade:** Jede Anfrage geht zuerst an Mistral (Primär-Call). Ist ein OpenRouter-Key
 * konfiguriert, bekommt OpenRouter Mistral's Antwort als Kontext und verfeinert sie
 * (Zweitmeinung). Fällt ein Provider aus, liefert der andere allein das Ergebnis. Fällt
 * alles aus, wirft die Kaskade {@link MistralRequestError} (→ HTTP 502).
 *
 * Env-Variablen:
 * - `MISTRAL_API_KEY` (optional einzeln, Pflicht für die Kaskade), `MISTRAL_MODEL` (Default `mistral-medium-latest`)
 * - `OPENROUTER_API_KEY` (optional einzeln, aktiviert die Verfeinerungs-Stufe), `OPENROUTER_MODEL` (Default Free-Modell),
 *   `OPENROUTER_API_URL` (Default `https://openrouter.ai/api/v1`)
 * - Kein Key überhaupt → {@link MissingApiKeyError} (→ HTTP 503).
 *
 * Seit #640 sind Keys/Modell zusätzlich über `PUT /llm-config` persistierbar. Eine gesetzte
 * DB-Konfiguration hat Vorrang, die Env-Variablen bleiben Fallback (siehe
 * {@link loadEffectiveLlmConfig}).
 */

import { LlmConfig } from '../models/index.js';

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
	constructor(providerLabel = 'Mistral', envVar = 'MISTRAL_API_KEY') {
		super(`${envVar} ist nicht gesetzt — der LLM-Provider (${providerLabel}) ist nicht konfiguriert.`);
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

/** Konfiguration eines LLM-Providers — Endpoint, Auth, Modell und Label für Fehlermeldungen. */
interface ProviderConfig {
	endpoint: string;
	apiKey: string | undefined;
	model: string;
	label: string;
}

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-medium-latest';
/** Default-Modell der OpenRouter-Stufe — zugleich der Anzeige-Default von `GET /llm-config` (#640). */
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
const REQUEST_TIMEOUT_MS = 30_000;

/** Die konfigurierbaren Felder der Kaskade (#640) — leerer String bedeutet „nicht gesetzt". */
export interface EffectiveLlmConfig {
	mistralApiKey: string;
	openrouterApiKey: string;
	openrouterModel: string;
}

/**
 * Effektive Kaskaden-Konfiguration (#640): Werte aus der persistierten `llm_configs`-Zeile haben
 * Vorrang, leere/fehlende Werte fallen auf die Env-Variablen zurück. Existiert die Tabelle noch
 * nicht (Unit-Tests ohne DB-Sync, frischer Prozess vor `sequelize.sync()`), gilt ebenfalls der
 * Env-Fallback — die Kaskade darf daran nicht scheitern.
 */
export const loadEffectiveLlmConfig = async (): Promise<EffectiveLlmConfig> => {
	let stored: LlmConfig | null;
	try {
		stored = await LlmConfig.findOne({ order: [['id', 'ASC']] });
	} catch {
		stored = null;
	}
	return {
		mistralApiKey: stored?.mistralApiKey || (process.env.MISTRAL_API_KEY ?? ''),
		openrouterApiKey: stored?.openrouterApiKey || (process.env.OPENROUTER_API_KEY ?? ''),
		openrouterModel: stored?.openrouterModel || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
	};
};

/** Mistral-Config aus der effektiven Konfiguration (DB vor Env). */
function getMistralConfig(effective: EffectiveLlmConfig): ProviderConfig {
	return {
		endpoint: MISTRAL_ENDPOINT,
		apiKey: effective.mistralApiKey || undefined,
		model: process.env.MISTRAL_MODEL ?? DEFAULT_MISTRAL_MODEL,
		label: 'Mistral',
	};
}

/**
 * OpenRouter-Config aus der effektiven Konfiguration (DB vor Env). Die Basis-URL bleibt über
 * `OPENROUTER_API_URL` konfigurierbar (#651); Key und Modell kommen aus der effektiven Config,
 * die persistierte DB-Werte vorzieht (#640). `loadEffectiveLlmConfig` deckt bewusst nur Key und
 * Modell — nicht die Endpoint-URL —, da `/llm-config` ausschließlich Key/Modell persistiert.
 */
function getOpenRouterConfig(effective: EffectiveLlmConfig): ProviderConfig {
	const baseUrl = (process.env.OPENROUTER_API_URL ?? DEFAULT_OPENROUTER_API_URL).replace(/\/+$/, '');
	return {
		endpoint: `${baseUrl}/chat/completions`,
		apiKey: effective.openrouterApiKey || undefined,
		model: effective.openrouterModel,
		label: 'OpenRouter',
	};
}

/**
 * Verfeinerungs-Anweisung für den zweiten Kaskaden-Schritt (OpenRouter). Wird als `user`-Message
 * nach Mistral's Antwort angehängt, damit OpenRouter die erste Antwort als Zweitmeinung optimiert.
 */
const REFINEMENT_PROMPT =
	'Ein anderes Modell hat die obige Antwort generiert. Überprüfe und optimiere sie: ' +
	'korrigiere Fehler, mache die Zuordnungen präziser, ergänze Aspekte, die das erste Modell ' +
	'übersehen haben könnte. Behalte exakt das gleiche JSON-Format bei.';
/**
 * Konfidenz-Obergrenze für die „weichen" Säulen: Laut #39 sind Körper/Beziehungen/Wirksamkeit
 * zuverlässig aus dem Text ableitbar, Sinn/Mentale Gesundheit nur ein schwaches Signal — deren
 * Konfidenz wird daher gedeckelt, auch falls das Modell sie zu selbstbewusst einschätzt.
 */
const WEAK_SIGNAL_CONFIDENCE_CEILING = 60;
const WEAK_SIGNAL_PILLARS = ['Sinn', 'Mentale Gesundheit'];

/**
 * Baut den System-Prompt dynamisch aus den übergebene Säulen-Beschreibungen.
 * Die Beschreibungen stammen aus der Datenbank (SEED_PILLARS) und fließen so automatisch ein.
 */
const buildSystemPrompt = (pillars: { id: number; name: string; description?: string }[]): string => {
	const pillarDescriptions = pillars
		.map((pillar) => {
			const desc = pillar.description ?? '';
			return `- "${pillar.name}": ${desc}`;
		})
		.join('\n');

	return [
		'Du klassifizierst Aufgaben (Tasks) eines Lebensbalance-Tools auf fünf feste Säulen und schätzt je Säule,',
		'wie sicher die Aufgabe auf sie einzahlt (Konfidenz 0–100).',
		'',
		'Rubrik der fünf Säulen:',
		pillarDescriptions,
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
};

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
export const weakSignalPillarIds = (pillars: { id: number; name: string }[]): Set<number> =>
	new Set(pillars.filter((pillar) => WEAK_SIGNAL_PILLARS.includes(pillar.name)).map((pillar) => pillar.id));

/** Baut die Nutzer-Nachricht aus Task-Daten und gültiger Säulen-Liste. */
export const buildUserMessage = (input: ClassifyPillarsInput): string => {
	const pillarList = input.pillars
		.map((pillar) => {
			const base = `  - pillarId ${pillar.id}: ${pillar.name}`;
			return pillar.description ? `${base} — ${pillar.description}` : base;
		})
		.join('\n');
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
 * Einzelner API-Call an einen Provider: schickt die Nachrichten an die Chat-Completions-API
 * (JSON-Mode, Temperatur 0, Timeout) und liefert den geparsten JSON-Inhalt der Modell-Antwort.
 * Wirft {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
const callProvider = async (
	config: ProviderConfig,
	messages: { role: string; content: string }[],
): Promise<unknown> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(config.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.apiKey}`,
			},
			body: JSON.stringify({
				model: config.model,
				temperature: 0,
				response_format: { type: 'json_object' },
				messages,
			}),
			signal: controller.signal,
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unbekannter Fehler';
		throw new MistralRequestError(`${config.label}-Anfrage fehlgeschlagen: ${reason}`);
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		throw new MistralRequestError(`${config.label} antwortete mit HTTP ${response.status}.`);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new MistralRequestError(`${config.label}-Antwort konnte nicht als JSON gelesen werden.`);
	}

	return parseModelContent(payload);
};

/**
 * Kaskaden-Aufruf: Mistral zuerst (Primär), dann OpenRouter als Verfeinerung (Zweitmeinung).
 *
 * - Beide Keys → Mistral generiert, OpenRouter verfeinert mit Mistral's Antwort als Kontext.
 * - Ein Key fällt aus → der andere liefert allein das Ergebnis.
 * - Beide Keys, beide Calls failen → {@link MistralRequestError} (→ HTTP 502).
 * - Gar kein Key → {@link MissingApiKeyError} (→ HTTP 503).
 */
const requestModelJson = async (messages: { role: string; content: string }[]): Promise<unknown> => {
	const effective = await loadEffectiveLlmConfig();
	const mistral = getMistralConfig(effective);
	const openrouter = getOpenRouterConfig(effective);

	if (!mistral.apiKey && !openrouter.apiKey) {
		throw new MissingApiKeyError();
	}

	// Stage 1: Mistral (Primär-Call) — nur wenn Key konfiguriert.
	let primaryResult: unknown | undefined;
	if (mistral.apiKey) {
		try {
			primaryResult = await callProvider(mistral, messages);
		} catch {
			// Mistral ausgefallen — OpenRouter unten ggf. allein versuchen.
		}
	}

	// Stage 2: OpenRouter (Verfeinerung oder Fallback) — nur wenn Key konfiguriert.
	if (openrouter.apiKey) {
		try {
			if (primaryResult !== undefined) {
				// Verfeinerung: Original-Nachrichten + Mistral's Antwort + Optimierungs-Anweisung.
				return await callProvider(openrouter, [
					...messages,
					{ role: 'assistant', content: JSON.stringify(primaryResult) },
					{ role: 'user', content: REFINEMENT_PROMPT },
				]);
			}
			// Kein Mistral-Ergebnis — OpenRouter allein (Fallback).
			return await callProvider(openrouter, messages);
		} catch {
			if (primaryResult !== undefined) {
				return primaryResult; // OpenRouter ausgefallen → Mistral's Antwort verwenden.
			}
		}
	}

	// Nur Mistral konfiguriert (kein OpenRouter-Key) oder OpenRouter ohne Mistral ausgefallen.
	if (primaryResult !== undefined) {
		return primaryResult;
	}

	throw new MistralRequestError('Alle konfigurierten LLM-Provider sind ausgefallen.');
};

/**
 * Realer Klassifikator: ruft die LLM-Kaskade auf (Mistral → OpenRouter-Verfeinerung).
 * Wirft {@link MissingApiKeyError}, wenn kein API-Key gesetzt ist, und {@link MistralRequestError}
 * bei jedem Upstream-/Format-Problem.
 */
export const classifyPillarsWithMistral: PillarClassifier = async (input) => {
	const parsed = await requestModelJson([
		{ role: 'system', content: buildSystemPrompt(input.pillars) },
		...fewShotMessages(input.pillars),
		...feedbackMessages(input),
		{ role: 'user', content: buildUserMessage(input) },
	]);
	return extractSuggestions(parsed, input);
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
 * Realer Task-Text-Parser: ruft die LLM-Kaskade auf (Mistral → OpenRouter-Verfeinerung)
 * und extrahiert strukturierte Task-Felder aus Freitext (Schnellerfassung, #235). Wirft
 * {@link MissingApiKeyError}, wenn kein API-Key gesetzt ist, und {@link MistralRequestError}
 * bei jedem Upstream-/Format-Problem.
 */
export const parseTaskTextWithMistral: ParseTaskParser = async (text) => {
	const parsed = await requestModelJson([
		{ role: 'system', content: PARSE_TASK_SYSTEM_PROMPT },
		{ role: 'user', content: text },
	]);
	return extractParsedTask(parsed);
};

/** Ein Vorschlag des Aktivitäten-Beraters: Aktivität, Begründung und die Säulen, auf die sie einzahlt. */
export interface ActivityAdvice {
	activity: string;
	reason: string;
	pillarIds: number[];
}

/**
 * Eingabe für die Text-Lektorat-Funktion: zu lektorierender Text und optionale
 * Maximallänge (Zeichen). Ist `maxLength` gesetzt, wird der Text zusätzlich auf
 * diese Länge gekürzt (Issue #645).
 */
export interface LektoratInput {
	text: string;
	maxLength?: number;
}

/** Ergebnis der Lektorat-Funktion: lektorierter (und ggf. gekürzter) Text. */
// knip-ignore-export - Exportiert für zukünftige Nutzung (Issue #645)
export interface LektoratOutput {
	text: string;
}

/** Funktionssignatur des Lektorats — injizierbar für Tests. */
// knip-ignore-export - Exportiert für zukünftige Nutzung (Issue #645)
export type LektoratFunction = (input: LektoratInput) => Promise<LektoratOutput>;

/**
 * Ein Verteilungs-Eintrag einer Säule, so wie ihn der Client (Dashboard „Meine Themen") darstellt:
 * Soll-Anteil (`weight`, 0–100 %) und Ist-Anteil (`actualShare`, 0–1).
 */
export interface PillarDistribution {
	pillarId: number;
	/** Soll-Anteil der Säule in Prozent (0–100). */
	weight: number;
	/** Ist-Anteil der Säule (0–1), wie im Client berechnet. */
	actualShare: number;
}

/**
 * Eingabe für den Aktivitäten-Berater. `pillars` gibt die gültigen Säulen samt der kanonischen
 * Kurzbeschreibung aus den Einstellungen vor (die Rubrik kommt also aus der DB, nicht aus einem
 * hartkodierten Prompt-Text). `question` ist die optionale Frage/Situation des Nutzers.
 */
export interface AdviseActivitiesInput {
	question?: string;
	pillars: { id: number; name: string; description: string }[];
	/**
	 * Optionale, vom Client mitgeschickte Säulen-Verteilung (Soll `weight` vs. Ist `actualShare`, so
	 * wie sie im Dashboard „Meine Themen" dargestellt ist). Ist das Feld gesetzt, listet
	 * {@link buildAdvisorUserMessage} die Säulen absteigend nach Unterversorgung auf und weist das
	 * Modell an, die Vorschläge primär auf die schwächsten (am stärksten unterversorgten) Säulen
	 * auszurichten.
	 */
	distribution?: PillarDistribution[];
}

/** Funktionssignatur des Beraters — injizierbar, damit Tests ohne echten API-Call laufen. */
export type ActivityAdvisor = (input: AdviseActivitiesInput) => Promise<ActivityAdvice[]>;

/** Obergrenze der zurückgegebenen Vorschläge — hält die Antwort klein und die UI übersichtlich. */
const MAX_ADVICE_ENTRIES = 8;

/**
 * System-Prompt des Aktivitäten-Beraters. Bewusst ohne feste Säulen-Rubrik: Namen und
 * Kurzbeschreibungen der Säulen werden pro Anfrage aus den Einstellungen (DB) in die
 * Nutzer-Nachricht injiziert (siehe {@link buildAdvisorUserMessage}).
 */
const ADVISOR_SYSTEM_PROMPT = [
	'Du bist der Aktivitäten-Berater eines Lebensbalance-Tools. Der Nutzer pflegt Lebensbalance-Säulen;',
	'jede Aktivität kann auf eine oder mehrere Säulen „einzahlen".',
	'',
	'Deine Aufgabe: Schlage konkrete, alltagstaugliche Aktivitäten vor und ordne jede Aktivität den',
	'Säulen zu, auf die sie einzahlt. Maßgeblich für die Zuordnung sind ausschließlich die vom Nutzer',
	'übergebenen Säulen samt ihrer Kurzbeschreibungen.',
	'',
	'Regeln:',
	`- Gib 4 bis ${MAX_ADVICE_ENTRIES} Vorschläge zurück.`,
	'- Stellt der Nutzer eine Frage oder beschreibt eine Situation, richte die Vorschläge danach aus.',
	'- Ist eine Säulen-Verteilung mit Unterversorgung angegeben, richte die Vorschläge primär auf die schwächsten (am stärksten unterversorgten) Säulen aus.',
	'- Ohne Frage und ohne genannte Unterversorgung: Verteile die Vorschläge so, dass jede Säule mindestens einmal bedient wird.',
	'- Jede Aktivität nennt nur Säulen, auf die sie plausibel einzahlt (mindestens eine).',
	'- "reason" ist eine kurze deutsche Begründung (ein Satz), warum die Aktivität auf diese Säulen einzahlt.',
	'',
	'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
	'{ "advice": [ { "activity": <string>, "reason": <string>, "pillarIds": [<ganzzahl>] } ] }',
	'Verwende nur die pillarId-Werte aus der übergebenen Säulen-Liste.',
].join('\n');

/**
 * Relative Unterversorgung einer Säule aus Soll (`weight`, 0–100 %) und Ist (`actualShare`, 0–1):
 * `clamp((weight/100 − actualShare) / (weight/100), 0, 1)`. Je größer der Wert, desto schwächer
 * (stärker unter ihrem Soll bedient) ist die Säule. Guard: `weight ≤ 0` → 0 (keine Soll-Vorgabe,
 * kein Unterversorgungs-Signal, kein `NaN`).
 */
const relativeUndersupply = (weight: number, actualShare: number): number => {
	const soll = weight / 100;
	return soll <= 0 ? 0 : Math.min(1, Math.max(0, (soll - actualShare) / soll));
};

/**
 * Baut die Nutzer-Nachricht des Beraters: Säulen-Rubrik aus den Einstellungen + optionale Frage.
 * Liegt eine Säulen-Verteilung vor (`distribution`, so wie sie im Client dargestellt ist), werden die
 * Säulen absteigend nach Unterversorgung (Soll − Ist) aufgelistet und das Modell wird angewiesen, die
 * Vorschläge primär auf die schwächsten (am stärksten unterversorgten) Säulen auszurichten.
 * Exportiert, damit die Durchreichung isoliert testbar ist.
 */
export const buildAdvisorUserMessage = (input: AdviseActivitiesInput): string => {
	const pillarList = input.pillars
		.map((pillar) => `  - pillarId ${pillar.id}: ${pillar.name} — ${pillar.description}`)
		.join('\n');
	const lines = ['Säulen (nur diese pillarId-Werte verwenden):', pillarList, ''];
	if (input.question) {
		lines.push(`Frage/Situation des Nutzers: ${input.question}`);
	} else {
		lines.push('Der Nutzer hat keine konkrete Frage — schlage Aktivitäten über alle Säulen hinweg vor.');
	}
	if (input.distribution && input.distribution.length > 0) {
		const pillarNameById = new Map(input.pillars.map((pillar) => [pillar.id, pillar.name]));
		// Nach Unterversorgung absteigend sortieren: die schwächste (am stärksten unterversorgte) Säule zuerst.
		const ranked = input.distribution
			.map((entry) => ({ ...entry, undersupply: relativeUndersupply(entry.weight, entry.actualShare) }))
			.sort((a, b) => b.undersupply - a.undersupply);
		const table = ranked
			.map((entry) => {
				const name = pillarNameById.get(entry.pillarId) ?? `Säule ${entry.pillarId}`;
				return `  - ${name} (pillarId ${entry.pillarId}): Soll ${Math.round(entry.weight)} %, Ist ${Math.round(entry.actualShare * 100)} % → Unterversorgung ${Math.round(entry.undersupply * 100)} %`;
			})
			.join('\n');
		lines.push('', 'Aktuelle Säulen-Verteilung (Soll vs. Ist, absteigend nach Unterversorgung):', table);
		const weakest = ranked
			.filter((entry) => entry.undersupply > 0)
			.map((entry) => pillarNameById.get(entry.pillarId) ?? `Säule ${entry.pillarId}`);
		if (weakest.length > 0) {
			lines.push(
				'',
				`Priorität: Richte die Vorschläge primär auf die schwächsten (am stärksten unterversorgten) Säulen aus — in dieser Reihenfolge: ${weakest.join(', ')}.`,
			);
		}
	}
	return lines.join('\n');
};

/**
 * Liest aus der (bereits geparsten) Modell-Antwort die Berater-Vorschläge defensiv aus: nur Einträge
 * mit nicht-leerer Aktivität und mindestens einer bekannten Säule, `pillarIds` dublettenfrei und
 * sortiert, insgesamt auf {@link MAX_ADVICE_ENTRIES} begrenzt.
 */
const extractActivityAdvice = (parsed: unknown, input: AdviseActivitiesInput): ActivityAdvice[] => {
	if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { advice?: unknown }).advice)) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format ({ advice: [...] }).');
	}
	const validIds = new Set(input.pillars.map((pillar) => pillar.id));

	const advice: ActivityAdvice[] = [];
	for (const raw of (parsed as { advice: unknown[] }).advice) {
		if (typeof raw !== 'object' || raw === null) {
			continue;
		}
		const { activity, reason, pillarIds } = raw as Record<string, unknown>;
		if (typeof activity !== 'string' || activity.trim() === '' || !Array.isArray(pillarIds)) {
			continue;
		}
		const ids = [
			...new Set(
				pillarIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && validIds.has(id)),
			),
		].sort((a, b) => a - b);
		if (ids.length === 0) {
			continue;
		}
		advice.push({
			activity: activity.trim(),
			reason: typeof reason === 'string' ? reason.trim() : '',
			pillarIds: ids,
		});
		if (advice.length >= MAX_ADVICE_ENTRIES) {
			break;
		}
	}
	return advice;
};

/** System-Prompt für Lektorat + optionales Kürzen (Issue #645). */
const LEKTORAT_SYSTEM_PROMPT = [
	'Du bist professioneller Lektor für deutsche Texte.',
	'',
	'Aufgabe:',
	'- Korrigiere Rechtschreibung, Grammatik und Stil.',
	'- Ist eine Maximallänge angegeben, kürze den Text auf diese Länge (oder kürzer),',
	'  ohne den Sinn zu verlieren. Bei Kürzung den Text sinnvoll auf den Kern reduzieren.',
	'',
	'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
	'{ "text": <string> }',
].join('\n');

/**
 * Baut die Nutzer-Nachricht für das Lektorat mit optionaler Längenbegrenzung.
 */
export const buildLektoratUserMessage = (input: LektoratInput): string => {
	const lines = ['Zu lektorierender Text:', input.text];
	if (input.maxLength !== undefined) {
		lines.push('', `Maximallänge: ${input.maxLength} Zeichen (Text kürzen, falls länger)`);
	}
	return lines.join('\n');
};

/**
 * Extrahiert den lektorierten Text aus der Modell-Antwort.
 */
export const extractLektoratOutput = (parsed: unknown): LektoratOutput => {
	if (typeof parsed !== 'object' || parsed === null) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format (Objekt erwartet).');
	}
	const raw = parsed as Record<string, unknown>;
	if (typeof raw.text !== 'string') {
		throw new MistralRequestError('Antwort des Modells enthielt kein gültiges text-Feld.');
	}
	return { text: raw.text.trim() };
};

/**
 * Reale Lektorat-Funktion: ruft die LLM-Kaskade auf (Mistral → OpenRouter-Verfeinerung).
 * Lektorisiert Texte und kürzt sie optional auf eine Maximallänge (Issue #645).
 * Wirft {@link MissingApiKeyError}, wenn kein API-Key gesetzt ist, und {@link MistralRequestError}
 * bei jedem Upstream-/Format-Problem.
 */
// knip-ignore-export - Exportiert für zukünftige Nutzung (Issue #645)
export const lektoratTextWithMistral: LektoratFunction = async (input) => {
	// Eingabe-Validierung VOR dem LLM-Call (Review #647): leerer Text verschwendet API-Calls,
	// nicht-positive maxLength erzeugt kaputte Prompt-Outputs.
	if (input.text.trim() === '') {
		throw new MistralRequestError('Lektorat erwartet einen nicht-leeren Text.');
	}
	if (input.maxLength !== undefined && input.maxLength <= 0) {
		throw new MistralRequestError('maxLength muss positiv sein (falls angegeben).');
	}
	const parsed = await requestModelJson([
		{ role: 'system', content: LEKTORAT_SYSTEM_PROMPT },
		{ role: 'user', content: buildLektoratUserMessage(input) },
	]);
	return extractLektoratOutput(parsed);
};

/**
 * Realer Aktivitäten-Berater: ruft die LLM-Kaskade auf (Mistral → OpenRouter-Verfeinerung)
 * und schlägt Aktivitäten samt Säulen-Zuordnung vor. Wirft {@link MissingApiKeyError},
 * wenn kein API-Key gesetzt ist, und {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
export const adviseActivitiesWithMistral: ActivityAdvisor = async (input) => {
	const parsed = await requestModelJson([
		{ role: 'system', content: ADVISOR_SYSTEM_PROMPT },
		{ role: 'user', content: buildAdvisorUserMessage(input) },
	]);
	return extractActivityAdvice(parsed, input);
};
