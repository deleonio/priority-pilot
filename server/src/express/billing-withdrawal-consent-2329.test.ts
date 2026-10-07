import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import type { AppDeps } from './index.js';

/**
 * Rote Spec-Tests für #2329 AK1/AK2 (Spec docs/spec/issue-2329.md): der Checkout-Start verlangt die
 * Zustimmung zum sofortigen Leistungsbeginn und speichert den Zeitpunkt am Abo. KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-2329');

let server: TestServer;

const deps = {
	paypalClient: {
		createSubscription: async (planId: string) => ({
			approvalUrl: `https://paypal.example/approve/${planId}`,
			externalSubscriptionId: `I-${planId}`,
		}),
		cancel: async () => {},
		revise: async () => ({}),
	},
} as unknown as AppDeps;

const checkout = (cookie: string, body: Record<string, unknown>) =>
	fetch(`${server.baseUrl}/billing/subscriptions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Checkout-Zustimmung zum sofortigen Leistungsbeginn (#2329)', () => {
	beforeEach(async () => {
		await resetDb();
		server = await startTestServer(deps);
	});

	after(async () => {
		await closeDb();
	});

	it('AK1: Erstkauf ohne withdrawalConsent: true antwortet 400 und legt kein Abo an', async () => {
		const cookie = await server.login('ak1-consent@example.com');
		for (const extra of [{}, { withdrawalConsent: false }, { withdrawalConsent: 'true' }]) {
			const res = await checkout(cookie, { plan: 'plus', period: 'monthly', ...extra });
			assert.equal(res.status, 400, `Body-Zusatz ${JSON.stringify(extra)} muss abgelehnt werden`);
		}
		assert.equal(await Subscription.count(), 0, 'Ohne Zustimmung entsteht kein Abo');
	});

	it('AK2: mit withdrawalConsent: true antwortet 201 und das Abo trägt den Zustimmungszeitpunkt', async () => {
		const cookie = await server.login('ak2-consent@example.com');
		const before = Date.now();

		const res = await checkout(cookie, { plan: 'plus', period: 'monthly', withdrawalConsent: true });

		assert.equal(res.status, 201);
		const sub = await Subscription.findOne();
		const at = sub?.get('withdrawalConsentAt') as Date | null | undefined;
		assert.ok(at, 'withdrawalConsentAt muss gesetzt sein');
		assert.ok(at.getTime() >= before - 1000 && at.getTime() <= Date.now() + 1000, 'Zeitpunkt = Serverzeit des Aufrufs');
	});
});
