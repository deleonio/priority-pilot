/**
 * Dünner, fetch-basierter LLM-Client (ESM, Node >= 22 — globales `fetch`/`AbortController`,
 * kein externes SDK). Spricht die OpenAI-kompatible Chat-Completions-API an.
 *
 *
 */

import { findProviderByName, loadActiveProvider, toRuntimeConfig } from './llmProviders.js';
import { normalizeSuggestedShares } from '../logics/pillarShares.js';
import { fetchProviderEndpoint } from './endpointGuard.js';
import { upstreamErrorDetail } from './upstreamError.js';
import type { LlmProvider as LlmProviderRow } from '../models/index.js';
import type { LlmSuitability } from '../logics/llmSuitability.js';

/**
 * Eine vorgeschlagene Säulen-Einzahlung: Säulen-ID plus Konfidenz in Prozent (0–100) und — seit
 * #2076 — optional der Anteil an der Aufgabe in Prozent (ganzzahlig 5–80, Summe über alle Säulen
 * 100). Optionale Schnittstelle: Alt-Klassifikatoren und gespeicherte Feedback-Zeilen ohne Anteil
 * bleiben gültig; `extractSuggestions` liefert den Anteil über die Normalisierung stets mit.
 */
export interface PillarSuggestion {
	pillarId: number;
	confidence: number;
	share?: number;
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
	/** Zur Aufgabe passende Wissens-Einträge des Nutzers (#1936); nur in der finalen Nutzer-Nachricht. */
	knowledge?: { id: number; text: string }[];
}

/** Funktionssignatur des Klassifikators — injizierbar, damit Tests ohne echten API-Call laufen. */
export type PillarClassifier = (
	input: ClassifyPillarsInput,
	provider?: LlmProvider,
	userId?: number,
) => Promise<PillarSuggestion[]>;

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
	/** #1310: `true`, wenn der Text einen wiederkehrenden Termin beschreibt (Formular startet im Serien-Modus). */
	isSeries?: boolean;
	/** #1310: Im Text genannte Ortsangabe als Adresstext (reiner Freitext, kein Geocoding). */
	address?: string;
	/** #1310: Im Text aufgezählte Einzelpunkte, je ein Checklisten-Eintrag (getrimmt, max. 255 Zeichen). */
	checklist?: string[];
	/** ID der thematisch passenden Kategorie des Nutzers; nur gesetzt, wenn eine eindeutig passt. */
	categoryId?: number;
}

/** Eine Kategorie, so wie der Prompt sie dem Modell zur Auswahl vorlegt. */
export interface CategoryOption {
	id: number;
	name: string;
}

/**
 * Funktionssignatur des Task-Text-Parsers — injizierbar, damit Tests ohne echten API-Call laufen.
 * `categories` sind die Kategorien des eingeloggten Nutzers; ohne sie bleibt `categoryId` leer.
 */
export type ParseTaskParser = (
	text: string,
	provider?: LlmProvider,
	categories?: CategoryOption[],
	userId?: number,
) => Promise<ParsedTask>;

/** Aus einer frei formulierten Suchanfrage extrahierter Filter (Suchbegriff + Kategorie). */
export interface ParsedSearch {
	text?: string;
	categoryId?: number;
}

/** Funktionssignatur des Suchanfragen-Parsers — injizierbar wie {@link ParseTaskParser}. */
export type ParseSearchParser = (
	text: string,
	provider?: LlmProvider,
	categories?: CategoryOption[],
	userId?: number,
) => Promise<ParsedSearch>;

/**
 * Optionaler Provider-Pinning für den LLM-Test-Schalter (#749) und dynamische Provider (#951).
 * - Jeder String: Name eines konfigurierten Providers (`llm_providers`, inkl. der Built-ins
 *   „Mistral“/„OpenRouter“; Auflösung Case-insensitiv).
 * - `undefined`: der effektiv aktive Provider (explizite Wahl oder Built-in-Fallback).
 */
export type LlmProvider = string | undefined;

/** Eine Säule, so wie der Erststart-Prompt sie dem Modell zur Auswahl vorlegt (Muster `CategoryOption`). */
export interface PillarOption {
	id: number;
	name: string;
}

/** Ein Erststart-Aufgabenvorschlag (#2068): Titel, Säule und optional ein Vorgänger-Verweis. */
export interface SuggestedInitialTask {
	title: string;
	pillarId: number;
	/** 0-basierter Index eines anderen Vorschlags derselben Antwort, den dieser voraussetzt. */
	dependsOn?: number;
}

/**
 * Funktionssignatur des Erststart-Suggesters (#2068) — injizierbar, damit Tests ohne echten
 * API-Call laufen. `pillars` sind die Säulen des eingeloggten Nutzers; die Route bereinigt die
 * Ausgabe auf gültige Einträge (Titel, Säulen-Scope, dependsOn-Verweise).
 */
export type InitialTaskSuggester = (
	text: string,
	provider?: LlmProvider,
	pillars?: PillarOption[],
	userId?: number,
) => Promise<SuggestedInitialTask[]>;

/** Der Dienst ist nicht nutzbar (kein Provider/Key/Modell) → der Handler antwortet mit HTTP 503. */
export class MissingApiKeyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MissingApiKeyError';
	}
}

