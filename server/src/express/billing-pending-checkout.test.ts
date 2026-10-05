import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import { getPlansCatalog } from '../logics/plans.js';
import type { PaypalClient } from '../logics/paypal.js';

/**
 * #2235: ein abgebrochener oder nie bestätigter PayPal-Checkout (`approval_pending`) blockiert
 * nichts mehr — er wird nach einer Frist verworfen, und aus einem Abo ohne Zahlung entsteht kein
 * Guthaben. PayPal-Client ist ein Fake (Muster `billing-subscriptions.test.ts`).
 */

applyTestAuthEnv('test-secret-issue-2235');

let server: TestServer;

const paypalClient: PaypalClient = {
	createSubscription: async (planId) => ({
		approvalUrl: `https://paypal.example/${planId}`,
		externalSubscriptionId: `I-${planId}`,
	}),
	cancel: async () => {},
	revise: async () => ({}),
};

const post = (path: string, cookie: string, body: unknown = {}) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});
const get = (path: string, cookie: string) => fetch(`${server.baseUrl}${path}`, { headers: { Cookie: cookie } });

const seedPending = async (userId: number, ageMs: number, plan = 'plus'): Promise<Subscription> =>
	Subscription.create({
		userId,
		provider: 'paypal',
		externalSubscriptionId: 'I-OLD',
		plan,
		period: 'monthly',
		status: 'approval_pending',
		currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		createdAt: new Date(Date.now() - ageMs),
	});

describe('Abgebrochener PayPal-Checkout (#2235)', () => {
	beforeEach(async () => {
		await resetDb();
		server ??= await startTestServer({ paypalClient });
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('FRIST: ein approval_pending älter als 24 h blockiert die Neubuchung nicht (kein 409) und wird verworfen', async () => {
		const cookie = await server.login('frist@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await seedPending(me.id, 25 * 60 * 60 * 1000);

		const res = await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'yearly' });

		assert.equal(res.status, 201, 'Die abgelaufene Zeile darf die Neubuchung nicht mit 409 blockieren');
		const rows = await Subscription.findAll({ where: { userId: me.id, status: 'approval_pending' } });
		assert.equal(rows.length, 1, 'Nur die neue Buchung bleibt stehen');
	});

	it('FRIST: ein frisches approval_pending blockiert weiter (Regression AK2)', async () => {
		const cookie = await server.login('frisch@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await seedPending(me.id, 60 * 60 * 1000);

		const res = await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'yearly' });

		assert.equal(res.status, 409);
	});

	it('VORSCHAU: ein Upgrade aus einem nie bestätigten Checkout rechnet kein Guthaben an', async () => {
		const cookie = await server.login('vorschau@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await seedPending(me.id, 0);

		const res = await post('/billing/subscriptions/change/preview', cookie, { plan: 'pro', period: 'monthly' });
		const body = (await res.json()) as { creditCents: number; dueCents: number };

		assert.equal(res.status, 200);
		const { prices } = getPlansCatalog();
		assert.equal(body.creditCents, 0, 'Aus einem unbezahlten Abo entsteht kein Guthaben');
		assert.equal(body.dueCents, prices.pro.monthly, 'Der erste Zyklus kostet den vollen Preis');
	});

	it('WECHSEL: aus einem nie bestätigten Checkout entsteht ein neues Abo zum vollen Preis, die alte Zeile fällt', async () => {
		const cookie = await server.login('wechsel@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const old = await seedPending(me.id, 0);

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.ok(body.approvalUrl, 'Der Wechsel läuft über eine neue Zustimmungs-URL');
		const rows = await Subscription.findAll({ where: { userId: me.id, status: 'approval_pending' } });
		assert.equal(rows.length, 1, 'Die alte, nie bestätigte Zeile ist verworfen');
		assert.notEqual(rows[0]?.get('id'), old.get('id'));
		assert.equal(rows[0]?.get('plan'), 'pro');
		assert.equal(rows[0]?.get('creditCents'), 0);
	});
});
