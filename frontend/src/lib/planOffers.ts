import type { components } from 'client';

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
	pro: 'Pro',
	max: 'Max',
	ultimate: 'Ultimate',
};

/** Beschriftung eines Pakets; unbekannte Werte werden unverändert durchgereicht. */
export const planLabel = (plan: string): string => PLAN_LABELS[plan as Plan] ?? plan;

/**
 * Nutzentexte je Feature — die EINE zentrale Stelle (AK5). Angebotsdialog und Badge adressieren sie
 * über den Feature-Identifier aus dem Serververtrag; T3b (#1484), T6 und T7 rollen weitere Stellen
 * aus, ohne neue Texte anzulegen. Preise stehen hier bewusst NICHT — die kommen aus `GET /plans`.
 */
const FEATURE_OFFERS: Record<FeatureId, { title: string; benefit: string }> = {
	groups: {
		title: 'Gruppen',
		benefit: 'Aufgaben mit Familie oder Team teilen, gemeinsam planen und Zuständigkeiten verteilen.',
	},
	voice_input: {
		title: 'Spracheingabe',
		benefit: 'Aufgaben unterwegs einfach diktieren, statt sie zu tippen.',
	},
	ai_assist: {
		title: 'KI-Unterstützung',
		benefit: 'Schnellerfassung, Vorschläge und Zerlegung großer Aufgaben — mit einem größeren Monatskontingent.',
	},
	graph_write: {
		title: 'Abhängigkeiten',
		benefit: 'Aufgaben verknüpfen und die Reihenfolge im Graphen selbst bestimmen.',
	},
	location_reminders: {
		title: 'Orts-Erinnerungen',
		benefit: 'Erinnerungen, die ausgelöst werden, wenn du in der Nähe bist.',
	},
	mcp_readwrite: {
		title: 'MCP-Schreibzugriff',
		benefit: 'Eigene Werkzeuge und Assistenten dürfen Aufgaben nicht nur lesen, sondern auch anlegen und ändern.',
	},
};

/** Angebotstext zu einem Feature; unbekannte Identifier bekommen einen neutralen Text. */
export const featureOffer = (feature: string): { title: string; benefit: string } =>
	FEATURE_OFFERS[feature as FeatureId] ?? {
		title: 'Mehr Funktionen',
		benefit: 'Diese Funktion gehört zu einem größeren Paket.',
	};

/** Monatliches KI-Kontingent je Paket — Spiegel von `AI_ASSIST_MONTHLY_QUOTA` (server/src/logics/plans.ts). */
const AI_ASSIST_MONTHLY_QUOTA: Record<Plan, number> = {
	free: 0,
	pro: 60,
	max: 110,
	ultimate: 200,
};

/**
 * Warnschwelle für das KI-Kontingent (AK10): unter 10 Prozent des Monatskontingents erscheint
 * zusätzlich zum Rest eine Warnung. Ohne bekanntes Monatskontingent (Paket ohne Kontingent) gibt es
 * nichts zu warnen.
 */
export const isQuotaLow = (remaining: number | undefined, plan: Plan): boolean => {
	const monthly = AI_ASSIST_MONTHLY_QUOTA[plan];
	if (remaining === undefined || monthly <= 0) {
		return false;
	}
	return remaining < monthly * 0.1;
};
