import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Subscription, User } from '../models/index.js';
import type { AppDeps } from './index.js';

/**
 * Rechnungsadresse vor dem Abo-Abschluss (#2661): GET/PUT `/billing/address` speichert sie am
 * Konto, `POST /billing/subscriptions` lehnt ohne sie ab (409), mit ihr entsteht der Checkout.
 */
applyTestAuthEnv('test-secret-issue-2661');

let server: TestServer;

const login = (email: string) => server.login(email);
const put = (path: string, cookie: string, body: unknown) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});
const post = (path: string, cookie: string, body: unknown) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});
const get = (path: string, cookie: string) => fetch(`${server.baseUrl}${path}`, { headers: { Cookie: cookie } });

const ADDRESS = {
	name: 'Max Mustermann',
	street: 'Musterstraße 1',
	zip: '12345',
	city: 'Musterstadt',
	country: 'Deutschland',
};

const withPaypal = (): AppDeps =>
	({
		paypalClient: {
			createSubscription: async (planId: string) => ({
				approvalUrl: `https://paypal.example/approve/${planId}`,
				externalSubscriptionId: `I-${planId}`,
			}),
			cancel: async () => {},
			revise: async () => ({}),
		},
	}) as unknown as AppDeps;

describe('Rechnungsadresse (#2661)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: GET /billing/address liefert ohne erfasste Adresse nur null-Felder', async () => {
		server = await startTestServer(withPaypal());
		const cookie = await login('ak1@example.com');
		const res = await get('/billing/address', cookie);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { name: null, street: null, zip: null, city: null, country: null });
	});

	it('AK1: PUT /billing/address speichert die Adresse und liefert sie zurück', async () => {
		server = await startTestServer(withPaypal());
		const cookie = await login('ak1-save@example.com');
		const res = await put('/billing/address', cookie, ADDRESS);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), ADDRESS);
		const stored = await User.findOne({ where: { email: 'ak1-save@example.com' } });
		assert.equal(stored?.get('billingName'), ADDRESS.name);
		assert.equal(stored?.get('billingCity'), ADDRESS.city);
	});

	it('AK1: PUT /billing/address lehnt unvollständige Angaben mit 400 ab', async () => {
		server = await startTestServer(withPaypal());
		const cookie = await login('ak1-invalid@example.com');
		const res = await put('/billing/address', cookie, { ...ADDRESS, city: '  ' });
		assert.equal(res.status, 400);
	});

	it('AK1: ohne Anmeldung antwortet PUT /billing/address mit 401', async () => {
		server = await startTestServer(withPaypal());
		const res = await put('/billing/address', '', ADDRESS);
		assert.equal(res.status, 401);
	});

	it('AK2: POST /billing/subscriptions lehnt ohne Rechnungsadresse mit 409 ab', async () => {
		server = await startTestServer(withPaypal());
		const cookie = await login('ak2-missing@example.com');
		const res = await post('/billing/subscriptions', cookie, {
			plan: 'plus',
			period: 'monthly',
			withdrawalConsent: true,
		});
		assert.equal(res.status, 409);
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		assert.equal(await Subscription.count({ where: { userId: me.id } }), 0);
	});

	it('AK2: mit gespeicherter Rechnungsadresse legt POST /billing/subscriptions das Abo an', async () => {
		server = await startTestServer(withPaypal());
		const cookie = await login('ak2-present@example.com');
		await put('/billing/address', cookie, ADDRESS);
		const res = await post('/billing/subscriptions', cookie, {
			plan: 'plus',
			period: 'monthly',
			withdrawalConsent: true,
		});
		assert.equal(res.status, 201);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.ok(body.approvalUrl, 'Antwort muss eine Zustimmungs-URL enthalten');
	});
});