/** Upstream-Fehler (HTTP-Fehlerstatus, Timeout, unlesbare/ungültige Antwort) → der Handler mappt auf 502. */
export class MistralRequestError extends Error {
	/** HTTP-Status der Upstream-Antwort, sofern der Fehler von einer Antwort stammt. */
	readonly status?: number;
	/** Aus `Retry-After` gelesene Wartezeit in Millisekunden (nur bei 429/503 gesetzt). */
	readonly retryAfterMs?: number;

	constructor(message: string, details: { status?: number; retryAfterMs?: number } = {}) {
		super(message);
		this.name = 'MistralRequestError';
		this.status = details.status;
		this.retryAfterMs = details.retryAfterMs;
	}
}

/** Liest `Retry-After` (Sekunden oder HTTP-Datum) als Millisekunden; `undefined`, wenn nicht lesbar. */
const parseRetryAfter = (raw: string | null): number | undefined => {
	if (raw === null || raw.trim() === '') {
		return undefined;
	}
	const seconds = Number(raw);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return seconds * 1000;
	}
	const date = Date.parse(raw);
	return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

/** Konfiguration eines LLM-Providers — Endpoint, Auth, Modell und Label für Fehlermeldungen. */
interface ProviderConfig {
	endpoint: string;
	apiKey: string | undefined;
	model: string;
	label: string;
	guardEndpoint: boolean;
}

const REQUEST_TIMEOUT_MS = 30_000;

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
 *
 * Seit #2076 verlangt der Prompt für JEDE Säule einen Anteil (`share`, ganzzahlig 5–80, Summe
 * exakt 100) neben der Konfidenz — die „leere Liste“-Regel ist entfallen, denn jede Aufgabe zahlt
 * auf jede Säule ein (#1635), nur unterschiedlich stark. Die Konfidenz-Deckelung der schwachen
 * Säulen bleibt; für Anteile gibt es keine solche Deckelung.
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
		'',
		'Hinweise zum Anteil (share):',
		'- Schätze für jede der Säulen, wie viel Prozent der Aufgabe auf sie entfällt.',
		'- Der Anteil ist eine ganze Zahl zwischen 5 und 80, die Summe aller Anteile ist exakt 100.',
		'- Wie du die Anteile innerhalb dieser Grenzen verteilst, entscheidet sich je Aufgabe nach Titel und Beschreibung:',
		'  eine klare Fokusaufgabe darf eine Säule dominant führen, eine gemischte Aufgabe verteilt breiter.',
		'',
		'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
		'{ "pillars": [ { "pillarId": <ganzzahl>, "confidence": <0-100>, "share": <5-80> } ] }',
		'Nenne alle übergebenen Säulen, mit pillarId, confidence und share.',
		'Verwende nur die pillarId-Werte aus der vom Nutzer übergebenen Säulen-Liste.',
	].join('\n');
};

/**
 * Few-Shot-Beispiele, damit das Modell Format und Konfidenz-Niveau übernimmt. Die Säulen werden über
 * ihren **Namen** referenziert (nicht über hartkodierte IDs) und erst in {@link fewShotMessages} gegen
 * die real injizierte Säulen-Liste aufgelöst — so passen die Beispiel-IDs immer zur Seed-Reihenfolge.
 *
 * Seit #2076 tragen die Beispiele je Säule auch den Anteil — ALLE Säulen, Anteile ganzzahlig
 * 5–80, Summe exakt 100. Bewusst ein Fokusfall (eine Säule dominant) UND ein Mischfall (breite
 * Verteilung) neben der Treppenform, damit das Modell nicht reflexhaft eine einzige Form wiederholt.
 */
