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
export type FeatureId =
	'groups' | 'voice_input' | 'ai_assist' | 'graph_write' | 'location_reminders' | 'mcp_readwrite' | 'mcp_read';
export const FEATURE_IDS: readonly FeatureId[] = [
	'groups',
	'voice_input',
	'ai_assist',
	'graph_write',
	'location_reminders',
	'mcp_readwrite',
	'mcp_read',
];

/** Monatliches KI-Kontingent je Paket — nur für `ai_assist` relevant. */
export const AI_ASSIST_MONTHLY_QUOTA: Record<Plan, number> = { free: 0, pro: 60, max: 110, ultimate: 200 };

interface PlanPrice {
	monthly: number;
	quarterly: number;
	yearly: number;
}

type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

interface FeatureCatalogEntry {
	feature: FeatureId;
	allowedPlans: readonly Plan[];
}

export interface PlansCatalog {
	features: readonly FeatureCatalogEntry[];
	prices: Record<Plan, PlanPrice>;
}

/**
 * Paket-Matrix laut Gesamtkonzept. `voice_input` ist für jedes Paket enthalten, auch `free` — die
 * Spracheingabe läuft rein lokal im Browser, es gibt weder Server-Endpunkt noch Guard, der sie
 * einschränken könnte (#1524 AK1, macht die vormalige Pro-Sperre aus #1484 rückgängig). `mcp_read`
 * ist der lesende MCP-/API-Token-Zugriff, eine Stufe früher als `mcp_readwrite` (#1524 AK3).
 */
const FEATURE_CATALOG: readonly FeatureCatalogEntry[] = [
	{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] },
	{ feature: 'voice_input', allowedPlans: ['free', 'pro', 'max', 'ultimate'] },
	{ feature: 'ai_assist', allowedPlans: ['pro', 'max', 'ultimate'] },
	{ feature: 'graph_write', allowedPlans: ['max', 'ultimate'] },
	{ feature: 'location_reminders', allowedPlans: ['max', 'ultimate'] },
	{ feature: 'mcp_readwrite', allowedPlans: ['ultimate'] },
	{ feature: 'mcp_read', allowedPlans: ['max', 'ultimate'] },
];

/**
 * Preise je Paket in Cent (Monats-/Quartals-/Jahresabrechnung), laut Konzepttabelle
 * (`docs/gesamtkonzept-monetarisierung.md:75-81`). `quarterly`/`yearly` sind der kaufmännisch
 * gerundete Monatspreis mal 3×0,9 bzw. 12×0,8 (#1494 AK3).
 */
const PLAN_PRICES: Record<Plan, PlanPrice> = {
	free: { monthly: 0, quarterly: 0, yearly: 0 },
	pro: { monthly: 799, quarterly: 2157, yearly: 7670 },
	max: { monthly: 1499, quarterly: 4047, yearly: 14390 },
	ultimate: { monthly: 2499, quarterly: 6747, yearly: 23990 },
};

/**
 * PayPal-Abo-Plan-ID je kostenpflichtiger Kombination Paket×Zeitraum (#1494 AK4). `envVar` benennt
 * nur den Namen der Umgebungsvariable mit der echten Plan-ID zur Laufzeit — kein Secret im Code.
 * `amountCents` MUSS `PLAN_PRICES[plan][period]` entsprechen, damit ein Test jedes Auseinanderdriften
 * von Anzeige und hinterlegter Anbieter-Plan-ID bemerkt. `free` hat keinen Eintrag (kein Abo-Produkt).
 */
export const PAYPAL_PLAN_IDS: Record<
	Exclude<Plan, 'free'>,
	Record<BillingPeriod, { envVar: string; amountCents: number }>
