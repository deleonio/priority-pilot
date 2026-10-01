import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import type { AppDeps } from './index.js';
import { PaypalHttpError } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2048 (Spec docs/spec/issue-2048.md) — AK4–AK6 auf
 * `POST /billing/subscriptions/cancel`. Der gekündigte Zweig (409 ohne PayPal-Aufruf) und die
 * 4xx→409-Abbildung existieren noch nicht: AK4 scheitert an der Assertion (aktuell 404, da die
 * Route nur offene Abos sucht), AK5 am Status/Meldungsvertrag, AK6 sichert das 404 für
 * abgelaufene/fehlende Abos. KEIN Produktivcode. Setup-Muster `billing-subscriptions.test.ts`.
 */

applyTestAuthEnv('test-secret-issue-2048');

let server: TestServer;

const withCancel = (cancel: (externalSubscriptionId: string) => Promise<void>): AppDeps =>
	({
		paypalClient: {
			createSubscription: async () => ({ approvalUrl: 'https://paypal.example/x', externalSubscriptionId: 'I-X' }),
			cancel,
			revise: async () => ({}),
		},
	}) as unknown as AppDeps;

describe('Cancel-Route #2048', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const login = async (email: string): Promise<{ cookie: string; userId: number }> => {
		const cookie = await server.login(email);
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		return { cookie, userId: me.id };
	};

	const createSub = (userId: number, status: string, currentPeriodEnd: Date): Promise<unknown> =>
		Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: `I-2048-${userId}`,
			plan: 'plus',
			period: 'monthly',
			status,
			currentPeriodEnd,
		});

	it('AK4: cancel auf jüngstem Abo mit status=cancelled und zukünftigem currentPeriodEnd → 409 „Das Abo ist bereits gekündigt.", kein PayPal-Aufruf', async () => {
		let paypalCalls = 0;
		server = await startTestServer(
			withCancel(async () => {
				paypalCalls += 1;
			}),
		);
		const { cookie, userId } = await login('ak4-2048@example.com');
		await createSub(userId, 'cancelled', new Date(Date.now() + 30 * 24 * 3600 * 1000));

		const res = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: '{}',
		});

		assert.equal(res.status, 409);
		assert.equal(((await res.json()) as { message?: string }).message, 'Das Abo ist bereits gekündigt.');
		assert.equal(paypalCalls, 0, 'PayPal darf bei bereits gekündigtem Abo nicht aufgerufen werden');
	});

	it('AK5: cancel auf aktivem Abo, PayPal antwortet 4xx (422) → 409 „Das Abo ist bereits gekündigt."', async () => {
		server = await startTestServer(
			withCancel(async () => {
				throw new PaypalHttpError('SUBSCRIPTION_STATUS_INVALID', 422);
			}),
		);
		const { cookie, userId } = await login('ak5-2048@example.com');
		await createSub(userId, 'active', new Date('2027-06-01'));

		const res = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: '{}',
		});

		assert.equal(res.status, 409);
		assert.equal(((await res.json()) as { message?: string }).message, 'Das Abo ist bereits gekündigt.');
	});

	it('AK5: PayPal 5xx bleibt 502', async () => {
		server = await startTestServer(
			withCancel(async () => {
				throw new PaypalHttpError('PayPal down', 500);
			}),
		);
		const { cookie, userId } = await login('ak5b-2048@example.com');
		await createSub(userId, 'active', new Date('2027-06-01'));

		const res = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: '{}',
		});

		assert.equal(res.status, 502);
	});

	it('AK6: abgelaufenes gekündigtes Abo (currentPeriodEnd vergangen) und fehlendes Abo → 404 „Kein Abo gefunden."', async () => {
		server = await startTestServer(withCancel(async () => {}));
		const expired = await login('ak6-2048@example.com');
		await createSub(expired.userId, 'cancelled', new Date('2020-01-01'));

		const resExpired = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: expired.cookie },
			body: '{}',
		});
		assert.equal(resExpired.status, 404);
		assert.equal(((await resExpired.json()) as { message?: string }).message, 'Kein Abo gefunden.');

		const none = await login('ak6-none-2048@example.com');
		const resNone = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: none.cookie },
			body: '{}',
		});
		assert.equal(resNone.status, 404);
		assert.equal(((await resNone.json()) as { message?: string }).message, 'Kein Abo gefunden.');
	});
});