const FEW_SHOT = [
	{
		title: 'Dreimal pro Woche joggen gehen',
		description: 'Ausdauer aufbauen und morgens 5 km laufen.',
		pillars: [
			{ name: 'Körper', confidence: 95, share: 80 },
			{ name: 'Beziehungen', confidence: 20, share: 5 },
			{ name: 'Sinn', confidence: 15, share: 5 },
			{ name: 'Mentale Gesundheit', confidence: 30, share: 5 },
			{ name: 'Wirksamkeit', confidence: 25, share: 5 },
		],
	},
	{
		title: 'Mit Freunden joggen und danach gemeinsam kochen',
		description: 'Sport und Begegnung verbinden — nichts dominiert.',
		pillars: [
			{ name: 'Körper', confidence: 70, share: 30 },
			{ name: 'Beziehungen', confidence: 85, share: 25 },
			{ name: 'Sinn', confidence: 40, share: 20 },
			{ name: 'Mentale Gesundheit', confidence: 55, share: 15 },
			{ name: 'Wirksamkeit', confidence: 30, share: 10 },
		],
	},
	{
		title: 'Zertifizierung für Cloud-Architektur abschließen',
		description: 'Lernen und Prüfung ablegen.',
		pillars: [
			{ name: 'Körper', confidence: 10, share: 5 },
			{ name: 'Beziehungen', confidence: 5, share: 5 },
			{ name: 'Sinn', confidence: 25, share: 10 },
			{ name: 'Mentale Gesundheit', confidence: 45, share: 15 },
			{ name: 'Wirksamkeit', confidence: 90, share: 65 },
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
	// #1936: ohne Einträge kein Abschnitt — die Nachricht bleibt dann exakt wie zuvor (AK5).
	if (input.knowledge?.length) {
		lines.push('', 'Persönliche Hinweise des Nutzers (bei der Zuordnung berücksichtigen):');
		lines.push(...input.knowledge.map((entry) => `- ${entry.text}`));
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
		for (const { name, confidence, share } of example.pillars) {
			const pillarId = idByName.get(name);
			if (pillarId !== undefined) {
				resolved.push({ pillarId, confidence, share });
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
				// #2076: gelernte Anteile fließen mit — Altzeilen ohne Anteil unverändert (additive
				// Schnittstelle), damit die assistant-Beispielantworten die alte Form behalten.
				return entry.share === undefined
					? { pillarId: entry.pillarId, confidence }
					: { pillarId: entry.pillarId, confidence, share: entry.share };
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
 *
 * Seit #2076 wird die Antwort über ALLE Säulen auf eine gültige Verteilung gebracht (#2076, AK2):
 * Rohe Anteile landen in einer Basis über ALLE Säulen (fehlende Säulen und Unsinns-Werte als 0)
 * und werden mit {@link normalizeSuggestedShares} auf ganzzahlig · je ≥ 5 · je ≤ 80 · Summe exakt
 * 100 gebracht. Jede Säule kommt ins Ergebnis — Säulen ohne Modell-Stimme mit Konfidenz 0. Nur
 * die Konfidenz kennt das Weak-Signal-Ceiling; Anteile werden bewusst nicht darauf gedeckelt.
 */
const extractSuggestions = (parsed: unknown, input: ClassifyPillarsInput): PillarSuggestion[] => {
	if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { pillars?: unknown }).pillars)) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format ({ pillars: [...] }).');
	}
	const validIds = new Map(input.pillars.map((pillar) => [pillar.id, pillar.name]));
	const ceilingPillarIds = weakSignalPillarIds(input.pillars);

	const confidences = new Map<number, number>();
	const rawShares = new Map<number, number>();
	for (const raw of (parsed as { pillars: unknown[] }).pillars) {
		if (typeof raw !== 'object' || raw === null) {
			continue;
		}
		const { pillarId } = raw as Record<string, unknown>;
		if (
			typeof pillarId !== 'number' ||
			!Number.isInteger(pillarId) ||
			!validIds.has(pillarId) ||
			confidences.has(pillarId)
		) {
			continue;
		}
		let confidence = clampConfidence((raw as Record<string, unknown>).confidence);
		if (ceilingPillarIds.has(pillarId)) {
			confidence = Math.min(confidence, WEAK_SIGNAL_CONFIDENCE_CEILING);
		}
		const share = (raw as Record<string, unknown>).share;
		confidences.set(pillarId, confidence);
		rawShares.set(pillarId, typeof share === 'number' && Number.isFinite(share) ? share : 0);
	}
	const shares = normalizeSuggestedShares(input.pillars.map((pillar) => rawShares.get(pillar.id) ?? 0));
	return input.pillars
		.map((pillar, index) => ({
			pillarId: pillar.id,
			confidence: confidences.get(pillar.id) ?? 0,
			share: shares[index],
		}))
		.sort((a, b) => a.pillarId - b.pillarId);
};

/** Extrahiert den Text der Chat-Completion-Antwort. */
const modelText = (payload: unknown): string => {
	const content = (payload as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
	if (typeof content !== 'string') {
		throw new MistralRequestError('Antwort des Modells enthielt keinen Text.');
	}
	return content;
};

/** Extrahiert den JSON-String aus der Chat-Completion-Antwort und parst ihn defensiv. */
const parseModelContent = (payload: unknown): unknown => {
	const content = modelText(payload);
	try {
		return JSON.parse(content);
	} catch {
		throw new MistralRequestError('Antwort des Modells war kein gültiges JSON.');
	}
};

/**
 * Einzelner API-Call an einen Provider: schickt die Nachrichten an die Chat-Completions-API
 * (JSON-Mode, Temperatur 0, Timeout) und liefert den geparsten JSON-Inhalt der Modell-Antwort —
 * mit `json = false` ohne JSON-Mode den Freitext (#2350).
 * Wirft {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
const callProvider = async (
	config: ProviderConfig,
	messages: { role: string; content: string }[],
	json = true,
): Promise<unknown> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetchProviderEndpoint(
			config.endpoint,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({
					model: config.model,
					temperature: 0,
					...(json ? { response_format: { type: 'json_object' } } : {}),
					messages,
				}),
				signal: controller.signal,
			},
			config.guardEndpoint,
		);
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unbekannter Fehler';
		throw new MistralRequestError(`${config.label}-Anfrage fehlgeschlagen: ${reason}`);
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		// Upstream-Fehlerdiagnose: Klartext-Ursache aus dem Body übernehmen (siehe upstreamError.ts).
		const detail = await upstreamErrorDetail(response);
		throw new MistralRequestError(
			`${config.label} (${config.model}) antwortete mit HTTP ${response.status}${detail !== '' ? `: ${detail}` : '.'}`,
			{ status: response.status, retryAfterMs: parseRetryAfter(response.headers.get('retry-after')) },
		);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new MistralRequestError(`${config.label}-Antwort konnte nicht als JSON gelesen werden.`);
	}

	return json ? parseModelContent(payload) : modelText(payload);
};

/** ProviderConfig aus einer `llm_providers`-Zeile — Built-ins lösen ENV-Werte auf (llmProviders.ts). */
const toDynamicProviderConfig = (provider: LlmProviderRow): ProviderConfig => {
	const runtime = toRuntimeConfig(provider);
	return {
		endpoint: runtime.chatEndpoint,
		apiKey: runtime.apiKey || undefined,
		model: runtime.model,
		label: runtime.label,
		guardEndpoint: runtime.guardEndpoint,
	};
};

/**
 * Provider-Auflösung: GENAU EIN Provider pro Anfrage.
 *
 * - `pinned` gesetzt: der gleichnamige DB-Provider (Case-insensitiv, Query-Pinning #749).
 * - `pinned` leer: der effektiv aktive Provider (explizite Wahl oder Built-in-Fallback).
 *
 * `null` = kein Provider im Spiel (nicht konfiguriert oder Tabelle fehlt) → Aufrufer
 * wirft {@link MissingApiKeyError} (HTTP 503).
 */
const resolveProvider = async (pinned?: LlmProvider, userId?: number): Promise<LlmProviderRow | null> => {
	try {
		if (pinned !== undefined && pinned !== '') {
			return await findProviderByName(pinned);
		}
		return await loadActiveProvider(userId);
	} catch {
		return null;
	}
};

/** Genau ein Provider-Aufruf; `json = false` liefert den Freitext statt geparstem JSON (#2350). */
const requestModelJson = async (
	messages: { role: string; content: string }[],
	provider?: LlmProvider,
	userId?: number,
	json = true,
): Promise<unknown> => {
	// GENAU EIN Call an den aufgelösten Provider — keine Kaskade, kein Provider-Fallback.
	// Mit userId (#1548) gewinnt die eigene Provider-Auswahl des Nutzers.
	const resolved = await resolveProvider(provider, userId);
	if (resolved === null) {
		throw new MissingApiKeyError(
			'Kein aktiver LLM-Provider — wähle einen unter Einstellungen → KI-Provider und teste ihn dort.',
		);
	}
	const runtime = toRuntimeConfig(resolved);
	if (!runtime.apiKey) {
		throw new MissingApiKeyError(
			`${runtime.label}: API-Key fehlt (${runtime.keySource}) — Provider in den Einstellungen prüfen.`,
		);
	}
	if (!runtime.model) {
		throw new MissingApiKeyError(
			`${resolved.name}: kein Modell gewählt — Modell in den Einstellungen (KI-Provider) festlegen.`,
		);
	}
	return callProvider(toDynamicProviderConfig(resolved), messages, json);
};

/**
 * Realer Klassifikator: ruft den aktiven LLM-Provider auf (#951).
 * Wirft {@link MissingApiKeyError}, wenn kein API-Key gesetzt ist, und {@link MistralRequestError}
 * bei jedem Upstream-/Format-Problem.
 */
export const classifyPillarsWithMistral: PillarClassifier = async (input, provider, userId) => {
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: buildSystemPrompt(input.pillars) },
			...fewShotMessages(input.pillars),
			...feedbackMessages(input),
			{ role: 'user', content: buildUserMessage(input) },
		],
		provider,
		userId,
	);
	return extractSuggestions(parsed, input);
};