> = {
	pro: {
		monthly: { envVar: 'PAYPAL_PLAN_ID_PRO_MONTHLY', amountCents: PLAN_PRICES.pro.monthly },
		quarterly: { envVar: 'PAYPAL_PLAN_ID_PRO_QUARTERLY', amountCents: PLAN_PRICES.pro.quarterly },
		yearly: { envVar: 'PAYPAL_PLAN_ID_PRO_YEARLY', amountCents: PLAN_PRICES.pro.yearly },
	},
	max: {
		monthly: { envVar: 'PAYPAL_PLAN_ID_MAX_MONTHLY', amountCents: PLAN_PRICES.max.monthly },
		quarterly: { envVar: 'PAYPAL_PLAN_ID_MAX_QUARTERLY', amountCents: PLAN_PRICES.max.quarterly },
		yearly: { envVar: 'PAYPAL_PLAN_ID_MAX_YEARLY', amountCents: PLAN_PRICES.max.yearly },
	},
	ultimate: {
		monthly: { envVar: 'PAYPAL_PLAN_ID_ULTIMATE_MONTHLY', amountCents: PLAN_PRICES.ultimate.monthly },
		quarterly: { envVar: 'PAYPAL_PLAN_ID_ULTIMATE_QUARTERLY', amountCents: PLAN_PRICES.ultimate.quarterly },
		yearly: { envVar: 'PAYPAL_PLAN_ID_ULTIMATE_YEARLY', amountCents: PLAN_PRICES.ultimate.yearly },
	},
};

/**
 * Google-Play-Abo-Produkt je kostenpflichtiger Kombination Paket×Zeitraum (ADR 0017): ein Produkt je
 * Paket, ein Base Plan je Zeitraum. Die IDs müssen exakt so in der Play Console angelegt sein; `free`
 * hat kein Produkt.
 */
export const PLAY_PRODUCTS: Record<
	Exclude<Plan, 'free'>,
	Record<BillingPeriod, { productId: string; basePlanId: string }>
> = {
	pro: {
		monthly: { productId: 'pro', basePlanId: 'monthly' },
		quarterly: { productId: 'pro', basePlanId: 'quarterly' },
		yearly: { productId: 'pro', basePlanId: 'yearly' },
	},
	max: {
		monthly: { productId: 'max', basePlanId: 'monthly' },
		quarterly: { productId: 'max', basePlanId: 'quarterly' },
		yearly: { productId: 'max', basePlanId: 'yearly' },
	},
	ultimate: {
		monthly: { productId: 'ultimate', basePlanId: 'monthly' },
		quarterly: { productId: 'ultimate', basePlanId: 'quarterly' },
		yearly: { productId: 'ultimate', basePlanId: 'yearly' },
	},
};

/** Paket und Zeitraum zu einem Play-Produkt mit Base Plan (Kaufbeleg, RTDN); `null` bei unbekannten IDs. */
export function planForPlayProduct(
	productId: string,
	basePlanId: string,
): { plan: Exclude<Plan, 'free'>; period: BillingPeriod } | null {
	for (const [plan, periods] of Object.entries(PLAY_PRODUCTS) as [Exclude<Plan, 'free'>, typeof PLAY_PRODUCTS.pro][]) {
		for (const [period, product] of Object.entries(periods) as [
			BillingPeriod,
			{ productId: string; basePlanId: string },
		][]) {
			if (product.productId === productId && product.basePlanId === basePlanId) {
				return { plan, period };
			}
		}
	}
	return null;
}

/** Katalog + Preise — einzige Quelle, von `GET /plans` unverändert durchgereicht. */
export function getPlansCatalog(): PlansCatalog {
	return { features: FEATURE_CATALOG, prices: PLAN_PRICES };
}

interface FeatureEntitlement {
	/** Wahrheitsgemäße Auswertung des Pakets — UNABHÄNGIG von `MONETIZATION_ENFORCED`. */
	allowed: boolean;
	/** Kleinstes Paket, das das Feature enthält. */
	requiredPlan: Plan;
	/** Nur bei `ai_assist` gesetzt: Rest des Monatskontingents (Verbrauch bereits abgezogen, T4). */
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
 *
 * `aiAssistConsumed` ist der bereits verbrauchte Teil des Monatskontingents (#1459, T4). Der
 * Parameter bleibt optional: `getEntitlements` läuft auch dort, wo es keinen Nutzer und damit
 * keinen Verbrauch gibt (Pass-Through-Modus in `routes/auth.ts`, `shouldBlockFeature`).
 */
export function getEntitlements(plan: Plan, aiAssistConsumed = 0): EntitlementMap {
	const map = {} as EntitlementMap;
	for (const entry of FEATURE_CATALOG) {
		const allowed = entry.allowedPlans.includes(plan);
		const entitlement: FeatureEntitlement = { allowed, requiredPlan: requiredPlanFor(entry) };
		if (entry.feature === 'ai_assist') {
			entitlement.quotaRemaining = Math.max(0, AI_ASSIST_MONTHLY_QUOTA[plan] - aiAssistConsumed);
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
