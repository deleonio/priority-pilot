import { Router } from 'express';
import type { Response } from 'express';
import { LlmConfig } from '../../models/index.js';
import { DEFAULT_OPENROUTER_MODEL } from '../../llm/llm.js';
import type { components } from '../../api';

type LlmConfigStatusDto = components['schemas']['LlmConfigStatus'];
type LlmConfigInputDto = components['schemas']['LlmConfigInput'];
type ErrorDto = components['schemas']['Error'];

/** Die drei konfigurierbaren Felder — alle optional im PUT-Body. */
const CONFIG_FIELDS = ['mistralApiKey', 'openrouterApiKey', 'openrouterModel'] as const;

type ValidationResult = { ok: true; input: LlmConfigInputDto } | { ok: false; message: string };

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/**
 * Serialisiert die persistierte Zeile (oder deren Fehlen) in den Status. Bewusst **ohne**
 * Key-Werte und **ohne** Env-Fallback: die API signalisiert nur, OB ein Key in der DB steht —
 * weder der Secret-Wert noch die bloße Anwesenheit einer Umgebungsvariable werden preisgegeben.
 * Für `openrouterModel` gilt der Default als Anzeigewert (das Modell ist nicht geheim).
 */
const serialize = (stored: LlmConfig | null): LlmConfigStatusDto => ({
	hasMistralApiKey: Boolean(stored?.mistralApiKey),
	hasOpenrouterApiKey: Boolean(stored?.openrouterApiKey),
	openrouterModel: stored?.openrouterModel || DEFAULT_OPENROUTER_MODEL,
});

/**
 * Validiert den Body von `PUT /llm-config` rein strukturell: jedes gesetzte Feld muss ein String
 * sein, und ein gesetzter Wert darf nicht ausschließlich aus Whitespace bestehen. Ein leerer
 * String ist erlaubt (er löscht den Key); ein **abwesendes** Feld bedeutet „unverändert" — die
 * Kaskade nutzt dann weiterhin den bisherigen Wert (DB → Env-Fallback).
 */
const validateBody = (body: unknown): ValidationResult => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const raw = body as Record<string, unknown>;
	const input: LlmConfigInputDto = {};
	for (const field of CONFIG_FIELDS) {
		const value = raw[field];
		if (value === undefined) continue;
		if (typeof value !== 'string') {
			return { ok: false, message: `${field} muss ein String sein.` };
		}
		if (value.length > 0 && value.trim().length === 0) {
			return { ok: false, message: `${field} darf nicht nur aus Leerzeichen bestehen.` };
		}
		input[field] = value.trim();
	}
	return { ok: true, input };
};

export const llmConfigRouter = Router();

/**
 * `GET /llm-config` (#640): Legacy-Endpoint (#640, Migration siehe #951): liefert den Status — ob jeweils ein
 * API-Key persistiert ist (Booleans) sowie das OpenRouter-Modell. Die Key-Werte selbst werden
 * bewusst nicht zurückgegeben (Write-Only). Ohne gespeicherte Zeile die Defaults.
 */
llmConfigRouter.get('/llm-config', async (_req, res: Response<LlmConfigStatusDto | ErrorDto>) => {
	try {
		res.json(serialize(await LlmConfig.findOne({ order: [['id', 'ASC']] })));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/**
 * `PUT /llm-config` (#640): persistiert die Konfiguration als Singleton-Zeile. Nicht übergebene
 * Felder bleiben unverändert; bei ungültigem Payload 400 ohne Seiteneffekt. Die Antwort liefert
 * den neuen Status — nicht die gespeicherten Key-Werte.
 */
llmConfigRouter.put('/llm-config', async (req, res: Response<LlmConfigStatusDto | ErrorDto>) => {
	const validation = validateBody(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}

	try {
		const existing = await LlmConfig.findOne({ order: [['id', 'ASC']] });
		const saved = existing ? await existing.update(validation.input) : await LlmConfig.create({ ...validation.input });
		res.json(serialize(saved));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