/** Längengrenze des Titels (Spiegel von `frontend/src/lib/titleLengthValidation.ts`, #1310). */
const PARSED_TITLE_MAX_LENGTH = 65;
/** Längengrenze der Beschreibung (Spiegel von `frontend/src/lib/descriptionLengthValidation.ts`, #1310). */
const PARSED_DESCRIPTION_MAX_LENGTH = 3000;
/** Längengrenze eines Checklisten-Eintrags (Vertrag `ChecklistItem.title` in `openapi.yml`, #1310). */
const PARSED_CHECKLIST_ITEM_MAX_LENGTH = 255;

/**
 * Prompt-Zeilen zur Kategorie-Auswahl. Ohne Kategorien (neues Konto) bleiben sie leer — dann darf
 * das Modell gar keine `categoryId` erfinden, weil keine zur Auswahl steht.
 */
const categoryPromptLines = (categories: CategoryOption[]): string[] =>
	categories.length === 0
		? []
		: [
				'',
				'Kategorien des Nutzers (thematische Ordnung, NICHT die Lebensbereiche):',
				...categories.map((category) => `- ${category.id}: ${category.name}`),
				'- "categoryId" (optional): ID genau EINER dieser Kategorien, wenn der Text thematisch eindeutig dorthin gehört. Im Zweifel weglassen; niemals eine ID erfinden.',
			];

/**
 * Liest eine `categoryId` defensiv aus der Modell-Antwort: nur eine Ganzzahl, die zu einer der
 * angebotenen Kategorien gehört, wird übernommen. Alles andere (erfundene ID, String, 0) fällt
 * still weg — ein ungültiger Wert würde beim Speichern nur an der Server-Validierung scheitern.
 */
const extractCategoryId = (raw: unknown, categories: CategoryOption[]): number | undefined => {
	if (typeof raw !== 'number' || !Number.isInteger(raw)) {
		return undefined;
	}
	return categories.some((category) => category.id === raw) ? raw : undefined;
};

