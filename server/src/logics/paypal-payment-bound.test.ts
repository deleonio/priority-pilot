import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { applyDuePendingPlan, applyPaymentEvent, applyPlanChange } from './paypal.js';
import { getPlansCatalog } from './plans.js';

/**
 * #2140 (Spec docs/spec/issue-2140.md) — AK1/AK2/AK3/AK5: Ein Paketwechsel, der eine Abbuchung
 * auslöst (Upgrade, gleichrangiger Zeitraumwechsel), wird nur vorgemerkt (`pendingPlanEffectiveAt`
 * `null` = zahlungsgebunden) und erst mit `PAYMENT.SALE.COMPLETED` wirksam. Downgrades (AK6) sind
 * in `billing.test.ts` abgedeckt, die Ablösung des Vorgänger-Abos (AK4) in `billing/paypalProvider.test.ts`.
 */

const PERIOD_END = new Date('2026-12-01T00:00:00Z');
const NOW = new Date('2026-11-15T00:00:00Z');
const PLAN_IDS = {
	proMonthly: 'PAYPAL_PLAN_ID_PRO_MONTHLY',
	proYearly: 'PAYPAL_PLAN_ID_PRO_YEARLY',
	plusYearly: 'PAYPAL_PLAN_ID_PLUS_YEARLY',
	plusMonthly: 'PAYPAL_PLAN_ID_PLUS_MONTHLY',
};

const seed = async (plan: string, period: string) => {
	const user = await User.create({
		email: `u-${Math.random()}@example.com`,
		displayName: 'U',
		passwordHash: 'x',
		plan,
	});
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-2140',
		plan,
		period,
		status: 'active',
		currentPeriodEnd: PERIOD_END,
	});
	return { user, subscription };
};
const change = (type: string, planId: string) => ({ event_type: type, resource: { id: 'I-2140', plan_id: planId } });
const sale = { event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'SALE-1', billing_agreement_id: 'I-2140' } };
const userPlan = async (id: number) => (await User.findByPk(id))?.get('plan');

describe('Paketwechsel erst nach Zahlungsbestätigung (#2140, PayPal)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	for (const type of ['BILLING.SUBSCRIPTION.UPDATED', 'BILLING.SUBSCRIPTION.ACTIVATED']) {
		it(`AK1: ${type} mit höherem Paket merkt nur vor — Paket, Zeitraum und User.plan bleiben`, async () => {
			const { user, subscription } = await seed('plus', 'monthly');

			await applyPlanChange(subscription, change(type, PLAN_IDS.proYearly), NOW);

			await subscription.reload();
			assert.equal(subscription.get('plan'), 'plus');
			assert.equal(subscription.get('period'), 'monthly');
			assert.equal(await userPlan(user.id), 'plus');
			assert.equal(subscription.get('pendingPlan'), 'pro');
			assert.equal(subscription.get('pendingPeriod'), 'yearly');
			assert.equal(subscription.get('pendingPlanEffectiveAt'), null, 'null = zahlungsgebunden, nicht zeitgesteuert');
		});
	}

	it('AK2: PAYMENT.SALE.COMPLETED wendet das vorgemerkte Upgrade an (Paket, Zeitraum, User.plan), löscht die Vormerkung und verlängert um den neuen Zeitraum', async () => {
		const { user, subscription } = await seed('plus', 'monthly');
		await applyPlanChange(subscription, change('BILLING.SUBSCRIPTION.UPDATED', PLAN_IDS.proYearly), NOW);

		await applyPaymentEvent(subscription, sale, NOW);

		await subscription.reload();
		assert.equal(subscription.get('plan'), 'pro');
		assert.equal(subscription.get('period'), 'yearly');
		assert.equal(await userPlan(user.id), 'pro');
		assert.equal(subscription.get('pendingPlan'), null);
		assert.equal(subscription.get('pendingPeriod'), null);
		assert.equal(subscription.get('pendingPlanEffectiveAt'), null);
		assert.equal(new Date(subscription.get('currentPeriodEnd') as Date).toISOString().slice(0, 10), '2027-12-01');
	});

	it('AK3: bleibt die Abbuchung aus oder schlägt sie fehl, bleibt das alte Paket — auch zeitgesteuert wird die Vormerkung nie angewendet', async () => {
		const { user, subscription } = await seed('plus', 'monthly');
		await applyPlanChange(subscription, change('BILLING.SUBSCRIPTION.UPDATED', PLAN_IDS.proMonthly), NOW);

		await applyPaymentEvent(subscription, { event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' }, NOW);
		const applied = await applyDuePendingPlan(subscription, new Date('2099-01-01T00:00:00Z'));

		await subscription.reload();
		assert.equal(applied, false);
		assert.equal(subscription.get('plan'), 'plus');
		assert.equal(await userPlan(user.id), 'plus');
		assert.equal(subscription.get('pendingPlan'), 'pro', 'die Vormerkung wartet weiter auf den Zahlungseingang');
	});

	it('AK5: ein gleichrangiger Zeitraumwechsel wird erst mit der Abbuchung aktiv', async () => {
		const { user, subscription } = await seed('plus', 'monthly');

		await applyPlanChange(subscription, change('BILLING.SUBSCRIPTION.UPDATED', PLAN_IDS.plusYearly), NOW);

		await subscription.reload();
		assert.equal(subscription.get('period'), 'monthly', 'bis zur Abbuchung läuft der alte Zeitraum');
		assert.equal(subscription.get('pendingPlan'), 'plus');
		assert.equal(subscription.get('pendingPeriod'), 'yearly');
		assert.equal(subscription.get('pendingPlanEffectiveAt'), null);

		await applyPaymentEvent(subscription, sale, NOW);

		await subscription.reload();
		assert.equal(subscription.get('period'), 'yearly');
		assert.equal(subscription.get('plan'), 'plus');
		assert.equal(await userPlan(user.id), 'plus');
		assert.equal(subscription.get('pendingPlan'), null);
		assert.equal(new Date(subscription.get('currentPeriodEnd') as Date).toISOString().slice(0, 10), '2027-12-01');
	});

	it('AK5: ein Ereignis ohne Änderung (gleiches Paket, gleicher Zeitraum) merkt nichts vor', async () => {
		const { subscription } = await seed('plus', 'monthly');

		await applyPlanChange(subscription, change('BILLING.SUBSCRIPTION.ACTIVATED', PLAN_IDS.plusMonthly), NOW);

		await subscription.reload();
		assert.equal(subscription.get('pendingPlan'), null);
		assert.equal(subscription.get('pendingPlanEffectiveAt'), null);
	});
});

