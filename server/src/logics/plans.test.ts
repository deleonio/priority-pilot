import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FeatureId } from './plans.js';
import {
	FEATURE_IDS,
	AI_ASSIST_MONTHLY_QUOTA,
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
	'location_reminders',
	'mcp_readwrite',
	'mcp_read',
];

describe('plans.ts — Feature-Katalog (#1456 AK2/AK10, #1524 AK3)', () => {
	it('FEATURE_IDS deckt alle sieben stabilen Identifier ab, inklusive mcp_read (#1524 AK3)', () => {
		assert.deepEqual([...FEATURE_IDS].sort(), [...EXPECTED_FEATURES].sort(), 'genau die sieben Identifier');
	});

	it('getPlansCatalog() liefert für jedes Feature einen Katalog-Eintrag', () => {
		const catalog = getPlansCatalog();
		const coveredFeatures = catalog.features.map((entry) => entry.feature).sort();
		assert.deepEqual(coveredFeatures, [...EXPECTED_FEATURES].sort(), 'Katalog deckt alle Identifier ab');
	});

	it('getPlansCatalog() liefert einen Preis je Paket', () => {
		const catalog = getPlansCatalog();
		for (const plan of ['free', 'pro', 'max', 'ultimate'] as Plan[]) {
			assert.ok(catalog.prices[plan], `Preis für ${plan} fehlt`);
			assert.equal(typeof catalog.prices[plan]!.monthly, 'number');
			assert.equal(typeof catalog.prices[plan]!.yearly, 'number');
		}
	});
});

describe('plans.ts — Entitlement-Auswertung je Paket (#1456 AK2)', () => {
	it('Free hat keinen Zugriff auf groups, graph_write, location_reminders, mcp_readwrite', () => {
		const map = getEntitlements('free');
		assert.equal(map.groups.allowed, false, 'Free ohne groups');
		assert.equal(map.graph_write.allowed, false, 'Free ohne graph_write');
		assert.equal(map.location_reminders.allowed, false, 'Free ohne location_reminders');
		assert.equal(map.mcp_readwrite.allowed, false, 'Free ohne mcp_readwrite');
	});

	// #1524 AK1 macht #1484 AK1 rückgängig: voice_input ist wieder für JEDES Paket erlaubt, auch
	// Free. Ersetzt den alten Test oben (Test-Pflege: die alte Erwartung "Free ohne voice_input"
	// widerspricht AK1 direkt).
	it('voice_input ist für jedes Paket erlaubt, auch Free (#1524 AK1)', () => {
		for (const plan of ['free', 'pro', 'max', 'ultimate'] as Plan[]) {
			assert.equal(getEntitlements(plan).voice_input.allowed, true, `${plan} mit voice_input`);
		}
		const originalEnv = process.env.MONETIZATION_ENFORCED;
		process.env.MONETIZATION_ENFORCED = 'true';
		try {
			// Auch bei eingeschaltetem Rollout darf voice_input niemand blockieren (echte Bissigkeit:
			// mit dem alten Katalog [#1484] wäre Free hier `true`, also fälschlich blockiert).
			for (const plan of ['free', 'pro', 'max', 'ultimate'] as Plan[]) {
				assert.equal(shouldBlockFeature(plan, 'voice_input'), false, `${plan} wird bei "an" nicht blockiert`);
			}
		} finally {
			if (originalEnv === undefined) delete process.env.MONETIZATION_ENFORCED;
			else process.env.MONETIZATION_ENFORCED = originalEnv;
		}
	});

	// #1484 AK2: mcp_readwrite erfordert seit der Autoren-Entscheidung B1 Ultimate (nicht mehr Max).
	it('mcp_readwrite erfordert Ultimate, Max reicht nicht mehr (#1484 AK2)', () => {
		assert.equal(getEntitlements('max').mcp_readwrite.allowed, false, 'Max ohne mcp_readwrite');
		assert.equal(getEntitlements('max').mcp_readwrite.requiredPlan, 'ultimate', 'Max: requiredPlan ultimate');
		assert.equal(getEntitlements('ultimate').mcp_readwrite.allowed, true, 'Ultimate mit mcp_readwrite');
	});

	// #1524 AK3: mcp_read ist der lesende MCP-Zugriff, ab Max (eine Stufe früher als mcp_readwrite,
	// das Ultimate erfordert). Zugriff über eine per Cast erzwungene Indizierung, weil `FeatureId`
	// bis zur Implementierung noch keinen `mcp_read`-Literal enthält (legitimer roter Zustand für
	// neue Funktionalität).
	it('mcp_read ist ab Max erlaubt, Free/Pro nicht (#1524 AK3)', () => {
		const mcpRead = 'mcp_read' as unknown as FeatureId;
		assert.equal(getEntitlements('free')[mcpRead]?.allowed, false, 'Free ohne mcp_read');
		assert.equal(getEntitlements('pro')[mcpRead]?.allowed, false, 'Pro ohne mcp_read');
		assert.equal(getEntitlements('max')[mcpRead]?.allowed, true, 'Max mit mcp_read');
		assert.equal(getEntitlements('ultimate')[mcpRead]?.allowed, true, 'Ultimate mit mcp_read');
		assert.equal(getEntitlements('free')[mcpRead]?.requiredPlan, 'max', 'Free: requiredPlan max');
	});

	it('Pro hat groups, aber nicht graph_write/location_reminders/mcp_readwrite', () => {
		const map = getEntitlements('pro');
		assert.equal(map.groups.allowed, true, 'Pro mit groups');
		assert.equal(map.graph_write.allowed, false, 'Pro ohne graph_write');
		assert.equal(map.location_reminders.allowed, false, 'Pro ohne location_reminders');
		assert.equal(map.mcp_readwrite.allowed, false, 'Pro ohne mcp_readwrite');
	});

	// #1484 B1: die alte Erwartung "Max mit mcp_readwrite" widerspricht AK2 (Max→Ultimate) und
	// entfällt hier; die neue Erwartung steht im eigenen Test weiter unten (AK2).
	it('Max hat location_reminders und graph_write', () => {
		const map = getEntitlements('max');
		assert.equal(map.groups.allowed, true, 'Max mit groups');
		assert.equal(map.graph_write.allowed, true, 'Max mit graph_write');
		assert.equal(map.location_reminders.allowed, true, 'Max mit location_reminders');
	});

	it('Ultimate hat vollen Zugriff auf alle sieben Features (#1524 AK3)', () => {
		const map = getEntitlements('ultimate');
		for (const feature of EXPECTED_FEATURES) {
			assert.equal((map as Record<string, { allowed: boolean }>)[feature]!.allowed, true, `Ultimate mit ${feature}`);
		}
	});

	it('requiredPlan zeigt bei fehlendem Zugriff auf das kleinste ausreichende Paket', () => {
		const map = getEntitlements('free');
		assert.equal(map.groups.requiredPlan, 'pro', 'groups erfordert mindestens Pro');
		assert.equal(map.graph_write.requiredPlan, 'max', 'graph_write erfordert mindestens Max');
	});
});

