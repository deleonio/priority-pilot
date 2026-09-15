import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPlansCatalog, PLAN_VALUES, PAYPAL_PLAN_IDS, type Plan } from './plans.js';

/**
 * Rote Spec-Tests für #1494 AK4 (Spec docs/spec/issue-1494.md) — PayPal-Plan-ID je kostenpflichtiger
 * Kombination Paket×Zeitraum, netzlos gegen `PLAN_PRICES` abgeglichen.
 *
 * Eigene Datei statt Ergänzung von `plans.test.ts`: `PAYPAL_PLAN_IDS` existiert noch nicht, ein
 * Import würde die gesamte (bestehende, grüne) `plans.test.ts` zum Absturz bringen.
 *
 * Rot, bis `PAYPAL_PLAN_IDS` in `server/src/logics/plans.ts` exportiert wird (heute: Export fehlt
 * komplett — Modul-Ladefehler ist der legitime Erstzustand für neue Funktionalität). KEIN Produktivcode.
 */

const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;

describe('plans.ts — PAYPAL_PLAN_IDS (#1494 AK4)', () => {
	it('jede kostenpflichtige Kombination Paket×Zeitraum hat eine Plan-ID mit passendem Betrag', () => {
		const catalog = getPlansCatalog();
		const paidPlans = PLAN_VALUES.filter((plan): plan is Exclude<Plan, 'free'> => plan !== 'free');
		for (const plan of paidPlans) {
			for (const period of PERIODS) {
				const entry = PAYPAL_PLAN_IDS[plan]?.[period];
				assert.ok(entry, `PAYPAL_PLAN_IDS fehlt für ${plan}/${period}`);
				assert.equal(typeof entry.envVar, 'string', `${plan}/${period}: envVar muss ein String sein`);
				assert.ok(entry.envVar.length > 0, `${plan}/${period}: envVar darf nicht leer sein`);
				assert.equal(
					entry.amountCents,
					catalog.prices[plan][period],
					`${plan}/${period}: hinterlegter Betrag weicht von PLAN_PRICES ab`,
				);
			}
		}
	});

	it('free hat keine PayPal-Plan-IDs (kein Abo-Produkt für ein kostenloses Paket)', () => {
		assert.equal(PAYPAL_PLAN_IDS.free, undefined, 'free ist kostenlos und braucht kein Abo-Produkt');
	});
});
