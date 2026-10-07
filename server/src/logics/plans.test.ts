import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FeatureId } from './plans.js';
import {
	PLAN_VALUES,
	FEATURE_IDS,
	AI_ASSIST_MONTHLY_QUOTA,
	effectivePlan,
	getPlansCatalog,
	getEntitlements,
	isMonetizationEnforced,
	shouldBlockFeature,
	type Plan,
} from './plans.js';

/**
 * Rote Spec-Tests für #1456 (Spec docs/spec/issue-1456.md, T1) — Rechte-Zentrale `plans.ts`.
 *
 * AK2: Feature-Katalog deckt alle sechs Identifier ab, Entitlement-Auswertung je Paket,
 * Kontingente 0/60/110/200 für `ai_assist`.
 * AK9: `MONETIZATION_ENFORCED` steuert ausschließlich `shouldBlockFeature`; `getEntitlements`
 * bleibt in beiden Schalterstellungen identisch (wahrheitsgemäße Auswertung des Pakets).
 * AK10 (T1, überholt durch #1484 A1): `voice_input` war ursprünglich für alle Pakete an.
 *
 * #1484 (T3b) Autoren-Entscheidung A1/B1 vom 2026-09-14 änderte den Katalog:
 * AK1: `voice_input` erfordert mindestens Pro (Free: allowed=false, requiredPlan='pro').
 * AK2: `mcp_readwrite` erfordert Ultimate (Max: allowed=false, requiredPlan='ultimate').
 *
 * #1524 (Spec docs/spec/issue-1524.md) macht #1484 AK1 rückgängig und ergänzt ein siebtes Feature:
 * AK1: `voice_input` ist wieder für ALLE Pakete (auch `free`) erlaubt — der Test `voice_input
 * erfordert mindestens Pro (#1484 AK1)` unten wird durch die neue Erwartung ersetzt (Test-Pflege,
 * direkter Widerspruch: #1484 erwartete `allowed=false` für Free, #1524 AK1 verlangt `true`).
 * AK3: neuer Identifier `mcp_read` (lesender MCP-Zugriff) — erlaubt ab `max` (nicht erst `ultimate`
 * wie `mcp_readwrite`), `EXPECTED_FEATURES` wächst von sechs auf sieben Einträge.
 *
 * Rot, bis `server/src/logics/plans.ts` existiert (heute: Modul fehlt komplett). KEIN Produktivcode.
 */

const EXPECTED_FEATURES = [
	'groups',
	'voice_input',
	'ai_assist',
	'graph_write',
	'graph_weight',
	'location_reminders',
	'mcp_readwrite',
	'mcp_read',
	'feedback',
	'sync',
];

describe('plans.ts — Feature-Katalog (#1456 AK2/AK10, #1524 AK3)', () => {
	it('FEATURE_IDS deckt alle zehn stabilen Identifier ab, inklusive mcp_read, graph_weight, feedback und sync (#1524 AK3, #1782, #1927, #2397)', () => {
		assert.deepEqual([...FEATURE_IDS].sort(), [...EXPECTED_FEATURES].sort(), 'genau die zehn Identifier');
	});

	it('getPlansCatalog() liefert für jedes Feature einen Katalog-Eintrag', () => {
		const catalog = getPlansCatalog();
		const coveredFeatures = catalog.features.map((entry) => entry.feature).sort();
		assert.deepEqual(coveredFeatures, [...EXPECTED_FEATURES].sort(), 'Katalog deckt alle Identifier ab');
	});

	it('getPlansCatalog() liefert einen Preis je Paket', () => {
		const catalog = getPlansCatalog();
		for (const plan of ['free', 'plus', 'pro'] as Plan[]) {
			assert.ok(catalog.prices[plan], `Preis für ${plan} fehlt`);
			assert.equal(typeof catalog.prices[plan]!.monthly, 'number');
			assert.equal(typeof catalog.prices[plan]!.yearly, 'number');
		}
	});
});