/**
 * System-Prompt für die Task-Schnellerfassung: extrahiert strukturierte Felder aus Freitext.
 * Das aktuelle Datum steckt im Prompt (ISO, UTC), damit relative Angaben („übermorgen") auflösbar
 * sind (#1310 AK4) — ohne diesen Bezug kann das Modell sie nicht in eine Deadline übersetzen.
 */
const buildParseTaskSystemPrompt = (now: Date = new Date(), categories: CategoryOption[] = []): string =>
	[
		'Du extrahierst aus einem frei formulierten deutschen Text die strukturierten Felder einer Aufgabe (Task).',
		'',
		`Heutiges Datum (UTC): ${now.toISOString().slice(0, 10)}. Löse relative Zeitangaben („heute", „gestern", „übermorgen", „nächsten Freitag") gegen dieses Datum auf.`,
		'',
		'Gib genau diese Felder zurück (nur was der Text hergibt):',
		`- "title" (Pflicht): kurzer, prägnanter Titel der Aufgabe, höchstens ${PARSED_TITLE_MAX_LENGTH} Zeichen.`,
		`- "description" (optional): ergänzende Details, falls im Text vorhanden, höchstens ${PARSED_DESCRIPTION_MAX_LENGTH} Zeichen.`,
		'- "priority" (optional): Ganzzahl 1–5 (1 = niedrig, 3 = mittel, 5 = hoch). Leite sie aus der Dringlichkeit im Text ab: betont dringliche Formulierungen („ganz wichtig", „sofort", „dringend") ergeben 5, beiläufig erwähnte Punkte („bei Gelegenheit", „irgendwann") ergeben 1 oder 2.',
		'- "estimatedEffort" (optional): geschätzter Aufwand in Personentagen als Dezimalzahl (z. B. 2 Stunden ≈ 0.25).',
		'- "deadline" (optional): Fälligkeitsdatum als ISO-8601-String (z. B. "2026-07-31T00:00:00.000Z"), falls ein Datum genannt ist.',
		'- "isSeries" (optional): true, wenn der Text einen wiederkehrenden Termin beschreibt („jeden Montag", „monatlich"), sonst weglassen.',
		'- "address" (optional): im Text genannte Ortsangabe als Adresstext.',
		`- "checklist" (optional): Array der im Text aufgezählten Einzelpunkte als kurze Strings (je höchstens ${PARSED_CHECKLIST_ITEM_MAX_LENGTH} Zeichen).`,
		...categoryPromptLines(categories),
		'',
		'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
		'{ "title": <string>, "description": <string?>, "priority": <1-5?>, "estimatedEffort": <zahl?>, "deadline": <iso-string?>, "isSeries": <boolean?>, "address": <string?>, "checklist": <string[]?>, "categoryId": <zahl?> }',
		'Lasse optionale Felder weg, wenn der Text keine Angabe dazu enthält.',
	].join('\n');

/**
 * Liest aus der (bereits geparsten) Modell-Antwort die Task-Felder defensiv aus. Die Längengrenzen
 * werden hier erzwungen (#1310 AK3/AK6) — ein Prompt-Hinweis allein ist nicht prüfbar, und ein zu
 * langer Titel/eine zu lange Beschreibung ließe das Speichern an der Validierung scheitern.
 */
const extractParsedTask = (parsed: unknown, categories: CategoryOption[] = []): ParsedTask => {
	if (typeof parsed !== 'object' || parsed === null) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format (Objekt erwartet).');
	}
	const raw = parsed as Record<string, unknown>;
	if (typeof raw.title !== 'string' || raw.title.trim() === '') {
		throw new MistralRequestError('Antwort des Modells enthielt keinen gültigen title.');
	}
	const result: ParsedTask = { title: raw.title.trim().slice(0, PARSED_TITLE_MAX_LENGTH) };
	if (typeof raw.description === 'string' && raw.description.trim() !== '') {
		result.description = raw.description.trim().slice(0, PARSED_DESCRIPTION_MAX_LENGTH);
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
	if (typeof raw.isSeries === 'boolean') {
		result.isSeries = raw.isSeries;
	}
	if (typeof raw.address === 'string' && raw.address.trim() !== '') {
		result.address = raw.address.trim();
	}
	if (Array.isArray(raw.checklist)) {
		// Leere/nur-Leerzeichen-Einträge fliegen raus, überlange werden gekürzt — beides würde die
		// `ChecklistItem`-Validierung (1–255 Zeichen) beim Speichern sonst reißen.
		const items = raw.checklist
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim().slice(0, PARSED_CHECKLIST_ITEM_MAX_LENGTH))
			.filter((entry) => entry !== '');
		if (items.length > 0) {
			result.checklist = items;
		}
	}
	const categoryId = extractCategoryId(raw.categoryId, categories);
	if (categoryId !== undefined) {
		result.categoryId = categoryId;
	}
	return result;
};

/**
 * Realer Task-Text-Parser: ruft den aktiven LLM-Provider auf (#951)
 * und extrahiert strukturierte Task-Felder aus Freitext (Schnellerfassung, #235). Wirft
 * {@link MissingApiKeyError}, wenn kein API-Key gesetzt ist, und {@link MistralRequestError}
 * bei jedem Upstream-/Format-Problem.
 */
