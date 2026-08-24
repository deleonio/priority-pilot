import { Router } from 'express';
import type { Response } from 'express';
import type { components } from '../../api';
import {
	createProvider,
	deleteProvider,
	activateProvider,
	listProviders,
	updateProvider,
} from '../../llm/llmProviders.js';

type LlmProviderDto = components['schemas']['LlmProvider'];
type LlmProviderInputDto = components['schemas']['LlmProviderInput'];
type LlmProviderUpdateDto = components['schemas']['LlmProviderUpdate'];
type ErrorDto = components['schemas']['Error'];

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/** Prüft, ob ein String eine gültige http(s)-URL ist (Spec Journey 2: „Endpoint muss gültiges URL-Format haben"). */
const isValidHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

type CreateValidation = { ok: true; input: LlmProviderInputDto } | { ok: false; message: string };

const validateCreate = (body: unknown): CreateValidation => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const raw = body as Record<string, unknown>;
	for (const field of ['name', 'endpoint', 'apiKey', 'model'] as const) {
		if (!isNonEmptyString(raw[field])) {
			return { ok: false, message: `${field} muss ein nicht-leerer String sein.` };
		}
	}
	if (!isValidHttpUrl((raw.endpoint as string).trim())) {
		return { ok: false, message: 'endpoint muss eine gültige http(s)-URL sein.' };
	}
	return {
		ok: true,
		input: {
			name: (raw.name as string).trim(),
			endpoint: (raw.endpoint as string).trim(),
			apiKey: (raw.apiKey as string).trim(),
			model: (raw.model as string).trim(),
		},
	};
};

type UpdateValidation = { ok: true; input: LlmProviderUpdateDto } | { ok: false; message: string };

const validateUpdate = (body: unknown): UpdateValidation => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const raw = body as Record<string, unknown>;
	const input: LlmProviderUpdateDto = {};
	for (const field of ['name', 'endpoint', 'model'] as const) {
		if (raw[field] === undefined) continue;
		if (!isNonEmptyString(raw[field])) {
			return { ok: false, message: `${field} muss ein nicht-leerer String sein.` };
		}
		input[field] = (raw[field] as string).trim();
	}
	if (raw.apiKey !== undefined) {
		// Leerer String = unverändert (Bearbeiten-Dialog startet mit leerem Key-Feld).
		if (typeof raw.apiKey !== 'string' || raw.apiKey.trim().length === 0) {
			if (raw.apiKey !== '') {
				return { ok: false, message: 'apiKey muss ein String sein (leer = unverändert).' };
			}
		} else {
			input.apiKey = raw.apiKey.trim();
		}
	}
	return { ok: true, input };
};

const parseId = (value: string): number | null => {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : null;
};

export const llmProvidersRouter = Router();

/**
 * `GET /llm-providers` (#951): alle konfigurierten Provider inklusive Aktiv-Markierung —
 * ohne API-Keys (Write-Only). Löst die Lazy-Migration der Legacy-`llm-config`-Keys aus.
 */
llmProvidersRouter.get('/llm-providers', async (_req, res: Response<LlmProviderDto[] | ErrorDto>) => {
	try {
		res.json(await listProviders());
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/** `POST /llm-providers` (#951): Provider anlegen — der erste wird direkt aktiv. */
llmProvidersRouter.post('/llm-providers', async (req, res: Response<LlmProviderDto | ErrorDto>) => {
	const validation = validateCreate(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	try {
		res.status(201).json(await createProvider(validation.input));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/**
 * `PUT /llm-providers/{id}` (#951): Provider bearbeiten — abwesende Felder unverändert,
 * `apiKey` nur bei nicht-leerem String (Bearbeiten-Dialog startet leer).
 */
llmProvidersRouter.put('/llm-providers/:id', async (req, res: Response<LlmProviderDto | ErrorDto>) => {
	const validation = validateUpdate(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	const id = parseId(req.params.id);
	if (id === null) {
		sendError(res, 400, 'Provider-ID muss eine positive Ganzzahl sein.');
		return;
	}
	try {
		res.json(await updateProvider(id, validation.input));
	} catch (error) {
		if (error instanceof Error && error.message === 'NOT_FOUND') {
			sendError(res, 404, 'Provider nicht gefunden.');
			return;
		}
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/** `DELETE /llm-providers/{id}` (#951): Provider löschen. */
llmProvidersRouter.delete('/llm-providers/:id', async (req, res: Response<ErrorDto | { message: string }>) => {
	const id = parseId(req.params.id);
	if (id === null) {
		res.status(400).json({ message: 'Provider-ID muss eine positive Ganzzahl sein.' });
		return;
	}
	try {
		await deleteProvider(id);
		res.status(204).end();
	} catch (error) {
		if (error instanceof Error && error.message === 'NOT_FOUND') {
			res.status(404).json({ message: 'Provider nicht gefunden.' });
			return;
		}
		res.status(500).json({ message: 'Interner Serverfehler.' });
	}
});

/** `POST /llm-providers/{id}/activate` (#951): Provider aktivieren, alle anderen deaktivieren. */
llmProvidersRouter.post('/llm-providers/:id/activate', async (req, res: Response<LlmProviderDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	if (id === null) {
		sendError(res, 400, 'Provider-ID muss eine positive Ganzzahl sein.');
		return;
	}
	try {
		res.json(await activateProvider(id));
	} catch (error) {
		if (error instanceof Error && error.message === 'NOT_FOUND') {
			sendError(res, 404, 'Provider nicht gefunden.');
			return;
		}
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
