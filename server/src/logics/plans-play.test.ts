import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_VALUES, PLAY_PRODUCTS, planForPlayProduct, type Plan } from './plans.js';

/**
 * #1684: Zuordnung Paket×Zeitraum ↔ Google-Play-Produkt mit Base Plan (ADR 0017), Muster
 * `plans-paypal.test.ts`. Die IDs spiegeln die Play Console; eine Doppelung würde Käufe dem
 * falschen Paket zuschlagen.
 */

const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
const paidPlans = PLAN_VALUES.filter((plan): plan is Exclude<Plan, 'free'> => plan !== 'free');

describe('plans.ts — PLAY_PRODUCTS (#1684)', () => {
	it('jedes kaufbare Paket × Zeitraum hat genau ein Play-Produkt, das eindeutig zurückführt', () => {
		assert.ok(paidPlans.length > 0, 'keine kaufbaren Pakete');
		const seen = new Set<string>();
		for (const plan of paidPlans) {
			for (const period of PERIODS) {
				const product = PLAY_PRODUCTS[plan]?.[period];
				assert.ok(product?.productId && product.basePlanId, `PLAY_PRODUCTS fehlt für ${plan}/${period}`);
				const key = `${product.productId}/${product.basePlanId}`;
				assert.ok(!seen.has(key), `${key} ist doppelt vergeben`);
				seen.add(key);
				assert.deepEqual(planForPlayProduct(product.productId, product.basePlanId), { plan, period });
			}
		}
	});

	it('free hat kein Produkt, unbekannte IDs führen zu keinem Paket', () => {
		assert.equal((PLAY_PRODUCTS as Record<string, unknown>).free, undefined);
		assert.equal(planForPlayProduct('free', 'monthly'), null);
		assert.equal(planForPlayProduct('pro', 'weekly'), null);
	});
});