export const parseTaskTextWithMistral: ParseTaskParser = async (text, provider, categories = [], userId) => {
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: buildParseTaskSystemPrompt(new Date(), categories) },
			{ role: 'user', content: text },
		],
		provider,
		userId,
	);
	return extractParsedTask(parsed, categories);
};

/**
 * System-Prompt für die Suchanfrage-Zerlegung: trennt den reinen Suchbegriff von der gemeinten
 * Kategorie. Ohne Kategorien bleibt nur die Textrückgabe übrig — der Aufruf lohnt sich dann nicht,
 * die Route ruft in dem Fall gar nicht erst an.
 */
const buildParseSearchSystemPrompt = (categories: CategoryOption[]): string =>
	[
		'Du zerlegst eine frei formulierte deutsche Suchanfrage nach Aufgaben in einen Suchbegriff und eine Kategorie.',
		'',
		'Kategorien des Nutzers:',
		...categories.map((category) => `- ${category.id}: ${category.name}`),
		'',
		'Gib genau diese Felder zurück:',
		'- "text" (optional): der Suchbegriff OHNE den Kategorie-Anteil und ohne Füllwörter wie „zeig mir", „alle", „offene". Nennt die Anfrage nur eine Kategorie, lasse das Feld weg.',
		'- "categoryId" (optional): ID genau EINER Kategorie aus der Liste, wenn die Anfrage sie meint. Im Zweifel weglassen; niemals eine ID erfinden.',
		'',
		'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
		'{ "text": <string?>, "categoryId": <zahl?> }',
	].join('\n');

/**
 * Liest die Suchanfrage-Zerlegung defensiv aus der Modell-Antwort. Anders als beim Task-Parsing
 * gibt es kein Pflichtfeld: Ein leeres Ergebnis ist gültig (die Suche filtert dann nicht) und darf
 * nicht als Upstream-Fehler durchschlagen.
 */
const extractParsedSearch = (parsed: unknown, categories: CategoryOption[] = []): ParsedSearch => {
	if (typeof parsed !== 'object' || parsed === null) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format (Objekt erwartet).');
	}
	const raw = parsed as Record<string, unknown>;
	const result: ParsedSearch = {};
	if (typeof raw.text === 'string' && raw.text.trim() !== '') {
		result.text = raw.text.trim();
	}
	const categoryId = extractCategoryId(raw.categoryId, categories);
	if (categoryId !== undefined) {
		result.categoryId = categoryId;
	}
	return result;
};

/** Realer Suchanfragen-Parser (Muster {@link parseTaskTextWithMistral}). */
export const parseSearchQueryWithMistral: ParseSearchParser = async (text, provider, categories = [], userId) => {
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: buildParseSearchSystemPrompt(categories) },
			{ role: 'user', content: text },
		],
		provider,
		userId,
	);
	return extractParsedSearch(parsed, categories);
};

/**
 * System-Prompt für die Erststart-Vorschläge (#2068): aus einer freien Beschreibung der aktuellen
 * Lage werden 5–8 konkrete, sofort startbare Aufgaben je Säule des Nutzers vorgeschlagen — nichts
 * wird angelegt, nur vorgeschlagen.
 */
const buildSuggestInitialSystemPrompt = (pillars: PillarOption[]): string =>
	[
		'Du schlägst einem Nutzer konkrete erste Aufgaben vor, basierend auf seiner freien Beschreibung, was ihn gerade beschäftigt.',
		'',
		'Säulen des Nutzers (Lebensbereiche):',
		...pillars.map((pillar) => `- ${pillar.id}: ${pillar.name}`),
		'',
		'Gib 5 bis 8 Aufgaben-Vorschläge zurück. Für jeden Vorschlag:',
		`- "title" (Pflicht): kurzer, konkreter, sofort startbarer Aufgabentitel, höchstens ${PARSED_TITLE_MAX_LENGTH} Zeichen.`,
		'- "pillarId" (Pflicht): ID genau EINER dieser Säulen; niemals eine ID erfinden.',
		'- "dependsOn" (optional): 0-basierter Index eines ANDEREN Vorschlags aus deiner Liste, den dieser Vorschlag logisch voraussetzt (z. B. erst "Unterlagen sammeln", dann "Antrag stellen"). Nur setzen, wenn es wirklich eine Reihenfolge gibt.',
		'',
		'Antworte ausschließlich mit JSON in genau dieser Form (keine Erklärung, kein Markdown):',
		'{ "suggestions": [ { "title": <string>, "pillarId": <zahl>, "dependsOn": <zahl?> } ] }',
	].join('\n');

/**
 * Liest die Erststart-Vorschläge formatseitig aus der Modell-Antwort und reicht die suggestions-
 * Liste unverändert an die Route durch — bewusst OHNE Dropping je Eintrag (Abweichung vom Muster
 * `extractSuggestions`): Die Route berechnet die Original-Position eines Eintrags über die
 * Reihenfolge dieser Liste und prüft darauf die `dependsOn`-Verweise; würde der Extraktor
 * Einträge verwerfen, verschieben sich alle nachfolgenden Verweise (PR #2079, Finding 2). Form-
 * und fachliche Bereinigung macht daher ausschließlich die Route (`parseSuggestion`/
 * `sanitizeSuggestions`) — sie gilt gleichermaßen für den injizierten Mock.
 */
