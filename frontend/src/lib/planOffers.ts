import type { components } from 'client';
import i18next from '../i18n/config';

/** Paket laut Serververtrag (`openapi.yml` → `Plan`). */
export type Plan = components['schemas']['Plan'];

/** Feature-Identifier laut Serververtrag (`openapi.yml` → `FeatureCatalogEntry.feature`). */
export type FeatureId = components['schemas']['FeatureCatalogEntry']['feature'];

/** Auswertung eines Features für das Paket des Nutzers (`GET /auth/me` → `entitlements`). */
export type FeatureEntitlement = components['schemas']['FeatureEntitlement'];

/** Entitlement-Map aus `GET /auth/me`; der Server liefert jeden Feature-Identifier. */
export type EntitlementMap = Partial<Record<FeatureId, FeatureEntitlement>>;

/**
 * Anzeigenamen der Pakete (#1458). Bewusst nur Beschriftungen: **keine** Rangfolge, kein Vergleich —
 * ob ein Feature enthalten ist, entscheidet allein `entitlements[feature].allowed` vom Server (AK4).
 */
const PLAN_LABELS: Record<Plan, string> = {
	free: 'Free',
	plus: 'Plus',
	pro: 'Pro',
};

/** Beschriftung eines Pakets; unbekannte Werte werden unverändert durchgereicht. */
export const planLabel = (plan: string): string => PLAN_LABELS[plan as Plan] ?? plan;

/** Abrechnungszeiträume der Pakete in Anzeigereihenfolge. */
export const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
export type Period = (typeof PERIODS)[number];
/** Anzeigename eines Zeitraums in der aktiven Sprache. */
export const periodLabel = (period: string): string => i18next.t(`billing:periods.${period}`);

/**
 * Nutzentexte je Feature — die EINE zentrale Stelle (AK5), Texte unter `billing:features.<key>`. Angebotsdialog und Badge adressieren sie
 * über den Feature-Identifier aus dem Serververtrag; T3b (#1484), T6 und T7 rollen weitere Stellen
 * aus, ohne neue Texte anzulegen. Preise stehen hier bewusst NICHT — die kommen aus `GET /plans`.
 */
const FEATURE_KEYS: Record<FeatureId, string> = {
	groups: 'groups',
	voice_input: 'voiceInput',
	ai_assist: 'aiAssist',
	graph_write: 'graphWrite',
	graph_weight: 'graphWeight',
	location_reminders: 'locationReminders',
	mcp_readwrite: 'mcpReadwrite',
	mcp_read: 'mcpRead',
	feedback: 'feedback',
	sync: 'sync',
	knowledge_entries: 'knowledgeEntries',
};

/** Angebotstext zu einem Feature; unbekannte Identifier bekommen einen neutralen Text. */
export const featureOffer = (feature: string): { title: string; benefit: string } => {
	const key = Object.hasOwn(FEATURE_KEYS, feature) ? FEATURE_KEYS[feature as FeatureId] : 'fallback';
	return { title: i18next.t(`billing:features.${key}.title`), benefit: i18next.t(`billing:features.${key}.benefit`) };
};

/** Fair-Use-Drossel-Intervall in Sekunden — Spiegel von `AI_FAIR_USE_INTERVAL_SECONDS` (server/src/logics/plans.ts). */
export const AI_FAIR_USE_INTERVAL_SECONDS = 30;

/** Freundlicher Drossel-Hinweis (#1783 AK5) — nennt die Wartezeit, nie eine Anzahl Anfragen. */
export const fairUseMessage = (seconds: number): string => i18next.t('billing:fairUse', { count: seconds });

/** Monatsäquivalent der Jahreszahlung in Cent — Spiegel von `yearlyMonthlyEquivalent` (server/src/logics/plans.ts, #1898). */
export const yearlyMonthlyEquivalent = (yearlyCents: number): number | null =>
	yearlyCents === 0 ? null : Math.floor(yearlyCents / 12);
