import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../../models/index.js';
import { resetDb, closeDb } from '../../test/helpers.js';
import { applyDuePendingPlan } from './lifecycle.js';
import { applyPlayState } from './googlePlayProvider.js';

/**
 * #1694/#1696: Die Stände eines Play-Abos wirken über den vorhandenen Lebenszyklus auf Paket, Kulanz,
 * Downgrade und Paketwechsel. Die PayPal-Lebenszyklus-Tests (`paypal.test.ts`, `billing.test.ts`) bleiben unberührt.
 */

const NOW = new Date('2026-10-01T10:00:00Z');
const PERIOD_END = new Date('2026-10-24T10:00:00Z');
const NEXT_END = new Date('2026-11-24T10:00:00Z');

const setup = async () => {
	const user = await User.create({
		email: 'play@example.com',
		displayName: 'Play',
		passwordHash: '__test__',
		plan: 'pro',
	});
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'google_play',
		externalSubscriptionId: 'token-1',
		plan: 'pro',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: PERIOD_END,
	});
	return { user, subscription };
};

/** Stand eines Pro-Monatsabos bei Google. */
const play = (state: string, expiresAt: Date) => ({ state, expiresAt, productId: 'pro', basePlanId: 'monthly' });

const planOf = async (userId: number) => (await User.findByPk(userId))?.get('plan');

describe('applyPlayState (#1694)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('ACTIVE (renewed) verlängert die Periode und beendet eine laufende Kulanz', async () => {
		const { user, subscription } = await setup();
		await subscription.update({ status: 'past_due', firstFailureAt: NOW });

		await applyPlayState(subscription, play('ACTIVE', NEXT_END), false, NOW);

		assert.equal(subscription.get('status'), 'active');
		assert.deepEqual(subscription.get('currentPeriodEnd'), NEXT_END);
		assert.equal(subscription.get('firstFailureAt'), null);
		assert.equal(await planOf(user.id), 'pro');
	});

	it('ACTIVE mit Wechsel zum Periodenende merkt das neue Paket vor, nach der Verlängerung gilt es (#1696)', async () => {
		const { user, subscription } = await setup();

		await applyPlayState(
			subscription,
			{ ...play('ACTIVE', PERIOD_END), deferred: { productId: 'max', basePlanId: 'yearly' } },
			false,
			NOW,
		);
		assert.equal(subscription.get('plan'), 'pro');
		assert.equal(subscription.get('pendingPlan'), 'max');
		assert.deepEqual(subscription.get('pendingPlanEffectiveAt'), PERIOD_END);

		await applyPlayState(
			subscription,
			{ state: 'ACTIVE', expiresAt: NEXT_END, productId: 'max', basePlanId: 'yearly' },
			false,
			NOW,
		);
		assert.equal(subscription.get('plan'), 'max');
		assert.equal(subscription.get('period'), 'yearly');
		assert.equal(subscription.get('pendingPlan'), null);
		assert.equal(await planOf(user.id), 'max');
	});

	it('IN_GRACE_PERIOD und ON_HOLD starten die Kulanz, das Paket bleibt', async () => {
		for (const [state, status] of [
			['IN_GRACE_PERIOD', 'past_due'],
			['ON_HOLD', 'suspended'],
		] as const) {
			await resetDb();
			const { user, subscription } = await setup();

			await applyPlayState(subscription, play(state, PERIOD_END), false, NOW);

			assert.equal(subscription.get('status'), status, state);
			assert.deepEqual(subscription.get('firstFailureAt'), NOW, state);
			assert.equal(await planOf(user.id), 'pro', state);
		}
	});

	it('CANCELED behält das Paket bis zum Periodenende, danach Downgrade', async () => {
		const { user, subscription } = await setup();
		// Kündigung während der Kulanz: die Kulanz endet, sonst würde sie das Abo später auf grace_expired setzen.
		await subscription.update({ status: 'past_due', firstFailureAt: NOW });

		await applyPlayState(subscription, play('CANCELED', PERIOD_END), false, NOW);
		await applyDuePendingPlan(subscription, NOW);
		assert.equal(await planOf(user.id), 'pro', 'vor dem Periodenende');
		assert.deepEqual(subscription.get('currentPeriodEnd'), PERIOD_END);
		assert.equal(subscription.get('firstFailureAt'), null);

		await applyDuePendingPlan(subscription, new Date(PERIOD_END.getTime() + 1000));
		assert.equal(subscription.get('plan'), 'free');
		assert.equal(await planOf(user.id), 'free', 'nach dem Periodenende');
	});

	it('EXPIRED stuft herab, das Ablaufdatum bleibt das von Google', async () => {
		const { user, subscription } = await setup();

		await applyPlayState(subscription, play('EXPIRED', PERIOD_END), false, NOW);

		assert.equal(subscription.get('plan'), 'free');
		assert.equal(subscription.get('status'), 'cancelled');
		assert.deepEqual(subscription.get('currentPeriodEnd'), PERIOD_END);
		assert.equal(await planOf(user.id), 'free');
	});

	it('revoked stuft sofort herab, auch vor dem bezahlten Periodenende', async () => {
		const { user, subscription } = await setup();

		await applyPlayState(subscription, play('EXPIRED', PERIOD_END), true, NOW);

		assert.equal(subscription.get('plan'), 'free');
		assert.deepEqual(subscription.get('currentPeriodEnd'), NOW);
		assert.equal(await planOf(user.id), 'free');
	});
});
