import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prorateUpgrade } from './proration.js';

/**
 * Rote Spec-Tests für #1912 (Spec docs/spec/issue-1912.md) — AK1/AK2. `proration.ts` (reine
 * Rechenfunktion) existiert noch nicht: fehlendes Modul ist der legitime Erstzustand.
 */
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('proration.ts — prorateUpgrade (#1912)', () => {
	it('AK1: Plus monatlich (499) nach 15 von 30 Tagen → Pro monatlich (999): Guthaben 249, erster Zyklus 750', () => {
		const r = prorateUpgrade({
			oldPriceCents: 499,
			newPriceCents: 999,
			periodStart: d('2026-06-01'),
			periodEnd: d('2026-07-01'),
			now: d('2026-06-16'),
		});
		assert.deepEqual(r, { creditCents: 249, firstCycleCents: 750 });
	});

	it('AK2: anderer Zeitraum (Plus monatlich → Pro jährlich) nutzt dieselbe taggenaue Formel', () => {
		const r = prorateUpgrade({
			oldPriceCents: 499,
			newPriceCents: 9590,
			periodStart: d('2026-06-01'),
			periodEnd: d('2026-07-01'),
			now: d('2026-06-11'),
		});
		// Rest 20 von 30 Tagen: floor(499 * 20 / 30) = 332
		assert.deepEqual(r, { creditCents: 332, firstCycleCents: 9258 });
	});

	it('Grenzen: volle Periode → volles Guthaben; Resttage 0 → kein Guthaben', () => {
		const base = { oldPriceCents: 499, newPriceCents: 999, periodStart: d('2026-06-01'), periodEnd: d('2026-07-01') };
		assert.deepEqual(prorateUpgrade({ ...base, now: d('2026-06-01') }), { creditCents: 499, firstCycleCents: 500 });
		assert.deepEqual(prorateUpgrade({ ...base, now: d('2026-07-01') }), { creditCents: 0, firstCycleCents: 999 });
	});

	it('Guthaben übersteigt den neuen Preis nie: erster Zyklus ist mindestens 0', () => {
		const r = prorateUpgrade({
			oldPriceCents: 9590,
			newPriceCents: 999,
			periodStart: d('2026-01-01'),
			periodEnd: d('2027-01-01'),
			now: d('2026-01-02'),
		});
		assert.equal(r.firstCycleCents, 0);
	});
});