/**
 * #2238 (Spec docs/spec/issue-2238.md) — AK1: Die Bestätigung (ACTIVATED) eines Upgrades mit
 * ausstehender Restschuld (Guthaben deckt den ersten Zyklus nicht, Muster `chargesOnActivation`)
 * aktiviert das Abo nicht — erst der Zahlungseingang (#2140) tut das. Ohne Restschuld gilt das
 * bisherige Verhalten weiter.
 */
describe('Upgrade-Aktivierung erst mit Zahlungseingang (#2238)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('AK1: ACTIVATED auf einer Upgrade-Zeile mit ausstehender Restschuld ändert den Status nicht', async () => {
		const { subscription } = await seed('plus', 'monthly');
		const restCharge = getPlansCatalog().prices.pro.monthly - 100;
		await subscription.update({ plan: 'pro', status: 'approval_pending', creditCents: restCharge });

		await applyPaymentEvent(subscription, change('BILLING.SUBSCRIPTION.ACTIVATED', PLAN_IDS.proMonthly), NOW);

		await subscription.reload();
		assert.equal(
			subscription.get('status'),
			'approval_pending',
			'ohne Zahlungseingang bleibt das Upgrade-Abo ausstehend',
		);
	});

	it('AK1: ACTIVATED ohne Restschuld (Guthaben deckt den Zyklus) aktiviert weiterhin', async () => {
		const { subscription } = await seed('plus', 'monthly');
		await subscription.update({ plan: 'pro', status: 'approval_pending', creditCents: 0 });

		await applyPaymentEvent(subscription, change('BILLING.SUBSCRIPTION.ACTIVATED', PLAN_IDS.proMonthly), NOW);

		await subscription.reload();
		assert.equal(subscription.get('status'), 'active');
	});
});

/**
 * #2231 (Spec docs/spec/issue-2231.md) — AK3/AK4: Die Freischaltung mit der ersten Abbuchung darf
 * weder eine Admin-Sperre aufheben noch ein abgelöstes Abo den Nachfolger herabstufen lassen.
 */
describe('Freischaltung mit PAYMENT.SALE.COMPLETED — Schutzfälle (#2231)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('AK3: PAYMENT.SALE.COMPLETED für ein gesperrtes Abo lässt User.plan auf free', async () => {
		const { user, subscription } = await seed('plus', 'monthly');
		await user.update({ plan: 'free' });
		await subscription.update({ status: 'locked' });

		await applyPaymentEvent(subscription, sale, NOW);

		assert.equal(await userPlan(user.id), 'free');
	});

	it('AK4: spätes PAYMENT.SALE.COMPLETED eines abgelösten Abos ändert User.plan des Nachfolgers nicht', async () => {
		const { user, subscription } = await seed('plus', 'monthly');
		await subscription.update({ status: 'cancelled', plan: 'free' });
		await user.update({ plan: 'pro' });
		await Subscription.create({
			userId: user.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-2231-NEXT',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: PERIOD_END,
		});

		await applyPaymentEvent(subscription, sale, NOW);

		assert.equal(await userPlan(user.id), 'pro');
	});
});
