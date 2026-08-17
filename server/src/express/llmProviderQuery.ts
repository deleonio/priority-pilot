import type { LlmProvider } from '../llm/llm.js';

/**
 * Gültige Werte für den `provider`-Query-Parameter (LLM-Test-Schalter, #749).
 * Geteilt zwischen allen LLM-Routen, damit die Werteliste an einem Ort gepflegt wird.
 */
const VALID_PROVIDERS = new Set<string>(['mistral', 'openrouter']);

/**
 * Validiert den optionalen `provider`-Query-Parameter (#749) — für alle LLM-Routen
 * (`/pillars/advisor`, `/tasks/parse-text`, `/tasks/suggest-pillars`, `/lektorat`).
 * Fehlt er (oder ist leer) → undefined (Kaskade unverändert). Ungültiger Wert →
 * Fehlermeldung für HTTP 400.
 */
export const validateProviderQuery = (
	query: Record<string, unknown>,
): { ok: true; provider: LlmProvider } | { ok: false; message: string } => {
	const raw = query.provider;
	if (raw === undefined || raw === null || raw === '') {
		return { ok: true, provider: undefined };
	}
	if (typeof raw === 'string' && VALID_PROVIDERS.has(raw)) {
		// Narrowing über das geprüfte Set: raw ist hier nachweislich 'mistral' | 'openrouter'.
		return { ok: true, provider: raw as LlmProvider };
	}
	return {
		ok: false,
		message: `Ungültiger provider-Query-Parameter: "${String(raw)}". Erlaubt: "mistral", "openrouter".`,
	};
};