describe('plans.ts — feedback für alle Pakete (#1927 AK1/AK2)', () => {
	it('Katalog führt feedback für free, plus und pro', () => {
		const entry = getPlansCatalog().features.find((f) => f.feature === 'feedback');
		assert.deepEqual(entry?.allowedPlans, ['free', 'plus', 'pro']);
	});

	it('getEntitlements(plan).feedback ist für jedes Paket erlaubt, requiredPlan free', () => {
		for (const plan of PLAN_VALUES) {
			assert.deepEqual(
				(getEntitlements(plan) as Record<string, unknown>).feedback,
				{ allowed: true, requiredPlan: 'free' },
				plan,
			);
		}
	});
});

describe('plans.ts — sync für alle Pakete (#2397 AK1)', () => {
	it('Katalog führt sync für free, plus und pro', () => {
		const entry = getPlansCatalog().features.find((f) => (f.feature as string) === 'sync');
		assert.deepEqual(entry?.allowedPlans, ['free', 'plus', 'pro']);
	});

	it('openapi.yml: Enum FeatureCatalogEntry.feature enthält sync (Spiegel zu FEATURE_IDS)', () => {
		const yml = readFileSync(new URL('../../../openapi.yml', import.meta.url), 'utf8');
		const enumBlock = yml.split('FeatureCatalogEntry:')[1]?.split('allowedPlans:')[0] ?? '';
		for (const id of EXPECTED_FEATURES) assert.match(enumBlock, new RegExp(`\\b${id}\\b`), id);
	});
});

describe('plans.ts — Entitlement-Auswertung je Paket (#1456 AK2)', () => {
	it('Free hat keinen Zugriff auf groups, graph_weight, location_reminders, mcp_readwrite', () => {
		const map = getEntitlements('free');
		assert.equal(map.groups.allowed, false, 'Free ohne groups');
		assert.equal(map.graph_weight.allowed, false, 'Free ohne graph_weight');
		assert.equal(map.location_reminders.allowed, false, 'Free ohne location_reminders');
		assert.equal(map.mcp_readwrite.allowed, false, 'Free ohne mcp_readwrite');
	});

	// #1524 AK1 macht #1484 AK1 rückgängig: voice_input ist wieder für JEDES Paket erlaubt, auch
	// Free. Ersetzt den alten Test oben (Test-Pflege: die alte Erwartung "Free ohne voice_input"
	// widerspricht AK1 direkt).
	it('voice_input ist für jedes Paket erlaubt, auch Free (#1524 AK1)', () => {
		for (const plan of ['free', 'plus', 'pro'] as Plan[]) {
			assert.equal(getEntitlements(plan).voice_input.allowed, true, `${plan} mit voice_input`);
		}
		const originalEnv = process.env.MONETIZATION_ENFORCED;
		process.env.MONETIZATION_ENFORCED = 'true';
		try {
			// Auch bei eingeschaltetem Rollout darf voice_input niemand blockieren (echte Bissigkeit:
			// mit dem alten Katalog [#1484] wäre Free hier `true`, also fälschlich blockiert).
			for (const plan of ['free', 'plus', 'pro'] as Plan[]) {
				assert.equal(shouldBlockFeature(plan, 'voice_input'), false, `${plan} wird bei "an" nicht blockiert`);
			}
		} finally {
			if (originalEnv === undefined) delete process.env.MONETIZATION_ENFORCED;
			else process.env.MONETIZATION_ENFORCED = originalEnv;
		}
	});

	// #1782 (ADR 0018): mcp_readwrite erfordert Pro, Plus reicht nicht.
	it('mcp_readwrite erfordert Pro, Plus reicht nicht (#1782)', () => {
		assert.equal(getEntitlements('plus').mcp_readwrite.allowed, false, 'Plus ohne mcp_readwrite');
		assert.equal(getEntitlements('plus').mcp_readwrite.requiredPlan, 'pro', 'Plus: requiredPlan pro');
		assert.equal(getEntitlements('pro').mcp_readwrite.allowed, true, 'Pro mit mcp_readwrite');
	});

	// #1524 AK3: mcp_read ist der lesende MCP-Zugriff, ab Max (eine Stufe früher als mcp_readwrite,
	// das Ultimate erfordert). Zugriff über eine per Cast erzwungene Indizierung, weil `FeatureId`
	// bis zur Implementierung noch keinen `mcp_read`-Literal enthält (legitimer roter Zustand für
	// neue Funktionalität).
	it('mcp_read ist ab Plus erlaubt, Free nicht (#1524 AK3, #1782)', () => {
		const mcpRead = 'mcp_read' as unknown as FeatureId;
		assert.equal(getEntitlements('free')[mcpRead]?.allowed, false, 'Free ohne mcp_read');
		assert.equal(getEntitlements('plus')[mcpRead]?.allowed, true, 'Plus mit mcp_read');
		assert.equal(getEntitlements('pro')[mcpRead]?.allowed, true, 'Pro mit mcp_read');
		assert.equal(getEntitlements('free')[mcpRead]?.requiredPlan, 'plus', 'Free: requiredPlan plus');
	});

	it('Plus hat groups, graph_weight und location_reminders, aber nicht mcp_readwrite (#1782)', () => {
		const map = getEntitlements('plus');
		assert.equal(map.groups.allowed, true, 'Plus mit groups');
		assert.equal(map.graph_weight.allowed, true, 'Plus mit graph_weight');
		assert.equal(map.location_reminders.allowed, true, 'Plus mit location_reminders');
		assert.equal(map.mcp_readwrite.allowed, false, 'Plus ohne mcp_readwrite');
	});

	it('Pro hat vollen Zugriff auf alle acht Features (#1524 AK3, #1782)', () => {
		const map = getEntitlements('pro');
		for (const feature of EXPECTED_FEATURES) {
			assert.equal((map as Record<string, { allowed: boolean }>)[feature]!.allowed, true, `Pro mit ${feature}`);
		}
	});

	it('requiredPlan zeigt bei fehlendem Zugriff auf das kleinste ausreichende Paket', () => {
		const map = getEntitlements('free');
		assert.equal(map.groups.requiredPlan, 'plus', 'groups erfordert mindestens Plus');
		assert.equal(map.graph_weight.requiredPlan, 'plus', 'graph_weight erfordert mindestens Plus');
	});
});

