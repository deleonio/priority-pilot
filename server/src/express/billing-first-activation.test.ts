import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { User } from '../models/index.js';
import type { AppDeps } from './index.js';

/**
 * Rote Spec-Tests für #2231 (Spec docs/spec/issue-2231.md): der Erstabschluss Free → Plus schaltet
 * das Paket erst mit der ersten Abbuchung frei. Ende-zu-Ende über Checkout, Webhook und `/auth/me`.
 */

applyTestAuthEnv('test-secret-issue-2231');

let server: TestServer;
const EXTERNAL_ID = 'I-2231-FIRST';
const EMAIL = 'first-2231@example.com';

const deps = (): AppDeps =>
	({
		paypalClient: {
			createSubscription: async () => ({
				approvalUrl: 'https://paypal.example/approve',
				externalSubscriptionId: EXTERNAL_ID,
			}),
			cancel: async () => {},
			revise: async () => ({}),
		},
		paypalVerifier: async () => 'verified',
		mailSender: async () => {},
	}) as unknown as AppDeps;

let counter = 0;
const webhook = (type: string) =>
	fetch(`${server.baseUrl}/webhooks/paypal`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'paypal-transmission-sig': 'ok' },
		body: JSON.stringify({
			id: `WH-2231-${(counter += 1)}`,
			event_type: type,
			resource: { id: EXTERNAL_ID, billing_agreement_id: EXTERNAL_ID },
		}),
	});

const userPlan = async () => (await User.findOne({ where: { email: EMAIL } }))?.get('plan');

describe('Erstabschluss schaltet das gebuchte Paket frei (#2231)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1/AK2: Checkout → ACTIVATED bleibt free, erst SALE.COMPLETED schaltet plus frei (/auth/me und User.plan)', async () => {
		server = await startTestServer(deps());
		const cookie = await server.login(EMAIL);
		const checkout = await fetch(`${server.baseUrl}/billing/subscriptions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ plan: 'plus', period: 'monthly', withdrawalConsent: true }),
		});
		assert.equal(checkout.status, 201);

		await webhook('BILLING.SUBSCRIPTION.ACTIVATED');
		assert.equal(await userPlan(), 'free', 'AK2: ohne Abbuchung bleibt das Konto auf Free');

		await webhook('PAYMENT.SALE.COMPLETED');
		assert.equal(await userPlan(), 'plus', 'AK1: die erste Abbuchung schaltet das gebuchte Paket frei');
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			plan?: string;
		};
		assert.equal(me.plan, 'plus', 'AK1: /auth/me liefert das gebuchte Paket');
	});
});