const extractSuggestedInitialTasks = (parsed: unknown): SuggestedInitialTask[] => {
	if (typeof parsed !== 'object' || parsed === null) {
		throw new MistralRequestError('Antwort des Modells hat nicht das erwartete Format (Objekt erwartet).');
	}
	const suggestions = (parsed as Record<string, unknown>).suggestions;
	if (!Array.isArray(suggestions)) {
		throw new MistralRequestError('Antwort des Modells enthält keine suggestions-Liste.');
	}
	// Pass-through ohne Dropping: Indexstabilität der dependsOn-Verweise geht vor — die Route
	// verwirft (identische Form-Prüfung) und renummert die gültigen Verweise selbst.
	return suggestions as SuggestedInitialTask[];
};

/**
 * Realer Erststart-Suggester: ruft den aktiven LLM-Provider auf (#951) und erzeugt aus Freitext
 * 5–8 Aufgaben-Vorschläge mit Säulen-Bezug (#2068). Wirft {@link MissingApiKeyError}, wenn kein
 * API-Key gesetzt ist, und {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
export const suggestInitialTasksWithMistral: InitialTaskSuggester = async (text, provider, pillars = [], userId) => {
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: buildSuggestInitialSystemPrompt(pillars) },
			{ role: 'user', content: text },
		],
		provider,
		userId,
	);
	return extractSuggestedInitialTasks(parsed);
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
export type LektoratFunction = (
	input: LektoratInput,
	provider?: LlmProvider,
	userId?: number,
) => Promise<LektoratOutput>;

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
export type ActivityAdvisor = (
	input: AdviseActivitiesInput,
	provider?: LlmProvider,
	userId?: number,
) => Promise<ActivityAdvice[]>;

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
 * sortiert, insgesamt auf {@link MAX_ADVICE_ENTRIES} begrenzt. Aktivität und Begründung werden auf
 * die Task-Grenzen gekürzt (Titel 65, Beschreibung 3000 Zeichen — #2010), damit das Übernehmen
 * eines KI-Vorschlags `POST /tasks` nicht mit einem zu langen Titel scheitern lässt.
 */
export const extractActivityAdvice = (parsed: unknown, input: AdviseActivitiesInput): ActivityAdvice[] => {
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
			activity: activity.trim().slice(0, PARSED_TITLE_MAX_LENGTH),
			reason: typeof reason === 'string' ? reason.trim().slice(0, PARSED_DESCRIPTION_MAX_LENGTH) : '',
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
 * Reale Lektorat-Funktion: ruft den aktiven LLM-Provider auf (#951).
 * Lektorisiert Texte und kürzt sie optional auf eine Maximallänge (Issue #645).
 * Wirft {@link MissingApiKeyError}, wenn kein API-Key gesetzt ist, und {@link MistralRequestError}
 * bei jedem Upstream-/Format-Problem.
 */
// knip-ignore-export - Exportiert für zukünftige Nutzung (Issue #645)
export const lektoratTextWithMistral: LektoratFunction = async (input, provider, userId) => {
	// Eingabe-Validierung VOR dem LLM-Call (Review #647): leerer Text verschwendet API-Calls,
	// nicht-positive maxLength erzeugt kaputte Prompt-Outputs.
	if (input.text.trim() === '') {
		throw new MistralRequestError('Lektorat erwartet einen nicht-leeren Text.');
	}
	if (input.maxLength !== undefined && input.maxLength <= 0) {
		throw new MistralRequestError('maxLength muss positiv sein (falls angegeben).');
	}
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: LEKTORAT_SYSTEM_PROMPT },
			{ role: 'user', content: buildLektoratUserMessage(input) },
		],
		provider,
		userId,
	);
	return extractLektoratOutput(parsed);
};

/**
 * Realer Aktivitäten-Berater: ruft den aktiven LLM-Provider auf (#951)
 * und schlägt Aktivitäten samt Säulen-Zuordnung vor. Wirft {@link MissingApiKeyError},
 * wenn kein API-Key gesetzt ist, und {@link MistralRequestError} bei jedem Upstream-/Format-Problem.
 */
export const adviseActivitiesWithMistral: ActivityAdvisor = async (input, provider, userId) => {
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: ADVISOR_SYSTEM_PROMPT },
			{ role: 'user', content: buildAdvisorUserMessage(input) },
		],
		provider,
		userId,
	);
	return extractActivityAdvice(parsed, input);
};

/** Arbeitsauftrag des KI-Entwurfs (#2350) je KI-Eignung der Aufgabe (#2349). */
const TASK_DRAFT_INSTRUCTIONS: Record<LlmSuitability, string> = {
	draft:
		'Schreibe einen versandfertigen Entwurf des Textes, den die Aufgabe verlangt (z. B. E-Mail, Brief, Antrag). Fehlende Angaben setzt du als Platzhalter in eckige Klammern.',
	summary:
		'Die Aufgabe verlangt eine Zusammenfassung. Fasse zusammen, was Titel und Beschreibung hergeben, und gliedere die Punkte, die die Zusammenfassung abdecken sollte.',
	research:
		'Die Aufgabe verlangt eine Recherche. Erstelle einen knappen Recherche-Plan mit Leitfragen, geeigneten Quellen und Vergleichskriterien. Erfinde keine Fakten.',
};

