import { Router } from 'express';
import type { Response } from 'express';
import { LlmConfig } from '../../models/index.js';
import { DEFAULT_OPENROUTER_MODEL } from '../../llm/llm.js';
import type { components } from '../../api';

type LlmConfigDto = components['schemas']['LlmConfig'];
type ErrorDto = components['schemas']['Error'];

/** Die drei konfigurierbaren Felder — alle optional im Body, alle Pflicht in der Antwort. */
const CONFIG_FIELDS = ['mistralApiKey', 'openrouterApiKey', 'openrouterModel'] as const;

type ValidationResult = { ok: true; input: Partial<LlmConfigDto> } | { ok: false; message: string };

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/**
 * Serialisiert die persistierte Zeile (oder deren Fehlen) in die Vertragsform. Bewusst **ohne**
 * Env-Fallback: die API zeigt nur, was gespeichert wurde — Env-Secrets sollen nicht über die
 * Settings-UI auslesbar sein. Für `openrouterModel` gilt der Kaskaden-Default als Anzeigewert.
 */
const serialize = (stored: LlmConfig | null): LlmConfigDto => ({
	mistralApiKey: stored?.mistralApiKey ?? '',
	openrouterApiKey: stored?.openrouterApiKey ?? '',
	openrouterModel: stored?.openrouterModel || DEFAULT_OPENROUTER_MODEL,
});

/**
 * Validiert den Body von `PUT /llm-config` rein strukturell: jedes gesetzte Feld muss ein String
 * sein, und ein gesetzter Wert darf nicht ausschließlich aus Whitespace bestehen (ein leerer
 * String ist erlaubt — er bedeutet „nicht gesetzt", der Env-Fallback greift dann wieder).
 */
const validateBody = (body: unknown): ValidationResult => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const raw = body as Record<string, unknown>;
	const input: Partial<LlmConfigDto> = {};
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
 * `GET /llm-config` (#640): liefert die persistierte Konfiguration der Mistral/OpenRouter-Kaskade;
 * ohne gespeicherte Zeile die Defaults (leere Keys, `openrouter/free`).
 */
llmConfigRouter.get('/llm-config', async (_req, res: Response<LlmConfigDto | ErrorDto>) => {
	try {
		res.json(serialize(await LlmConfig.findOne({ order: [['id', 'ASC']] })));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/**
 * `PUT /llm-config` (#640): persistiert die Konfiguration als Singleton-Zeile. Nicht übergebene
 * Felder bleiben unverändert; bei ungültigem Payload 400 ohne Seiteneffekt.
 */
llmConfigRouter.put('/llm-config', async (req, res: Response<LlmConfigDto | ErrorDto>) => {
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
