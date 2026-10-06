import { describe, it, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Subscription, User } from '../models/index.js';
import sequelize from '../database.js';
import { deleteAccount } from '../logics/deleteAccount.js';
import { PaypalHttpError, type PaypalClient } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2276 (docs/spec/issue-2276.md): 4xx bei der PayPal-Kündigung gilt bei der
 * Kontolöschung als „bereits gekündigt“, 5xx/Netzfehler blockiert (502), jeder andere Fehler wird
 * geloggt und als allgemeiner 500 gemeldet. KEIN Produktivcode.
 */
applyTestAuthEnv('test-secret-issue-2276');

let server: TestServer;
const realFetch = globalThis.fetch;

const clientThrowing = (error: Error): PaypalClient => ({
	createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
	cancel: async () => {
		throw error;
	},
	revise: async () => ({}),
});

const setup = async (email: string) => {
	const cookie = await server.login(email);
	const me = (await (await realFetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
		id: number;
	};
	await Subscription.create({
		userId: me.id,
		provider: 'paypal',
		externalSubscriptionId: `I-2276-${me.id}`,
		plan: 'pro',
		period: 'monthly',
		status: 'past_due',
		currentPeriodEnd: new Date('2026-12-01'),
	});
	return { cookie, userId: me.id };
};

/** Lässt nur Aufrufe an PayPal ins Leere laufen; der Test-Client und die App-Aufrufe bleiben echt. */
const stubPaypal = (cancel: () => Response) =>
	mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input instanceof Request ? input.url : input);
		if (!url.includes('paypal.com')) return realFetch(input, init);
		if (url.includes('/oauth2/token')) return Response.json({ access_token: 'tok' });
		return cancel();
	});

const deleteMe = (cookie: string) =>
	realFetch(`${server.baseUrl}/auth/me`, { method: 'DELETE', headers: { Cookie: cookie } });

describe('Kontolöschung mit past_due-PayPal-Abo (#2276)', () => {
	beforeEach(async () => {
		await resetDb();
		server ??= await startTestServer();
	});
	afterEach(() => mock.restoreAll());
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	for (const status of [404, 422]) {
		it(`AK1: cancel wirft PaypalHttpError ${status} → Konto wird gelöscht`, async () => {
			const { userId } = await setup(`ak1-${status}@example.com`);

			const result = await deleteAccount(userId, { paypalClient: clientThrowing(new PaypalHttpError('x', status)) });

			assert.equal(result, 'deleted');
			assert.equal(await User.findByPk(userId), null);
		});

		it(`AK1: DELETE /auth/me bei PayPal-${status} → 204, User gelöscht`, async () => {
			const { cookie, userId } = await setup(`ak1api-${status}@example.com`);
			stubPaypal(() => new Response('{}', { status }));

			const res = await deleteMe(cookie);

			assert.equal(res.status, 204);
			assert.equal(await User.findByPk(userId), null);
		});
	}

	for (const [label, error] of [
		['PaypalHttpError 503', new PaypalHttpError('down', 503)],
		['PaypalHttpError 429', new PaypalHttpError('limit', 429)],
		['PaypalHttpError 401', new PaypalHttpError('auth', 401)],
		['Netzfehler', new TypeError('fetch failed')],
	] as const) {
		it(`AK2: cancel wirft ${label} → 'paypal_unavailable', Konto bleibt`, async () => {
			const { userId } = await setup(`ak2-${label.length}@example.com`);

			const result = await deleteAccount(userId, { paypalClient: clientThrowing(error) });

			assert.equal(result, 'paypal_unavailable');
			assert.ok(await User.findByPk(userId), 'Konto darf nicht gelöscht sein');
		});
	}

	it('AK2: DELETE /auth/me bei PayPal-503 → 502 mit PayPal-Meldung, User bleibt', async () => {
		const { cookie, userId } = await setup('ak2api@example.com');
		stubPaypal(() => new Response('{}', { status: 503 }));

		const res = await deleteMe(cookie);

		assert.equal(res.status, 502);
		assert.match(((await res.json()) as { message: string }).message, /PayPal/);
		assert.ok(await User.findByPk(userId), 'Konto darf nicht gelöscht sein');
	});

	it('AK3: Nicht-PayPal-Fehler wird geloggt und als allgemeiner 500 gemeldet', async () => {
		const cookie = await server.login('ak3@example.com');
		mock.method(sequelize, 'transaction', async () => {
			throw new Error('db kaputt');
		});
		const logged = mock.method(console, 'error', () => {});

		const res = await deleteMe(cookie);

		assert.equal(res.status, 500);
		assert.doesNotMatch(((await res.json()) as { message: string }).message, /PayPal/);
		assert.ok(
			logged.mock.calls.some((c) => c.arguments.some((a) => a instanceof Error && a.message === 'db kaputt')),
			'Fehler muss per console.error geloggt werden',
		);
	});
});