describe('plans.ts — KI-Kontingent (#1456 AK2)', () => {
	it('AI_ASSIST_MONTHLY_QUOTA ist 0/150/400 für free/plus/pro (#1783)', () => {
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.free, 0);
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.plus, 150);
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.pro, 400);
	});

	it('getEntitlements() trägt kein quotaRemaining mehr (#1783)', () => {
		assert.equal('quotaRemaining' in getEntitlements('plus').ai_assist, false);
		assert.equal(getEntitlements('free').ai_assist.allowed, false, 'Free ohne ai_assist (Kontingent 0)');
	});
});

describe('plans.ts — MONETIZATION_ENFORCED (#1456 AK9)', () => {
	const originalEnv = process.env.MONETIZATION_ENFORCED;
	const restoreEnv = (): void => {
		if (originalEnv === undefined) {
			delete process.env.MONETIZATION_ENFORCED;
		} else {
			process.env.MONETIZATION_ENFORCED = originalEnv;
		}
	};

	it('ist per Default aus', () => {
		delete process.env.MONETIZATION_ENFORCED;
		assert.equal(isMonetizationEnforced(), false, 'Default ist aus');
	});

	it('shouldBlockFeature meldet bei "aus" für jedes Feature "nicht durchsetzen", auch ohne Entitlement', () => {
		delete process.env.MONETIZATION_ENFORCED;
		for (const feature of EXPECTED_FEATURES) {
			assert.equal(
				shouldBlockFeature('free', feature as Parameters<typeof shouldBlockFeature>[1]),
				false,
				`${feature} wird bei "aus" nicht blockiert`,
			);
		}
	});

	it('shouldBlockFeature folgt bei "an" der Paketregel', () => {
		process.env.MONETIZATION_ENFORCED = 'true';
		try {
			assert.equal(isMonetizationEnforced(), true, 'Schalter steht auf an');
			assert.equal(shouldBlockFeature('free', 'groups'), true, 'Free ohne groups wird bei "an" blockiert');
			assert.equal(shouldBlockFeature('pro', 'groups'), false, 'Pro darf groups bei "an" nutzen');
		} finally {
			restoreEnv();
		}
	});

	it('getEntitlements() bleibt in beiden Schalterstellungen identisch — nur shouldBlockFeature unterscheidet', () => {
		delete process.env.MONETIZATION_ENFORCED;
		const mapOff = getEntitlements('free');
		process.env.MONETIZATION_ENFORCED = 'true';
		try {
			const mapOn = getEntitlements('free');
			assert.deepEqual(
				mapOn,
				mapOff,
				'Entitlement-Map ist die wahrheitsgemäße Paketauswertung, unabhängig vom Schalter',
			);
		} finally {
			restoreEnv();
		}
	});
});

