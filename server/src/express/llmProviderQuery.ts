import { findProviderByName } from '../llm/llmProviders.js';
import { MissingApiKeyError, MistralRequestError } from '../llm/llm.js';
import type { LlmProvider } from '../llm/llm.js';
import type { Response } from 'express';
import type { components } from '../api.js';

/**
 * Sendet einen LLM-Fehler einheitlich für ALLE LLM-Routen — inkl. Handlungshinweis, wo der
 * Nutzer den Provider prüfen kann. Ohne den Hinweis bleibt unklar, dass „HTTP 402: Check your
 * subscription“ & Co. über Einstellungen → KI-Provider (Testen-Button) diagnostizierbar sind.
 *
 * - {@link MissingApiKeyError} → 503 (kein Provider/Key/Modell)
 * - {@link MistralRequestError} → 502 (Upstream-Fehler inkl. Detail, siehe callProvider)
 * - alles andere → 500 (intern, unverändert ohne Hinweis)
 */
export const sendLlmError = (res: Response<components['schemas']['Error']>, error: unknown): void => {
	if (error instanceof MissingApiKeyError) {
		res.status(503).json({ message: `${error.message} (Einstellungen → KI-Provider: „Testen“ zeigt die Ursache.)` });
		return;
	}
	if (error instanceof MistralRequestError) {
		res.status(502).json({ message: `${error.message} (Einstellungen → KI-Provider: „Testen“ zeigt die Ursache.)` });
		return;
	}
	res.status(500).json({ message: 'Interner Serverfehler.' });
};

/**
 * Validiert den optionalen `provider`-Query-Parameter — für alle LLM-Routen
 * (`/pillars/advisor`, `/tasks/parse-text`, `/tasks/suggest-pillars`, `/lektorat`).
 *
 * Fehlt er (oder ist leer) → undefined (Standard-Auflösung: der effektiv aktive
 * Provider, inkl. Built-in-Fallback). Gültig ist der Name eines konfigurierten
 * Providers — seit den Built-ins auch „mistral“/„openrouter“ (DB-Auflösung,
 * Case-insensitiv). Alles andere → HTTP 400.
 */
export const validateProviderQuery = async (
	query: Record<string, unknown>,
): Promise<{ ok: true; provider: LlmProvider } | { ok: false; message: string }> => {
	const raw = query.provider;
	if (raw === undefined || raw === null || raw === '') {
		return { ok: true, provider: undefined };
	}
	if (typeof raw !== 'string' || raw.length > 64) {
		return {
			ok: false,
			message: `Ungültiger provider-Query-Parameter: "${String(raw)}". Erlaubt: der Name eines konfigurierten Providers.`,
		};
	}
	const provider = await findProviderByName(raw);
	if (provider !== null) {
		return { ok: true, provider: raw };
	}
	return {
		ok: false,
		message: `Ungültiger provider-Query-Parameter: "${String(raw)}". Erlaubt: der Name eines konfigurierten Providers.`,
	};
};
