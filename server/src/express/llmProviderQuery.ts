import { findProviderByName } from '../llm/llmProviders.js';
import type { LlmProvider } from '../llm/llm.js';

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