/**
 * Rote Spec-Tests für #1494 (Spec docs/spec/issue-1494.md) AK1-AK3 — Cent-Preise mit
 * Quartalsstaffel. Nutzt weiterhin `getPlansCatalog()` (existiert bereits), daher kein
 * Import-Absturz — anders als AK4 (`PAYPAL_PLAN_IDS`), das in `plans-paypal.test.ts` steckt.
 *
 * Rot, weil `plans.ts:57-62` heute nur `monthly`/`yearly` in Euro liefert.
 */
describe('plans.ts — Cent-Preise und Quartalsstaffel (#1494 AK1-AK3)', () => {
	it('jedes Paket trägt monthly, quarterly und yearly als Ganzzahl in Cent (AK1)', () => {
		const catalog = getPlansCatalog();
		for (const plan of ['free', 'plus', 'pro'] as Plan[]) {
			const price = catalog.prices[plan] as unknown as Record<string, number>;
			assert.ok(price, `Preis für ${plan} fehlt`);
			assert.equal(typeof price.quarterly, 'number', `${plan}.quarterly fehlt oder ist keine Zahl`);
			assert.ok(Number.isInteger(price.monthly), `${plan}.monthly muss Ganzzahl (Cent) sein`);
			assert.ok(Number.isInteger(price.quarterly), `${plan}.quarterly muss Ganzzahl (Cent) sein`);
			assert.ok(Number.isInteger(price.yearly), `${plan}.yearly muss Ganzzahl (Cent) sein`);
		}
	});

	it('Beträge entsprechen der Konzepttabelle in Cent (AK2)', () => {
		const catalog = getPlansCatalog();
		assert.deepEqual(catalog.prices.free, { monthly: 0, quarterly: 0, yearly: 0 });
		assert.deepEqual(catalog.prices.plus, { monthly: 499, quarterly: 1347, yearly: 4790 });
		assert.deepEqual(catalog.prices.pro, { monthly: 899, quarterly: 2427, yearly: 8630 });
	});

	it('Quartal = 3× Monat minus 10 %, Jahr = 12× Monat minus 20 %, kaufmännisch gerundet (AK3)', () => {
		const catalog = getPlansCatalog();
		for (const plan of ['plus', 'pro'] as Plan[]) {
			const price = catalog.prices[plan] as unknown as Record<string, number>;
			const expectedQuarterly = Math.round(price.monthly * 3 * 0.9);
			const expectedYearly = Math.round(price.monthly * 12 * 0.8);
			assert.equal(price.quarterly, expectedQuarterly, `${plan}: Quartalsstaffel stimmt nicht`);
			assert.equal(price.yearly, expectedYearly, `${plan}: Jahresstaffel stimmt nicht`);
		}
	});
});

describe('effectivePlan (#1785)', () => {
	it('AK3: Altwerte max/ultimate und Unbekanntes werden wie free ausgewertet, free/plus/pro bleiben', () => {
		for (const legacy of ['max', 'ultimate', 'unbekannt']) {
			assert.equal(effectivePlan(legacy), 'free', legacy);
		}
		for (const plan of ['free', 'plus', 'pro'] as const) {
			assert.equal(effectivePlan(plan), plan);
		}
	});
});
