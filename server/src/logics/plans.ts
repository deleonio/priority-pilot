/**
 * Rechte-Zentrale der Monetarisierung (Issue #1456, Teilaufgabe T1 des Gesamtkonzepts
 * `docs/gesamtkonzept-monetarisierung.md`): Feature-Katalog, Preise, Kontingente und die
 * Auswertung „darf Paket X Feature Y?" existieren genau EINMAL — hier. Routen, Guards und
 * das Frontend konsumieren ausschließlich `getPlansCatalog()` / `getEntitlements()` /
 * `shouldBlockFeature()`, statt die Matrix ein zweites Mal zu kodieren.
 */

/** Buchbares Paket eines Nutzers. Reihenfolge = Rangfolge (aufsteigend) und API-Vertrag. */
export type Plan = 'free' | 'plus' | 'pro';
export const PLAN_VALUES: readonly Plan[] = ['free', 'plus', 'pro'];

/** Gespeicherter Paketwert → ausgewertetes Paket; Unbekanntes wie `free`. */
export const effectivePlan = (value: string): Plan => (PLAN_VALUES.includes(value as Plan) ? (value as Plan) : 'free');

/** Stabile Feature-Identifier — von Guards, Fehlervertrag und UI-Badges referenziert. */
export type FeatureId =
	| 'groups'
	| 'voice_input'
	| 'ai_assist'
	| 'graph_write'
	| 'graph_weight'
	| 'location_reminders'
	| 'mcp_readwrite'
	| 'mcp_read'
	| 'feedback';
export const FEATURE_IDS: readonly FeatureId[] = [
	'groups',
	'voice_input',
	'ai_assist',
	'graph_write',
	'graph_weight',
	'location_reminders',
	'mcp_readwrite',
	'mcp_read',
	'feedback',
];

/**
 * Internes Monatsbudget der KI-Hilfe je Paket (Fair Use, #1783) — nie sichtbar, kein Deckel: wer es
 * überschreitet, wird auf {@link AI_FAIR_USE_INTERVAL_SECONDS} gedrosselt. Richtwert ca. 18 % des
 * Abopreises je Nutzer und Monat.
 */
export const AI_ASSIST_MONTHLY_QUOTA: Record<Plan, number> = { free: 0, plus: 150, pro: 400 };

/** Höchstzahl verbundener Kalender je Paket (#2209, PO-Entscheidung). */
export const CALENDAR_SOURCE_LIMIT: Record<Plan, number> = { free: 1, plus: 5, pro: 5 };

