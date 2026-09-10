import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	parseSearchQueryWithMistral,
	parseTaskTextWithMistral,
	type CategoryOption,
	type ParsedSearch,
	type ParsedTask,
	type ParseSearchParser,
	type ParseTaskParser,
} from '../../llm/llm.js';
import { Category } from '../../models/index.js';
import { sendLlmError, validateProviderQuery } from '../llmProviderQuery.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];

/** Maximale Länge des zu verarbeitenden Freitexts (beide Endpunkte). */
const MAX_TEXT_LENGTH = 2000;

/** Prüft den gemeinsamen Body `{ text: string }` beider Endpunkte. */
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

/**
 * Kategorien des eingeloggten Nutzers als Prompt-Vorgabe (Muster `suggestPillars.ts`: Die gültigen
 * Stammdaten kommen aus der DB, nicht aus dem Request). Best-Effort: Ein Lesefehler darf das
 * funktionierende Parsing nicht mit HTTP 500 reißen — dann läuft es eben ohne Kategorie-Erkennung.
 */
const loadCategoryOptions = async (req: Request): Promise<CategoryOption[]> => {
	try {
		const categories = await Category.findAll({ where: ownerScope(getUserId(req)), order: [['id', 'ASC']] });
		return categories.map((category) => ({ id: category.id, name: category.name }));
	} catch (error) {
		console.warn('Kategorien konnten nicht geladen werden — parse ohne Kategorie-Erkennung.', error);
		return [];
	}
};

/**
 * Erstellt den Router für `POST /tasks/parse-text` (Task-Schnellerfassung, #235) und
 * `POST /tasks/parse-search` (Suchanfrage in Suchbegriff + Kategorie zerlegen). Beide Parser sind
 * injizierbar (Default: realer LLM-Aufruf), damit Tests ohne echten API-Call laufen.
 */
export const createParseTasksRouter = (
	parser: ParseTaskParser = parseTaskTextWithMistral,
	searchParser: ParseSearchParser = parseSearchQueryWithMistral,
): Router => {
	const router = Router();

	// POST /tasks/parse-text — strukturierte Task-Felder aus Freitext extrahieren.
	// Optionaler Query-Parameter `provider` (#749): pinnt die LLM-Kaskade auf den genannten Provider.
	router.post('/tasks/parse-text', async (req: Request, res: Response<ParsedTask | ErrorDto>) => {
		// Provider-Query-Parameter validieren (#749)
		const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
		if (!providerValidation.ok) {
			res.status(400).json({ message: providerValidation.message });
			return;
		}
		const provider = providerValidation.provider;

		const validation = validateText(req.body);
		if (!validation.ok) {
			res.status(400).json({ message: validation.message });
			return;
		}

		try {
			const result = await parser(validation.text, provider, await loadCategoryOptions(req));
			res.json(result);
		} catch (error) {
			sendLlmError(res, error);
		}
	});

	// POST /tasks/parse-search — gesprochene/getippte Suchanfrage in Suchbegriff und Kategorie
	// zerlegen. Ohne angelegte Kategorien gäbe es nichts zu erkennen: Dann antwortet die Route
	// direkt mit dem unveränderten Text, statt einen LLM-Aufruf zu verbrennen.
	router.post('/tasks/parse-search', async (req: Request, res: Response<ParsedSearch | ErrorDto>) => {
		const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
		if (!providerValidation.ok) {
			res.status(400).json({ message: providerValidation.message });
			return;
		}
		const provider = providerValidation.provider;

		const validation = validateText(req.body);
		if (!validation.ok) {
			res.status(400).json({ message: validation.message });
			return;
		}

		const categories = await loadCategoryOptions(req);
		if (categories.length === 0) {
			res.json({ text: validation.text.trim() });
			return;
		}

		try {
			res.json(await searchParser(validation.text, provider, categories));
		} catch (error) {
			sendLlmError(res, error);
		}
	});

	return router;
};
