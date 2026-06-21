import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pillar } from '../../models/index.js';
import {
	classifyPillarsWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type PillarClassifier,
} from '../../llm/mistral.js';
import type { components } from '../../api';

type SuggestPillarsInputDto = components['schemas']['SuggestPillarsInput'];
type PillarSuggestionDto = components['schemas']['PillarSuggestion'];
type ErrorDto = components['schemas']['Error'];

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/** Validiert den Body von `POST /tasks/suggest-pillars`: `title` Pflicht, `description`/`context` optional. */
const validateBody = (
	body: unknown,
): { ok: true; value: SuggestPillarsInputDto } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { title, description, context } = body as Record<string, unknown>;
	if (typeof title !== 'string' || title.trim() === '') {
		return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
	}
	if (description !== undefined && typeof description !== 'string') {
		return { ok: false, message: 'description muss ein String sein.' };
	}
	if (context !== undefined && typeof context !== 'string') {
		return { ok: false, message: 'context muss ein String sein.' };
	}
	return { ok: true, value: { title: title.trim(), description, context } };
};

/**
 * Erstellt den Router für `POST /tasks/suggest-pillars`. Der Klassifikator ist injizierbar
 * (Default: realer Mistral-Aufruf), damit Tests ohne echten API-Call laufen.
 */
export const createSuggestPillarsRouter = (classifier: PillarClassifier = classifyPillarsWithMistral): Router => {
	const router = Router();

	// POST /tasks/suggest-pillars — Säulen-Klassifikation (mit Konfidenz) für Titel/Beschreibung vorschlagen
	router.post(
		'/tasks/suggest-pillars',
		async (req: Request, res: Response<{ suggestions: PillarSuggestionDto[] } | ErrorDto>) => {
			const validation = validateBody(req.body);
			if (!validation.ok) {
				sendError(res, 400, validation.message);
				return;
			}

			let pillars: Pillar[];
			try {
				pillars = await Pillar.findAll({ order: [['id', 'ASC']] });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
				return;
			}
			if (pillars.length === 0) {
				sendError(res, 503, 'Es sind keine Säulen konfiguriert.');
				return;
			}

			try {
				const suggestions = await classifier({
					title: validation.value.title,
					description: validation.value.description ?? undefined,
					context: validation.value.context ?? undefined,
					pillars: pillars.map((pillar) => ({ id: pillar.id, name: pillar.name })),
				});
				res.json({ suggestions });
			} catch (error) {
				if (error instanceof MissingApiKeyError) {
					sendError(res, 503, error.message);
					return;
				}
				if (error instanceof MistralRequestError) {
					sendError(res, 502, error.message);
					return;
				}
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	return router;
};
