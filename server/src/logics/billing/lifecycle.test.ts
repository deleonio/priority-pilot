import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../../models/index.js';
import { resetDb, closeDb } from '../../test/helpers.js';
import { applyPaymentEvent } from '../paypal.js';
import { applyDueGracePeriod, applyDueGracePeriods } from './lifecycle.js';

/**
 * #2234 (docs/spec/issue-2234.md): Nach Ablauf der Kulanzfrist fällt `User.plan` auf `free` und das
 * PayPal-Abo wird gekündigt. Die Kündigung ist als `deps.cancel` injiziert — nie echtes PayPal.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T10:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const planOf = async (userId: number) => (await User.findByPk(userId))?.get('plan');

const seed = async (firstFailureAt: Date | null, provider = 'paypal', ext = 'I-GRACE') => {
	const user = await User.create({
		email: `${ext.toLowerCase()}@example.com`,
		displayName: 'G',
		passwordHash: 'x',
		plan: 'pro',
	});
	const subscription = await Subscription.create({
		userId: user.id,
		provider,
		externalSubscriptionId: ext,
		plan: 'pro',
		period: 'monthly',
		status: 'past_due',
		currentPeriodEnd: NOW,
		firstFailureAt,
	});
	return { user, subscription };
};

describe('Kulanzfrist-Ablauf entzieht das Paket (#2234)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: nach Tag 15 → plan free, grace_expired, PayPal-Abo genau einmal gekündigt', async () => {
		const { user, subscription } = await seed(daysAgo(16));
		const cancelled: string[] = [];
		const applied = await applyDueGracePeriod(subscription, NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.equal(applied, true);
		assert.deepEqual(cancelled, ['I-GRACE']);
		assert.equal(await planOf(user.id), 'free');
		await subscription.reload();
		assert.equal(subscription.get('status'), 'grace_expired');
		assert.equal(subscription.get('firstFailureAt'), null);
	});

	it('AK1: Google-Play-Abo verliert das Paket ohne cancel-Aufruf', async () => {
		const { user, subscription } = await seed(daysAgo(16), 'google_play', 'GP-GRACE');
		const cancelled: string[] = [];
		await applyDueGracePeriod(subscription, NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.deepEqual(cancelled, []);
		assert.equal(await planOf(user.id), 'free');
	});

	it('AK2: genau Tag 15 → Paket bleibt, kein cancel', async () => {
		const { user, subscription } = await seed(daysAgo(15));
		const cancelled: string[] = [];
		const applied = await applyDueGracePeriod(subscription, NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.equal(applied, false);
		assert.deepEqual(cancelled, []);
		assert.equal(await planOf(user.id), 'pro');
		assert.equal((await subscription.reload()).get('status'), 'past_due');
	});

	it('AK3: wirft cancel, fällt plan trotzdem auf free', async () => {
		const { user, subscription } = await seed(daysAgo(20));
		const warn = console.warn;
		console.warn = () => {};
		try {
			await applyDueGracePeriod(subscription, NOW, {
				cancel: async () => {
					throw new Error('PayPal down');
				},
			});
		} finally {
			console.warn = warn;
		}

		assert.equal(await planOf(user.id), 'free');
		assert.equal((await subscription.reload()).get('status'), 'grace_expired');
	});

	it('AK5: Sweep wirkt ohne /auth/me nur auf abgelaufene Abos', async () => {
		const expired = await seed(daysAgo(30), 'paypal', 'I-EXPIRED');
		const healthy = await seed(null, 'paypal', 'I-HEALTHY');
		const inGrace = await seed(daysAgo(3), 'paypal', 'I-INGRACE');
		const cancelled: string[] = [];
		await applyDueGracePeriods(NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.deepEqual(cancelled, ['I-EXPIRED']);
		assert.equal(await planOf(expired.user.id), 'free');
		assert.equal(await planOf(healthy.user.id), 'pro');
		assert.equal(await planOf(inGrace.user.id), 'pro');
		assert.equal((await healthy.subscription.reload()).get('status'), 'past_due');
	});

	it('AK6: Zahlung in der Frist stellt active her, späterer Lauf entzieht nichts', async () => {
		const { user, subscription } = await seed(daysAgo(10));
		await applyPaymentEvent(subscription, { event_type: 'PAYMENT.SALE.COMPLETED' } as never, NOW, {
			issueInvoice: async () => undefined,
		});
		await subscription.reload();
		assert.equal(subscription.get('status'), 'active');
		assert.equal(subscription.get('firstFailureAt'), null);

		const cancelled: string[] = [];
		const later = new Date(NOW.getTime() + 20 * DAY_MS);
		await applyDueGracePeriod(subscription, later, { cancel: async (id) => void cancelled.push(id) });
		assert.deepEqual(cancelled, []);
		assert.equal(await planOf(user.id), 'pro');
	});
});
