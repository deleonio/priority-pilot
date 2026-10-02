import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prorateUpgrade } from './proration.js';
import { getPlansCatalog } from './plans.js';

/**
 * Tests für #1912 (Spec docs/spec/issue-1912.md) — AK1/AK2. Preis-Eingaben und erwartete
 * Ergebnisse kommen aus dem Paketkatalog (`getPlansCatalog().prices` = `PLAN_PRICES`), damit
 * eine Preisanpassung die Tests nicht still falsch machen (#2033).
 */
const prices = getPlansCatalog().prices;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('proration.ts — prorateUpgrade (#1912)', () => {
	it('AK1: Plus monatlich (499) nach 15 von 30 Tagen → Pro monatlich (899): Guthaben 249, erster Zyklus 650', () => {
		const r = prorateUpgrade({
			oldPriceCents: prices.plus.monthly,
			newPriceCents: prices.pro.monthly,
			periodStart: d('2026-06-01'),
			periodEnd: d('2026-07-01'),
			now: d('2026-06-16'),
		});
		assert.deepEqual(r, { creditCents: 249, firstCycleCents: prices.pro.monthly - 249 });
	});

	it('AK2: anderer Zeitraum (Plus monatlich → Pro jährlich) nutzt dieselbe taggenaue Formel', () => {
		const r = prorateUpgrade({
			oldPriceCents: prices.plus.monthly,
			newPriceCents: prices.pro.yearly,
			periodStart: d('2026-06-01'),
			periodEnd: d('2026-07-01'),
			now: d('2026-06-11'),
		});
		// Rest 20 von 30 Tagen: floor(499 * 20 / 30) = 332
		assert.deepEqual(r, { creditCents: 332, firstCycleCents: prices.pro.yearly - 332 });
	});

	it('Grenzen: volle Periode → volles Guthaben; Resttage 0 → kein Guthaben', () => {
		const base = {
			oldPriceCents: prices.plus.monthly,
			newPriceCents: prices.pro.monthly,
			periodStart: d('2026-06-01'),
			periodEnd: d('2026-07-01'),
		};
		assert.deepEqual(prorateUpgrade({ ...base, now: d('2026-06-01') }), {
			creditCents: prices.plus.monthly,
			firstCycleCents: prices.pro.monthly - prices.plus.monthly,
		});
		assert.deepEqual(prorateUpgrade({ ...base, now: d('2026-07-01') }), {
			creditCents: 0,
			firstCycleCents: prices.pro.monthly,
		});
	});

	it('Guthaben übersteigt den neuen Preis nie: erster Zyklus ist mindestens 0', () => {
		const r = prorateUpgrade({
			oldPriceCents: prices.pro.yearly,
			newPriceCents: prices.plus.monthly,
			periodStart: d('2026-01-01'),
			periodEnd: d('2027-01-01'),
			now: d('2026-01-02'),
		});
		assert.equal(r.firstCycleCents, 0);
	});
});
