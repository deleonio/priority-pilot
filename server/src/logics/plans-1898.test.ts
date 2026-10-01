import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as plans from './plans.js';

/**
 * Rote Spec-Tests für #1898 TF1 (Spec docs/spec/issue-1898.md) — Monatsäquivalent der Jahreszahlung.
 * Namespace-Import, solange `yearlyMonthlyEquivalent` noch nicht existiert.
 */
const equivalent = (plans as unknown as { yearlyMonthlyEquivalent?: (yearlyCents: number) => number | null })
	.yearlyMonthlyEquivalent;

describe('yearlyMonthlyEquivalent (#1898 AK1/AK2/AK4)', () => {
	it('rundet den Jahrespreis / 12 auf den Cent ab (Plus 319, Pro 719)', () => {
		assert.equal(typeof equivalent, 'function');
		const { prices } = plans.getPlansCatalog();
		assert.equal(equivalent!(prices.plus.yearly), 319);
		assert.equal(equivalent!(prices.pro.yearly), 719);
	});

	it('liefert für Free (Jahrespreis 0) keinen Wert', () => {
		assert.equal(typeof equivalent, 'function');
		assert.equal(equivalent!(plans.getPlansCatalog().prices.free.yearly), null);
	});
});
