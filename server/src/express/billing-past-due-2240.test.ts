import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription, User } from '../models/index.js';
import { deleteAccount } from '../logics/deleteAccount.js';
import { syncUserPlan } from '../logics/billing/lifecycle.js';
import type { GooglePlayClient } from '../logics/googlePlay.js';
import type { PaypalClient } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2240: ein Abo mit Zahlungsrückstand (`past_due`/`suspended`) zählt als offen —
 * kündbar, sperrt Neuabschluss (PayPal, Play), wird bei der Kontolöschung mitgekündigt, geht im
 * `/auth/me` einem offenen Checkout vor, und ein spätes PayPal-Ende senkt kein Play-Paket.
 * KEIN Produktivcode. Setup-Muster `billing-one-subscription.test.ts`.
 */

applyTestAuthEnv('test-secret-issue-2240');

let server: TestServer;
let cancelled: string[];
let createCalls: number;
let accountId = '';

const paypalClient: PaypalClient = {
	createSubscription: async (planId) => {
		createCalls++;
		return { approvalUrl: `https://paypal.example/${planId}`, externalSubscriptionId: 'I-NEW' };
	},
	cancel: async (id) => {
		cancelled.push(id);
	},
	revise: async () => ({}),
};

const googlePlayClient: GooglePlayClient = {
	getSubscription: async () => ({
		productId: 'plus',
		basePlanId: 'monthly',
		expiresAt: new Date('2027-10-24T10:00:00Z'),
		state: 'ACTIVE',
		acknowledged: false,
		obfuscatedAccountId: accountId,
	}),
	acknowledge: async () => {},
};

const STATUSES = ['past_due', 'suspended'] as const;

describe('Abo mit Zahlungsrückstand ist offen (#2240)', () => {
	beforeEach(async () => {
		await resetDb();
		cancelled = [];
		createCalls = 0;
		server ??= await startTestServer({ paypalClient, googlePlayClient });
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const login = async (email: string) => {
		const cookie = await server.login(email);
		const body = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
			playAccountId: string;
			subscription: { plan: string } | null;
		};
		return { cookie, userId: body.id, playAccountId: body.playAccountId };
	};
	const post = (cookie: string, path: string, body: unknown, channel = 'web') =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Client-Channel': channel },
			body: JSON.stringify(body),
		});
	const sub = (userId: number, status: string, extra: Record<string, unknown> = {}) =>
		Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: `I-2240-${userId}-${status}`,
			plan: 'pro',
			period: 'monthly',
			status,
			currentPeriodEnd: new Date('2027-12-01'),
			...extra,
		});

	for (const status of STATUSES) {
		it(`AK1: cancel mit PayPal-Abo ${status} → 200 und checkout.cancel mit der externalSubscriptionId`, async () => {
			const { cookie, userId } = await login(`ak1-${status}@example.com`.replace(/_/g, '-'));
			const s = await sub(userId, status);

			// Test-Pflege #2308: die Kündigung eines laufenden Abos verlangt { kind, email }.
			const res = await post(cookie, '/billing/subscriptions/cancel', { kind: 'ordinary', email: 'k@example.com' });

			assert.equal(res.status, 200);
			assert.deepEqual(cancelled, [s.get('externalSubscriptionId')]);
		});

		it(`AK2: Neuabschluss bei Abo ${status} → 409, kein Checkout`, async () => {
			const { cookie, userId } = await login(`ak2-${status}@example.com`.replace(/_/g, '-'));
			await sub(userId, status);

			const res = await post(cookie, '/billing/subscriptions', { plan: 'plus', period: 'monthly' });

			assert.equal(res.status, 409);
			assert.equal(createCalls, 0);
			assert.equal(await Subscription.count({ where: { userId } }), 1);
		});

		it(`AK3: Play-Kauf bei PayPal-Abo ${status} → 409`, async () => {
			const { cookie, userId, playAccountId } = await login(`ak3-${status}@example.com`.replace(/_/g, '-'));
			accountId = playAccountId;
			await sub(userId, status);

			const res = await post(cookie, '/billing/google/purchase', { purchaseToken: 'tok-2240' }, 'play');

			assert.equal(res.status, 409);
			assert.equal(await Subscription.count({ where: { provider: 'google_play', userId } }), 0);
		});

		it(`AK4: Kontolöschung kündigt PayPal-Abo ${status} bei PayPal und löscht das Konto`, async () => {
			const { userId } = await login(`ak4-${status}@example.com`.replace(/_/g, '-'));
			const s = await sub(userId, status);

			const result = await deleteAccount(userId, { paypalClient });

			assert.equal(result, 'deleted');
			assert.deepEqual(cancelled, [s.get('externalSubscriptionId')]);
			assert.equal(await User.findByPk(userId), null);
		});
	}

	it('AK4: scheitert die PayPal-Kündigung, bleibt das Konto bestehen', async () => {
		const { userId } = await login('ak4-fail@example.com');
		await sub(userId, 'past_due');
		const failing: PaypalClient = {
			...paypalClient,
			cancel: async () => {
				throw new Error('paypal down');
			},
		};

		const result = await deleteAccount(userId, { paypalClient: failing }).catch(() => 'error');

		assert.notEqual(result, 'deleted');
		assert.ok(await User.findByPk(userId), 'Konto darf nicht gelöscht sein');
	});

	it('AK5: PayPal-Downgrade auf free lässt das Paket bei offenem Play-Abo unverändert', async () => {
		const { userId } = await login('ak5@example.com');
		await User.update({ plan: 'plus' }, { where: { id: userId } });
		await sub(userId, 'active', { provider: 'google_play', plan: 'plus', externalSubscriptionId: 'play-2240' });
		const ended = await sub(userId, 'cancelled', { externalSubscriptionId: 'I-ended-2240' });

		await syncUserPlan(ended, 'free');

		assert.equal((await User.findByPk(userId))?.get('plan'), 'plus');
	});

	it('AK5: ohne fremdes Abo bleibt der Downgrade auf free', async () => {
		const { userId } = await login('ak5b@example.com');
		await User.update({ plan: 'pro' }, { where: { id: userId } });
		const ended = await sub(userId, 'cancelled');

		await syncUserPlan(ended, 'free');

		assert.equal((await User.findByPk(userId))?.get('plan'), 'free');
	});

	it('AK7: /auth/me liefert das past_due-Abo vor einem offenen Checkout', async () => {
		const { cookie, userId } = await login('ak7@example.com');
		await sub(userId, 'past_due', { plan: 'pro' });
		await sub(userId, 'approval_pending', { plan: 'plus', externalSubscriptionId: 'I-checkout-2240' });

		const body = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			subscription: { plan: string } | null;
		};

		assert.equal(body.subscription?.plan, 'pro');
	});
});
