import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	suggestInitialTasksWithMistral,
	type InitialTaskSuggester,
	type PillarOption,
	type SuggestedInitialTask,
} from '../../llm/llm.js';
import { Pillar } from '../../models/index.js';
import { sendError } from '../http-error.js';
import { sendLlmError, validateProviderQuery } from '../llmProviderQuery.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';
import { meterAiQuota } from '../aiQuotaMeter.js';
import type { components } from '../../api';

type SuggestInitialTasksResponseDto = components['schemas']['SuggestInitialTasksResponse'];
type ErrorDto = components['schemas']['Error'];

/** Maximale Länge des zu verarbeitenden Freitexts (Muster `parseTasks.ts`). */
const MAX_TEXT_LENGTH = 2000;

/** Prüft den Body `{ text: string }` (identische Message-Struktur wie `parseTasks.ts`). */
const validateText = (body: unknown): { ok: true; text: string } | { ok: false; message: string } => {
	const { text } = (body ?? {}) as { text?: unknown };
	if (typeof text !== 'string' || text.trim() === '') {
		return { ok: false, message: 'text muss ein nicht-leerer String sein.' };
	}
	if (text.length > MAX_TEXT_LENGTH) {
		return { ok: false, message: `text darf maximal ${MAX_TEXT_LENGTH} Zeichen haben.` };
	}
	return { ok: true, text };
};

/** Eintrag der Suggester-Ausgabe, sofern Titel und pillarId typ-korrekt sind. */
type SuggestionCandidate = {
	title: string;
	pillarId: number;
	dependsOn?: unknown;
	originalIndex: number;
};

const parseSuggestion = (entry: unknown, originalIndex: number): SuggestionCandidate | undefined => {
	if (typeof entry !== 'object' || entry === null) {
		return undefined;
	}
	const { title, pillarId, dependsOn } = entry as Record<string, unknown>;
	if (typeof title !== 'string' || title.trim() === '') {
		return undefined;
	}
	if (typeof pillarId !== 'number' || !Number.isInteger(pillarId)) {
		return undefined;
	}
	return { title: title.trim(), pillarId, dependsOn, originalIndex };
};

/**
 * Bereinigt die Suggester-Ausgabe (#2068 AK2): verworfen werden Einträge mit leerem/fehlendem
 * Titel, unbekannter `pillarId` (nicht unter den Säulen des Nutzers) oder ungültigem `dependsOn` —
 * ein Verweis muss auf einen ANDEREN überlebenden Vorschlag zeigen. Gültige Verweise werden auf
 * die Position in der bereinigten Liste umgerechnet. Die Bereinigung ist kein Fehlerfall: Auch
 * eine Restliste unter 5 Einträgen antwortet 200.
 */
const sanitizeSuggestions = (raw: unknown, validIds: ReadonlySet<number>): SuggestedInitialTask[] => {
	if (!Array.isArray(raw)) {
		return [];
	}
	// Schritt 1 — Form und Säulen-Scope; die ursprüngliche Position bleibt für die Verweis-Prüfung
	// erhalten, denn ein Verweis zählt nur, wenn sein ZIEL die Bereinigung überlebt.
	const candidates = raw.flatMap((entry, originalIndex) => {
		const parsed = parseSuggestion(entry, originalIndex);
		return parsed && validIds.has(parsed.pillarId) ? [parsed] : [];
	});
	const surviving = new Set(candidates.map(({ originalIndex }) => originalIndex));

	// Schritt 2 — Verweise: `dependsOn` muss auf einen ANDEREN überlebenden Vorschlag zeigen
	// (kein Integer, eigener Index oder toter Verweis → Eintrag fliegt); zeigt ein Verweis auf
	// einen selbst verworfenen Eintrag, kaskadiert der Eintrag mit raus. Gültige Verweise werden
	// auf die Position in der bereinigten Liste umgerechnet.
	const deadDependency = (dependsOn: unknown, originalIndex: number): boolean =>
		typeof dependsOn !== 'number' ||
		!Number.isInteger(dependsOn) ||
		dependsOn === originalIndex ||
		!surviving.has(dependsOn);
	let changed = true;
	while (changed) {
		changed = false;
		for (const { dependsOn, originalIndex } of candidates) {
			if (surviving.has(originalIndex) && dependsOn !== undefined && deadDependency(dependsOn, originalIndex)) {
				surviving.delete(originalIndex);
				changed = true;
			}
		}
	}
	const finalIndexOf = new Map(
		candidates
			.filter(({ originalIndex }) => surviving.has(originalIndex))
			.map(({ originalIndex }, position) => [originalIndex, position]),
	);

	const suggestions: SuggestedInitialTask[] = [];
	for (const { title, pillarId, dependsOn, originalIndex } of candidates) {
		if (!surviving.has(originalIndex)) {
			continue;
		}
		const suggestion: SuggestedInitialTask = { title, pillarId };
		const finalIndex = typeof dependsOn === 'number' ? finalIndexOf.get(dependsOn) : undefined;
		if (finalIndex !== undefined) {
			suggestion.dependsOn = finalIndex;
		}
		suggestions.push(suggestion);
	}
	return suggestions;
};

/**
 * Erstellt den Router für `POST /tasks/suggest-initial` (Erststart-Flow, #2068): Freitext →
 * 5–8 Aufgaben-Vorschläge mit Säulen-Bezug. Es werden keine Tasks angelegt, nur vorgeschlagen.
 * Der Suggester ist injizierbar (Default: realer LLM-Aufruf), damit Tests ohne echten API-Call laufen.
 */
export const createSuggestInitialTasksRouter = (
	suggester: InitialTaskSuggester = suggestInitialTasksWithMistral,
): Router => {
	const router = Router();

	router.post(
		'/tasks/suggest-initial',
		requirePlanFeature('ai_assist'),
		meterAiQuota(),
		async (req: Request, res: Response<SuggestInitialTasksResponseDto | ErrorDto>) => {
			// Provider-Query-Parameter validieren (#749)
			const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
			if (!providerValidation.ok) {
				sendError(res, 400, providerValidation.message);
				return;
			}
			const provider = providerValidation.provider;

			const validation = validateText(req.body);
			if (!validation.ok) {
				sendError(res, 400, validation.message);
				return;
			}

			// Säulen des Nutzers als gültigen Bezug (Muster `suggestPillars.ts`): ohne eigene Säulen
			// gäbe es nichts, worauf Vorschläge verweisen könnten.
			let pillars: Pillar[];
			try {
				pillars = await Pillar.findAll({ where: ownerScope(getUserId(req)), order: [['id', 'ASC']] });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
				return;
			}
			if (pillars.length === 0) {
				sendError(res, 503, 'Es sind keine Säulen konfiguriert.');
				return;
			}

			const options: PillarOption[] = pillars.map((pillar) => ({ id: pillar.id, name: pillar.name }));
			try {
				const raw = await suggester(validation.text, provider, options, getUserId(req));
				const validIds = new Set(options.map((option) => option.id));
				res.json({ suggestions: sanitizeSuggestions(raw, validIds) });
			} catch (error) {
				sendLlmError(res, error);
			}
		},
	);

	return router;
};
