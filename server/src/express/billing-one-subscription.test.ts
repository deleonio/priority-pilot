import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import type { GooglePlayClient } from '../logics/googlePlay.js';
import type { PaypalClient } from '../logics/paypal.js';

/**
 * #1690: höchstens ein laufendes Abo pro Nutzer über alle Anbieter. PayPal und die Play Developer API
 * sind Fakes (Muster `billing-subscriptions.test.ts`, `billing-google.test.ts`).
 */

applyTestAuthEnv('test-secret-issue-1690');

let server: TestServer;
let accountId = '';
let acknowledged = 0;

const googlePlayClient: GooglePlayClient = {
	getSubscription: async () => ({
		productId: 'max',
		basePlanId: 'monthly',
		expiresAt: new Date('2026-10-24T10:00:00Z'),
		state: 'ACTIVE',
		acknowledged: false,
		obfuscatedAccountId: accountId,
	}),
	acknowledge: async () => {
		acknowledged++;
	},
};

const paypalClient: PaypalClient = {
	createSubscription: async (planId) => ({
		approvalUrl: `https://paypal.example/${planId}`,
		externalSubscriptionId: 'I-NEW',
	}),
	cancel: async () => {},
	revise: async () => ({}),
};

describe('Ein Abo über alle Anbieter (#1690)', () => {
	beforeEach(async () => {
		await resetDb();
		acknowledged = 0;
		server ??= await startTestServer({ googlePlayClient, paypalClient });
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const me = async (cookie: string) =>
		(await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
			playAccountId: string;
			subscription: { provider: string; plan: string } | null;
		};
	const post = (cookie: string, path: string, body: unknown, channel = 'web') =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Client-Channel': channel },
			body: JSON.stringify(body),
		});
	const subscribe = (userId: number, provider: string, status: string) =>
		Subscription.create({
			userId,
			provider,
			externalSubscriptionId: `${provider}-alt`,
			plan: 'pro',
			period: 'monthly',
			status,
			currentPeriodEnd: new Date('2026-10-01T10:00:00Z'),
		});

	it('aktives PayPal-Abo: Play-Kauf wird mit 409 abgelehnt und nicht bestätigt', async () => {
		const cookie = await server.login('paypal-zuerst@example.com');
		const user = await me(cookie);
		accountId = user.playAccountId;
		await subscribe(user.id, 'paypal', 'active');

		const res = await post(cookie, '/billing/google/purchase', { purchaseToken: 'token-1' }, 'play');

		assert.equal(res.status, 409);
		assert.equal(await Subscription.count(), 1);
		assert.equal(acknowledged, 0);
		assert.equal((await me(cookie)).subscription?.provider, 'paypal');
	});

	it('aktives Play-Abo: PayPal-Checkout wird mit 409 abgelehnt', async () => {
		const cookie = await server.login('play-zuerst@example.com');
		await subscribe((await me(cookie)).id, 'google_play', 'active');

		const res = await post(cookie, '/billing/subscriptions', { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 409);
		assert.equal(await Subscription.count(), 1);
		assert.equal((await me(cookie)).subscription?.provider, 'google_play');
	});

	it('nach Ablauf des alten Abos ist der Abschluss beim anderen Anbieter möglich', async () => {
		const cookie = await server.login('wechsel@example.com');
		const user = await me(cookie);
		accountId = user.playAccountId;
		await subscribe(user.id, 'paypal', 'cancelled');

		const res = await post(cookie, '/billing/google/purchase', { purchaseToken: 'token-2' }, 'play');

		assert.equal(res.status, 204);
		const current = (await me(cookie)).subscription;
		assert.equal(current?.provider, 'google_play');
		assert.equal(current?.plan, 'max');
	});
});
