/**
 * Rechte-Zentrale der Monetarisierung (Issue #1456, Teilaufgabe T1 des Gesamtkonzepts
 * `docs/gesamtkonzept-monetarisierung.md`): Feature-Katalog, Preise, Kontingente und die
 * Auswertung „darf Paket X Feature Y?" existieren genau EINMAL — hier. Routen, Guards und
 * das Frontend konsumieren ausschließlich `getPlansCatalog()` / `getEntitlements()` /
 * `shouldBlockFeature()`, statt die Matrix ein zweites Mal zu kodieren.
 */

/** Buchbares Paket eines Nutzers. Reihenfolge = Rangfolge (aufsteigend) und API-Vertrag. */
export type Plan = 'free' | 'pro' | 'max' | 'ultimate';
export const PLAN_VALUES: readonly Plan[] = ['free', 'pro', 'max', 'ultimate'];

/** Stabile Feature-Identifier — von Guards, Fehlervertrag und UI-Badges referenziert. */
export type FeatureId = 'groups' | 'voice_input' | 'ai_assist' | 'graph_write' | 'location_reminders' | 'mcp_readwrite';
export const FEATURE_IDS: readonly FeatureId[] = [
	'groups',
	'voice_input',
	'ai_assist',
	'graph_write',
	'location_reminders',
	'mcp_readwrite',
];

/** Monatliches KI-Kontingent je Paket — nur für `ai_assist` relevant. */
export const AI_ASSIST_MONTHLY_QUOTA: Record<Plan, number> = { free: 0, pro: 60, max: 110, ultimate: 200 };

interface PlanPrice {
	monthly: number;
	yearly: number;
}

interface FeatureCatalogEntry {
	feature: FeatureId;
	allowedPlans: readonly Plan[];
}

export interface PlansCatalog {
	features: readonly FeatureCatalogEntry[];
	prices: Record<Plan, PlanPrice>;
}

/**
 * Paket-Matrix laut Gesamtkonzept. `voice_input` ist bewusst für ALLE Pakete erlaubt: die
 * Spracheingabe läuft rein lokal im Browser, es gibt weder Server-Endpunkt noch Guard — der
 * Eintrag existiert nur, damit die UI ein Anzeige-Entitlement hat (AK10).
 */
const FEATURE_CATALOG: readonly FeatureCatalogEntry[] = [
	{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] },
	{ feature: 'voice_input', allowedPlans: ['free', 'pro', 'max', 'ultimate'] },
	{ feature: 'ai_assist', allowedPlans: ['pro', 'max', 'ultimate'] },
	{ feature: 'graph_write', allowedPlans: ['max', 'ultimate'] },
	{ feature: 'location_reminders', allowedPlans: ['max', 'ultimate'] },
	{ feature: 'mcp_readwrite', allowedPlans: ['max', 'ultimate'] },
];

/** Preise je Paket in Euro (Monats-/Jahresabrechnung), laut Gesamtkonzept. */
const PLAN_PRICES: Record<Plan, PlanPrice> = {
	free: { monthly: 0, yearly: 0 },
	pro: { monthly: 4, yearly: 40 },
	max: { monthly: 9, yearly: 90 },
	ultimate: { monthly: 19, yearly: 190 },
};

/** Katalog + Preise — einzige Quelle, von `GET /plans` unverändert durchgereicht. */
export function getPlansCatalog(): PlansCatalog {
	return { features: FEATURE_CATALOG, prices: PLAN_PRICES };
}

interface FeatureEntitlement {
	/** Wahrheitsgemäße Auswertung des Pakets — UNABHÄNGIG von `MONETIZATION_ENFORCED`. */
	allowed: boolean;
	/** Kleinstes Paket, das das Feature enthält. */
	requiredPlan: Plan;
	/** Nur bei `ai_assist` gesetzt: Rest des Monatskontingents (T4 zieht den Verbrauch ab). */
	quotaRemaining?: number;
}
export type EntitlementMap = Record<FeatureId, FeatureEntitlement>;

/** Kleinstes Paket der Rangfolge, das `feature` enthält. */
const requiredPlanFor = (entry: FeatureCatalogEntry): Plan =>
	PLAN_VALUES.find((plan) => entry.allowedPlans.includes(plan)) ?? 'ultimate';

/**
 * Entitlement-Map je Feature für `plan`. Bewusst unabhängig vom Rollout-Schalter: die Map ist die
 * wahrheitsgemäße Paketauswertung, aus der die UI Badges und Hinweise rendert (Gesamtkonzept
 * „gemessen ab T1, durchgesetzt erst in T8"). Ob tatsächlich geblockt wird, entscheidet allein
 * `shouldBlockFeature()`.
 */
export function getEntitlements(plan: Plan): EntitlementMap {
	const map = {} as EntitlementMap;
	for (const entry of FEATURE_CATALOG) {
		const allowed = entry.allowedPlans.includes(plan);
		const entitlement: FeatureEntitlement = { allowed, requiredPlan: requiredPlanFor(entry) };
		if (entry.feature === 'ai_assist') {
			entitlement.quotaRemaining = AI_ASSIST_MONTHLY_QUOTA[plan];
		}
		map[entry.feature] = entitlement;
	}
	return map;
}

/**
 * Rollout-Schalter `MONETIZATION_ENFORCED` (Default: aus). Pro Aufruf gelesen und nicht gecacht,
 * damit ein Umschalten ohne Neustart wirkt — und Tests den Schalter setzen können.
 */
export function isMonetizationEnforced(): boolean {
	const raw = process.env.MONETIZATION_ENFORCED?.trim().toLowerCase();
	return raw === 'true' || raw === '1';
}

/**
 * Zentrale Durchsetzungs-Abfrage (AK9): bei ausgeschaltetem Rollout IMMER `false` — kein Guard
 * blockt. Bei eingeschaltetem Rollout `true`, wenn das Paket das Feature nicht enthält.
 */
export function shouldBlockFeature(plan: Plan, feature: FeatureId): boolean {
	if (!isMonetizationEnforced()) {
		return false;
	}
	return getEntitlements(plan)[feature].allowed === false;
}
