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
	plus: 'Plus',
	pro: 'Pro',
};

/** Beschriftung eines Pakets; unbekannte Werte werden unverändert durchgereicht. */
export const planLabel = (plan: string): string => PLAN_LABELS[plan as Plan] ?? plan;

/** Abrechnungszeiträume der Pakete in Anzeigereihenfolge. */
export const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = {
	monthly: 'monatlich',
	quarterly: 'quartalsweise',
	yearly: 'jährlich',
};

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
	graph_weight: {
		title: 'Gewichtete Abhängigkeiten',
		benefit: 'Festlegen, wie stark eine Aufgabe von ihrem Vorgänger abhängt.',
	},
	location_reminders: {
		title: 'Orts-Erinnerungen',
		benefit: 'Erinnerungen, die ausgelöst werden, wenn du in der Nähe bist.',
	},
	mcp_readwrite: {
		title: 'MCP-Schreibzugriff',
		benefit: 'Eigene Werkzeuge und Assistenten dürfen Aufgaben nicht nur lesen, sondern auch anlegen und ändern.',
	},
	mcp_read: {
		title: 'MCP-Lesezugriff',
		benefit: 'Eigene Werkzeuge und Assistenten dürfen über einen persönlichen API-Token Aufgaben und Daten lesen.',
	},
	feedback: {
		title: 'Feedback und App-Support',
		benefit: 'Rückmeldungen und Support-Anfragen direkt aus der App senden — in jedem Paket.',
	},
};

/** Angebotstext zu einem Feature; unbekannte Identifier bekommen einen neutralen Text. */
export const featureOffer = (feature: string): { title: string; benefit: string } =>
	FEATURE_OFFERS[feature as FeatureId] ?? {
		title: 'Mehr Funktionen',
		benefit: 'Diese Funktion gehört zu einem größeren Paket.',
	};

/** Fair-Use-Drossel-Intervall in Sekunden — Spiegel von `AI_FAIR_USE_INTERVAL_SECONDS` (server/src/logics/plans.ts). */
export const AI_FAIR_USE_INTERVAL_SECONDS = 30;

/** Freundlicher Drossel-Hinweis (#1783 AK5) — nennt die Wartezeit, nie eine Anzahl Anfragen. */
export const fairUseMessage = (seconds: number): string =>
	`Gerade ist viel los. Die KI-Hilfe antwortet etwas langsamer — in etwa ${seconds} Sekunden geht es weiter.`;

/** Monatsäquivalent der Jahreszahlung in Cent — Spiegel von `yearlyMonthlyEquivalent` (server/src/logics/plans.ts, #1898). */
export const yearlyMonthlyEquivalent = (yearlyCents: number): number | null =>
	yearlyCents === 0 ? null : Math.floor(yearlyCents / 12);