/**
 * KI-Entwurf zu einer Aufgabe (#2350): genau ein Aufruf des aktiven Providers mit dem Arbeitsauftrag
 * der Kategorie; liefert den getrimmten Freitext. Wirft {@link MissingApiKeyError} ohne Provider und
 * {@link MistralRequestError} bei Upstream-/Format-Problemen oder leerer Antwort.
 */
export const draftTaskWithMistral = async (
	input: { category: LlmSuitability; title: string; description?: string | null },
	provider?: LlmProvider,
	userId?: number,
): Promise<string> => {
	const system = [
		'Du erledigst die Vorarbeit für eine Aufgabe aus einer persönlichen Aufgabenliste.',
		TASK_DRAFT_INSTRUCTIONS[input.category],
		'Antworte in der Sprache der Aufgabe, nur mit dem Ergebnis, ohne Vorbemerkung.',
	].join('\n');
	const user = [`Aufgabe: ${input.title}`, ...(input.description ? [`Beschreibung: ${input.description}`] : [])].join(
		'\n',
	);
	const text = (await requestModelJson(
		[
			{ role: 'system', content: system },
			{ role: 'user', content: user },
		],
		provider,
		userId,
		false,
	)) as string;
	if (text.trim() === '') {
		throw new MistralRequestError('Antwort des Modells enthielt keinen Entwurf.');
	}
	return text.trim();
};

/** Eine Abhängigkeits-Vermutung des Import-Berichts (#1988): Kante plus Begründung. */
export interface TaskImportSuggestion {
	dependentTaskId: number;
	dependingTaskId: number;
	title: string;
	reason: string;
}

/** Eingabe des Import-Analyzers: übernehmbare Zeile mit aufgelöster Bestands-ID (0 = ohne Match). */
export interface TaskImportAnalyzerInput {
	id: number;
	title: string;
	deadline: Date | null;
	priority: number;
}

/**
 * Funktionssignatur des Import-Analyzers (#1988) — injizierbar, damit Tests ohne echten API-Call
 * laufen. Fehler (Quota, Upstream, Format) wirft der Default-Aufruf; die Route degradiert still
 * auf die Grundform des Berichts.
 */
export type TaskImportAnalyzer = (tasks: TaskImportAnalyzerInput[], userId?: number) => Promise<TaskImportSuggestion[]>;

/** Obergrenze der Vorschläge je Analyse — begrenzt Prompt- und Antwortgröße bei 5000-Zeilen-Imports. */
const MAX_IMPORT_SUGGESTIONS = 20;

const buildImportAnalyzerSystemPrompt = (): string =>
	[
		'Du erkennst Abhängigkeiten zwischen importierten Aufgaben (Vorgänger-Verhältnisse).',
		'Du bekommst Aufgaben als Liste mit id, title, deadline und priority.',
		'Schlage nur Kanten vor, deren beide IDs in der Liste stehen, und nur wenn Titel oder Frist das Verhältnis nahelegen.',
		'',
		'Antworte ausschließlich mit einem JSON-Array (keine Erklärung, kein Markdown), maximal 20 Einträge:',
		'[{ "dependentTaskId": <ID der übergeordneten Aufgabe>, "dependingTaskId": <ID des Vorgängers>, "reason": <kurze Begründung> }]',
		'Ohne plausible Kanten: []',
	].join('\n');

/** Realer Import-Analyzer (Muster {@link parseTaskTextWithMistral}): Vermutungen aus Titeln/Fristen. */
export const suggestTaskDependenciesWithMistral: TaskImportAnalyzer = async (tasks, userId) => {
	const known = tasks.filter((task) => task.id > 0);
	if (known.length < 2) return [];
	const parsed = await requestModelJson(
		[
			{ role: 'system', content: buildImportAnalyzerSystemPrompt() },
			{
				role: 'user',
				content: known
					.map((task) => `- id=${task.id} title="${task.title}" deadline=${task.deadline?.toISOString() ?? '-'}`)
					.join('\n'),
			},
		],
		undefined,
		userId,
	);
	if (!Array.isArray(parsed)) return [];
	const titleById = new Map(known.map((task) => [task.id, task.title]));
	const suggestions: TaskImportSuggestion[] = [];
	for (const raw of parsed) {
		if (typeof raw !== 'object' || raw === null) continue;
		const entry = raw as Record<string, unknown>;
		const dependentTaskId = entry.dependentTaskId;
		const dependingTaskId = entry.dependingTaskId;
		if (
			typeof dependentTaskId !== 'number' ||
			typeof dependingTaskId !== 'number' ||
			dependentTaskId === dependingTaskId ||
			!titleById.has(dependentTaskId) ||
			!titleById.has(dependingTaskId) ||
			typeof entry.reason !== 'string' ||
			entry.reason.trim() === ''
		) {
			continue;
		}
		suggestions.push({
			dependentTaskId,
			dependingTaskId,
			title: titleById.get(dependentTaskId) ?? '',
			reason: entry.reason.trim(),
		});
		if (suggestions.length >= MAX_IMPORT_SUGGESTIONS) break;
	}
	return suggestions;
};
