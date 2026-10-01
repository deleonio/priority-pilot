import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_VALUES, PAYPAL_PLAN_IDS, getEntitlements, getPlansCatalog } from './plans.js';

/**
 * Rote Spec-Tests für #1782 (Spec docs/spec/issue-1782.md) — Pakete free/plus/pro.
 * AK1: Matrix Paket × Feature laut ADR 0018. AK3 (Anteil Logik): Preise, PayPal-Beträge.
 * Rot, weil `plans.ts` noch free/pro/max/ultimate kennt und `graph_weight` fehlt.
 */

const MATRIX: Record<string, readonly string[]> = {
	voice_input: ['free', 'plus', 'pro'],
	graph_write: ['free', 'plus', 'pro'],
	groups: ['plus', 'pro'],
	ai_assist: ['plus', 'pro'],
	location_reminders: ['plus', 'pro'],
	mcp_read: ['plus', 'pro'],
	graph_weight: ['plus', 'pro'],
	mcp_readwrite: ['pro'],
	feedback: ['free', 'plus', 'pro'],
};

describe('plans.ts — Pakete free/plus/pro (#1782)', () => {
	it('AK1: PLAN_VALUES ist exakt free, plus, pro', () => {
		assert.deepEqual([...PLAN_VALUES], ['free', 'plus', 'pro']);
	});

	it('AK1/AK2: Entitlements und requiredPlan folgen der Matrix je Paket und Feature', () => {
		for (const plan of ['free', 'plus', 'pro'] as const) {
			const map = getEntitlements(plan) as Record<string, { allowed: boolean; requiredPlan: string }>;
			assert.deepEqual(Object.keys(map).sort(), Object.keys(MATRIX).sort(), 'genau die neun Features');
			for (const [feature, plans] of Object.entries(MATRIX)) {
				assert.equal(map[feature]?.allowed, plans.includes(plan), `${plan} × ${feature}`);
				assert.equal(map[feature]?.requiredPlan, plans[0], `requiredPlan von ${feature}`);
			}
		}
	});

	it('AK3: Preise plus 499/1347/4790, pro 899/2427/8630, kein max/ultimate', () => {
		const { prices } = getPlansCatalog() as { prices: Record<string, unknown> };
		assert.deepEqual(prices.plus, { monthly: 499, quarterly: 1347, yearly: 4790 });
		assert.deepEqual(prices.pro, { monthly: 899, quarterly: 2427, yearly: 8630 });
		assert.equal(prices.max, undefined);
		assert.equal(prices.ultimate, undefined);
	});

	it('AK3: jeder PAYPAL_PLAN_IDS-Betrag entspricht PLAN_PRICES, Schlüssel plus/pro', () => {
		const { prices } = getPlansCatalog() as { prices: Record<string, Record<string, number>> };
		assert.deepEqual(Object.keys(PAYPAL_PLAN_IDS).sort(), ['plus', 'pro']);
		for (const [plan, periods] of Object.entries(PAYPAL_PLAN_IDS)) {
			for (const [period, entry] of Object.entries(periods)) {
				assert.equal(entry.amountCents, prices[plan]?.[period], `${plan}/${period}`);
			}
		}
	});
});