/** Über dem Budget höchstens eine KI-Anfrage je so viele Sekunden (#1783). */
export const AI_FAIR_USE_INTERVAL_SECONDS = 30;

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
 * Paket-Matrix laut ADR 0018. `voice_input` ist für jedes Paket enthalten — die Spracheingabe läuft
 * rein lokal im Browser (#1524 AK1). `graph_write` sind einfache Abhängigkeiten, `graph_weight` das
 * Setzen eines Gewichts (#1782). `mcp_read` ist der lesende MCP-/API-Token-Zugriff, eine Stufe
 * früher als `mcp_readwrite` (#1524 AK3). `feedback` (Feedback und App-Support) ist paketungebunden in jedem
 * Paket nutzbar (#1927).
 */
const FEATURE_CATALOG: readonly FeatureCatalogEntry[] = [
	{ feature: 'groups', allowedPlans: ['plus', 'pro'] },
	{ feature: 'voice_input', allowedPlans: ['free', 'plus', 'pro'] },
	{ feature: 'ai_assist', allowedPlans: ['plus', 'pro'] },
	{ feature: 'graph_write', allowedPlans: ['free', 'plus', 'pro'] },
	{ feature: 'graph_weight', allowedPlans: ['plus', 'pro'] },
	{ feature: 'location_reminders', allowedPlans: ['plus', 'pro'] },
	{ feature: 'mcp_readwrite', allowedPlans: ['pro'] },
	{ feature: 'mcp_read', allowedPlans: ['plus', 'pro'] },
	{ feature: 'feedback', allowedPlans: ['free', 'plus', 'pro'] },
];

/**
 * Preise je Paket in Cent (Monats-/Quartals-/Jahresabrechnung), laut ADR 0018 Entscheidung 2.
 * `quarterly`/`yearly` sind der kaufmännisch gerundete Monatspreis mal 3×0,9 bzw. 12×0,8 (#1494 AK3).
 */
const PLAN_PRICES: Record<Plan, PlanPrice> = {
	free: { monthly: 0, quarterly: 0, yearly: 0 },
	plus: { monthly: 499, quarterly: 1347, yearly: 4790 },
	pro: { monthly: 899, quarterly: 2427, yearly: 8630 },
};

/** @public Monatsäquivalent der Jahreszahlung in Cent (abgerundet, #1898); `null` für Free. Nutzer: Website-Render und Tests. */
export const yearlyMonthlyEquivalent = (yearlyCents: number): number | null =>
	yearlyCents === 0 ? null : Math.floor(yearlyCents / 12);

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
	plus: {
		monthly: { envVar: 'PAYPAL_PLAN_ID_PLUS_MONTHLY', amountCents: PLAN_PRICES.plus.monthly },
		quarterly: { envVar: 'PAYPAL_PLAN_ID_PLUS_QUARTERLY', amountCents: PLAN_PRICES.plus.quarterly },
		yearly: { envVar: 'PAYPAL_PLAN_ID_PLUS_YEARLY', amountCents: PLAN_PRICES.plus.yearly },
	},
	pro: {
		monthly: { envVar: 'PAYPAL_PLAN_ID_PRO_MONTHLY', amountCents: PLAN_PRICES.pro.monthly },
		quarterly: { envVar: 'PAYPAL_PLAN_ID_PRO_QUARTERLY', amountCents: PLAN_PRICES.pro.quarterly },
		yearly: { envVar: 'PAYPAL_PLAN_ID_PRO_YEARLY', amountCents: PLAN_PRICES.pro.yearly },
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
	plus: {
		monthly: { productId: 'plus', basePlanId: 'monthly' },
		quarterly: { productId: 'plus', basePlanId: 'quarterly' },
		yearly: { productId: 'plus', basePlanId: 'yearly' },
	},
	pro: {
		monthly: { productId: 'pro', basePlanId: 'monthly' },
		quarterly: { productId: 'pro', basePlanId: 'quarterly' },
		yearly: { productId: 'pro', basePlanId: 'yearly' },
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
}
export type EntitlementMap = Record<FeatureId, FeatureEntitlement>;

/** Kleinstes Paket der Rangfolge, das `feature` enthält. */
const requiredPlanFor = (entry: FeatureCatalogEntry): Plan =>
	PLAN_VALUES.find((plan) => entry.allowedPlans.includes(plan)) ?? 'pro';

/**
 * Entitlement-Map je Feature für `plan`. Bewusst unabhängig vom Rollout-Schalter: die Map ist die
 * wahrheitsgemäße Paketauswertung, aus der die UI Badges und Hinweise rendert (Gesamtkonzept
 * „gemessen ab T1, durchgesetzt erst in T8"). Ob tatsächlich geblockt wird, entscheidet allein
 * `shouldBlockFeature()`.
 * `plan` stammt oft ungeprüft aus `users.plan` und wird über {@link effectivePlan} ausgewertet.
 */
export function getEntitlements(stored: Plan): EntitlementMap {
	const plan = effectivePlan(stored);
	const map = {} as EntitlementMap;
	for (const entry of FEATURE_CATALOG) {
		const allowed = entry.allowedPlans.includes(plan);
		map[entry.feature] = { allowed, requiredPlan: requiredPlanFor(entry) };
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
