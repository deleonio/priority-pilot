import { Router } from 'express';
import type { Request, Response } from 'express';
import { lektoratTextWithMistral, MissingApiKeyError, MistralRequestError } from '../../llm/llm.js';
import { validateProviderQuery } from '../llmProviderQuery.js';

type ErrorDto = { message: string };

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	// `{ message }` wie alle übrigen Routen — toApiError (Frontend) liest exakt dieses Feld.
	res.status(status).json({ message });
};

/**
 * Validiert den Body von `POST /lektorat`: `text` Pflicht (nicht-leer),
 * `maxLength` optional (positiv, wenn gesetzt).
 */
const validateBody = (
	body: unknown,
): { ok: true; value: { text: string; maxLength?: number } } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { text, maxLength } = body as Record<string, unknown>;

	// `text` fehlt → 400
	if (text === undefined || text === null) {
		return { ok: false, message: 'text ist erforderlich.' };
	}

	// `text` muss String sein
	if (typeof text !== 'string') {
		return { ok: false, message: 'text muss ein String sein.' };
	}

	const trimmed = text.trim();

	// Leerer/Whitespace-only Text → 400
	if (trimmed === '') {
		return { ok: false, message: 'text darf nicht leer sein.' };
	}

	// `maxLength` optional, aber wenn gesetzt: positiv
	if (maxLength !== undefined && maxLength !== null) {
		if (typeof maxLength !== 'number') {
			return { ok: false, message: 'maxLength muss eine Zahl sein.' };
		}
		if (!Number.isFinite(maxLength)) {
			return { ok: false, message: 'maxLength muss eine endliche Zahl sein.' };
		}
		if (maxLength <= 0) {
			return { ok: false, message: 'maxLength muss positiv sein.' };
		}
	}

	return { ok: true, value: { text: trimmed, maxLength: maxLength ?? undefined } };
};

/**
 * Router für `POST /lektorat`. Lektorisiert Texte optional mit Maximallänge.
 * Auth via Session (requireAuth in index.ts VOR diesem Router registriert) — der Endpunkt
 * triggert die bezahlte LLM-Kaskade und ist daher kein öffentlicher Hebel.
 */
export const lektoratRouter = (): Router => {
	const router = Router();

	router.post('/lektorat', async (req: Request, res: Response<{ text: string } | ErrorDto>) => {
		// Provider-Query-Parameter validieren (#749)
		const providerValidation = validateProviderQuery(req.query as Record<string, unknown>);
		if (!providerValidation.ok) {
			sendError(res, 400, providerValidation.message);
			return;
		}
		const provider = providerValidation.provider;

		const validation = validateBody(req.body);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}

		try {
			const result = await lektoratTextWithMistral(
				{
					text: validation.value.text,
					maxLength: validation.value.maxLength,
				},
				provider,
			);
			res.json({ text: result.text });
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
	});

	return router;
};