describe('plans.ts — KI-Kontingent (#1456 AK2)', () => {
	it('AI_ASSIST_MONTHLY_QUOTA ist 0/60/110/200 für free/pro/max/ultimate', () => {
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.free, 0);
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.pro, 60);
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.max, 110);
		assert.equal(AI_ASSIST_MONTHLY_QUOTA.ultimate, 200);
	});

	it('getEntitlements() trägt das Kontingent im ai_assist-Eintrag', () => {
		assert.equal(getEntitlements('pro').ai_assist.quotaRemaining, 60, 'Pro startet mit vollem Kontingent 60');
		assert.equal(getEntitlements('free').ai_assist.allowed, false, 'Free ohne ai_assist (Kontingent 0)');
	});
});

describe('plans.ts — Verbrauchsabhängiges Kontingent (#1459 AK7)', () => {
	it('getEntitlements(plan, consumed) zieht den Verbrauch vom Kontingent ab', () => {
		assert.equal(getEntitlements('pro', 5).ai_assist.quotaRemaining, 55, 'Pro mit 5 Verbrauch: 60 - 5 = 55');
	});

	it('getEntitlements(plan, consumed) geht bei Überverbrauch nicht unter 0', () => {
		assert.equal(getEntitlements('pro', 999).ai_assist.quotaRemaining, 0, 'Restkontingent darf nicht negativ werden');
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
			assert.equal(shouldBlockFeature('ultimate', 'groups'), false, 'Ultimate darf groups bei "an" nutzen');
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
		for (const plan of ['free', 'pro', 'max', 'ultimate'] as Plan[]) {
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
		assert.deepEqual(catalog.prices.pro, { monthly: 799, quarterly: 2157, yearly: 7670 });
		assert.deepEqual(catalog.prices.max, { monthly: 1499, quarterly: 4047, yearly: 14390 });
		assert.deepEqual(catalog.prices.ultimate, { monthly: 2499, quarterly: 6747, yearly: 23990 });
	});

	it('Quartal = 3× Monat minus 10 %, Jahr = 12× Monat minus 20 %, kaufmännisch gerundet (AK3)', () => {
		const catalog = getPlansCatalog();
		for (const plan of ['pro', 'max', 'ultimate'] as Plan[]) {
			const price = catalog.prices[plan] as unknown as Record<string, number>;
			const expectedQuarterly = Math.round(price.monthly * 3 * 0.9);
			const expectedYearly = Math.round(price.monthly * 12 * 0.8);
			assert.equal(price.quarterly, expectedQuarterly, `${plan}: Quartalsstaffel stimmt nicht`);
			assert.equal(price.yearly, expectedYearly, `${plan}: Jahresstaffel stimmt nicht`);
		}
	});
});
