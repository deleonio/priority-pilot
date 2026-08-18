import { Router } from 'express';
import type { Request, Response } from 'express';
import {
	parseTaskTextWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type ParsedTask,
	type ParseTaskParser,
} from '../../llm/llm.js';
import { validateProviderQuery } from '../llmProviderQuery.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];

/**
 * Erstellt den Router für `POST /tasks/parse-text` (Task-Schnellerfassung, #235). Der Parser ist
 * injizierbar (Default: realer Mistral-Aufruf), damit Tests ohne echten API-Call laufen.
 */
export const createParseTasksRouter = (parser: ParseTaskParser = parseTaskTextWithMistral): Router => {
	const router = Router();

	// POST /tasks/parse-text — strukturierte Task-Felder aus Freitext extrahieren.
	// Optionaler Query-Parameter `provider` (#749): pinnt die LLM-Kaskade auf den genannten Provider.
	router.post('/tasks/parse-text', async (req: Request, res: Response<ParsedTask | ErrorDto>) => {
		// Provider-Query-Parameter validieren (#749)
		const providerValidation = validateProviderQuery(req.query as Record<string, unknown>);
		if (!providerValidation.ok) {
			res.status(400).json({ message: providerValidation.message });
			return;
		}
		const provider = providerValidation.provider;

		const { text } = (req.body ?? {}) as { text?: unknown };

		if (typeof text !== 'string' || text.trim() === '') {
			res.status(400).json({ message: 'text muss ein nicht-leerer String sein.' });
			return;
		}

		if (text.length > 2000) {
			res.status(400).json({ message: 'text darf maximal 2000 Zeichen haben.' });
			return;
		}

		try {
			const result = await parser(text, provider);
			res.json(result);
		} catch (error) {
			if (error instanceof MissingApiKeyError) {
				res.status(503).json({ message: error.message });
				return;
			}
			if (error instanceof MistralRequestError) {
				res.status(502).json({ message: error.message });
				return;
			}
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	return router;
};
