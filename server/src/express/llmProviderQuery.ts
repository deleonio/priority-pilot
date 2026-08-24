import { findProviderByName } from '../llm/llmProviders.js';
import type { LlmProvider } from '../llm/llm.js';

/**
 * Legacy-Werte des `provider`-Query-Parameters (LLM-Test-Schalter, #749) — fest
 * verdrahtet für die Kaskade. Dazu kommen seit #951 die Namen aller dynamisch
 * konfigurierten `llm_providers` (DB-Lookup, Case-insensitiv).
 */
const LEGACY_PROVIDERS = new Set<string>(['mistral', 'openrouter']);

/**
 * Validiert den optionalen `provider`-Query-Parameter — für alle LLM-Routen
 * (`/pillars/advisor`, `/tasks/parse-text`, `/tasks/suggest-pillars`, `/lektorat`).
 *
 * Fehlt er (oder ist leer) → undefined (Standard-Auflösung: aktiver Provider bzw.
 * Kaskade). Gültig sind die Legacy-Namen `mistral`/`openrouter` sowie der Name
 * eines konfigurierten dynamischen Providers (#951). Alles andere → HTTP 400.
 *
 * Async, weil die dynamischen Namen aus der DB stammen — die Legacy-Prüfung ist
 * billig, der DB-Lookup läuft nur für nicht-Legacy-Werte.
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
			message: `Ungültiger provider-Query-Parameter: "${String(raw)}". Erlaubt: "mistral", "openrouter" oder ein konfigurierter Provider-Name.`,
		};
	}
	if (LEGACY_PROVIDERS.has(raw)) {
		return { ok: true, provider: raw };
	}
	const dynamic = await findProviderByName(raw);
	if (dynamic !== null) {
		return { ok: true, provider: raw };
	}
	return {
		ok: false,
		message: `Ungültiger provider-Query-Parameter: "${raw}". Erlaubt: "mistral", "openrouter" oder ein konfigurierter Provider-Name.`,
	};
};
