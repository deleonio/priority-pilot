import { Router } from 'express';
import type { Response } from 'express';
import type { components } from '../../api';
import {
	activateProvider,
	createProvider,
	deleteProvider,
	listProviders,
	toRuntimeConfig,
	updateProvider,
	type ProviderRuntime,
} from '../../llm/llmProviders.js';
import { LlmProvider } from '../../models/index.js';

type LlmProviderDto = components['schemas']['LlmProvider'];
type LlmProviderInputDto = components['schemas']['LlmProviderInput'];
type LlmProviderUpdateDto = components['schemas']['LlmProviderUpdate'];
type LlmModelDto = components['schemas']['LlmModel'];
type ErrorDto = components['schemas']['Error'];

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/** Prüft, ob ein String eine gültige http(s)-URL ist. */
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
	for (const field of ['name', 'endpoint', 'apiKey'] as const) {
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

/** Ordnet Fehler der Service-Schicht auf HTTP-Status/Message — false = nicht behandelt. */
const sendServiceError = (res: Response<ErrorDto>, error: unknown): boolean => {
	if (!(error instanceof Error)) return false;
	if (error.message === 'NOT_FOUND') {
		sendError(res, 404, 'Provider nicht gefunden.');
		return true;
	}
	if (error.message === 'BUILTIN_IMMUTABLE') {
		sendError(
			res,
			400,
			'Eingebaute Provider (Mistral/OpenRouter) sind fix — sie können nicht bearbeitet oder gelöscht werden. Frei sind nur Aktivierung und Modellwahl.',
		);
		return true;
	}
	return false;
};

// ─── Modellliste des Providers (`GET /llm-providers/{id}/models`) ───────────────

/** Wie lange eine einmal geladene Modellliste als „aktuell“ gilt (verhindert Upstream-Hämmern). */
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
/** Zeitlimit für den Upstream-Call — die Auswahl soll nicht minutenlang warten. */
const MODELS_UPSTREAM_TIMEOUT_MS = 8_000;

interface UpstreamModel {
	id: string;
	name?: string;
}

/**
 * Lädt die Modellliste eines Providers von dessen OpenAI-kompatiblen `GET /models`-Endpoint.
 * Akzeptiert beide gängigen Antwortformen (`{ data: [...] }` und nacktes Array); jeder Eintrag
 * braucht ein nicht-leeres `id` — `name` ist optional (Mistral liefert keins). Wirft bei jedem
 * Netzwerk-/Formatproblem; der Aufrufer antwortet 502.
 */
export const fetchProviderModelsFromUpstream = async (runtime: ProviderRuntime): Promise<LlmModelDto[]> => {
	const headers: Record<string, string> = {};
	if (runtime.apiKey !== '') {
		headers.Authorization = `Bearer ${runtime.apiKey}`;
	}
	const response = await fetch(`${runtime.baseUrl}/models`, {
		headers,
		signal: AbortSignal.timeout(MODELS_UPSTREAM_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`${runtime.label} antwortete mit HTTP ${response.status}.`);
	}
	const payload: unknown = await response.json();
	const raw = Array.isArray(payload) ? payload : (payload as { data?: unknown }).data;
	if (!Array.isArray(raw)) {
		throw new Error(`Ungültige Antwort von ${runtime.label} (keine Modellliste).`);
	}
	return raw
		.filter((model): model is UpstreamModel => {
			if (typeof model !== 'object' || model === null) return false;
			const id = (model as Record<string, unknown>).id;
			return typeof id === 'string' && id.trim() !== '';
		})
		.map((model) => ({
			id: model.id,
			name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id,
		}))
		.sort((a, b) => a.id.localeCompare(b.id));
};

/** Injizierbarer Upstream für Tests (deterministisch ohne echte Provider-Anbindung). */
export type FetchProviderModels = typeof fetchProviderModelsFromUpstream;

/** Modul-Level-Cache pro Provider-ID; Tests resettet ihn via `resetProviderModelsCache`. */
let modelsCache = new Map<number, { models: LlmModelDto[]; expiresAt: number }>();

/** Setzt den Modelllisten-Cache zurück — nur für Tests (definierter Kaltstart je Fall). */
export const resetProviderModelsCache = (): void => {
	modelsCache = new Map();
};

export const createLlmProvidersRouter = (
	fetchModels: FetchProviderModels = fetchProviderModelsFromUpstream,
): Router => {
	const router = Router();

	/**
	 * Alle Provider inklusive effektiver Aktiv-Markierung — Built-ins zuerst, ohne API-Keys
	 * (Write-Only). Legt fehlende Built-in-Zeilen lazy an.
	 */
	router.get('/llm-providers', async (_req, res: Response<LlmProviderDto[] | ErrorDto>) => {
		try {
			res.json(await listProviders());
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	/** Provider anlegen — inaktiv; die Aktivierung erfolgt über die Radio-Auswahl. */
	router.post('/llm-providers', async (req, res: Response<LlmProviderDto | ErrorDto>) => {
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
	 * Provider aktualisieren — abwesende Felder unverändert, `apiKey` nur bei nicht-leerem
	 * String. Für Built-ins ist nur `model` erlaubt (Modellwahl aus der Modellliste).
	 */
	router.put('/llm-providers/:id', async (req, res: Response<LlmProviderDto | ErrorDto>) => {
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
			if (!sendServiceError(res, error)) sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	/** Custom-Provider löschen (Built-ins sind fix). War er aktiv, greift der Built-in-Fallback. */
	router.delete('/llm-providers/:id', async (req, res: Response<ErrorDto | { message: string }>) => {
		const id = parseId(req.params.id);
		if (id === null) {
			res.status(400).json({ message: 'Provider-ID muss eine positive Ganzzahl sein.' });
			return;
		}
		try {
			await deleteProvider(id);
			res.status(204).end();
		} catch (error) {
			if (sendServiceError(res, error)) return;
			res.status(500).json({ message: 'Interner Serverfehler.' });
		}
	});

	/** Provider aktivieren (Radio-Button-Logik) — alle anderen werden deaktiviert. */
	router.post('/llm-providers/:id/activate', async (req, res: Response<LlmProviderDto | ErrorDto>) => {
		const id = parseId(req.params.id);
		if (id === null) {
			sendError(res, 400, 'Provider-ID muss eine positive Ganzzahl sein.');
			return;
		}
		try {
			res.json(await activateProvider(id));
		} catch (error) {
			if (sendServiceError(res, error)) return;
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	/**
	 * Verfügbare Modelle eines Providers: fragt dessen OpenAI-kompatiblen `GET /models`-Endpoint
	 * ab (mit Key, falls vorhanden) und cacht das Ergebnis kurz. Upstream-Fehler → 502.
	 */
	router.get('/llm-providers/:id/models', async (req, res: Response<{ models: LlmModelDto[] } | ErrorDto>) => {
		const id = parseId(req.params.id);
		if (id === null) {
			sendError(res, 400, 'Provider-ID muss eine positive Ganzzahl sein.');
			return;
		}
		let row: LlmProvider | null;
		try {
			row = await LlmProvider.findByPk(id);
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}
		if (row === null) {
			sendError(res, 404, 'Provider nicht gefunden.');
			return;
		}
		const cached = modelsCache.get(id);
		if (cached !== undefined && cached.expiresAt > Date.now()) {
			res.json({ models: cached.models });
			return;
		}
		try {
			const models = await fetchModels(toRuntimeConfig(row));
			modelsCache.set(id, { models, expiresAt: Date.now() + MODELS_CACHE_TTL_MS });
			res.json({ models });
		} catch {
			sendError(res, 502, 'Die Modellliste des Providers konnte nicht geladen werden.');
		}
	});

	return router;
};
