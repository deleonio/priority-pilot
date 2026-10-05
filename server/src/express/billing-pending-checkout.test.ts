import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import type { AppDeps } from './index.js';
import { getPlansCatalog } from '../logics/plans.js';
import { PaypalHttpError } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2235 (Spec docs/spec/issue-2235.md) — AK2 und AK4: ein `approval_pending`
 * blockiert die Neubuchung nicht und ist keine Verrechnungsbasis. Setup-Muster
 * `billing-subscriptions-cancel.test.ts`. AK3/AK5 decken `billing-subscriptions.test.ts` ab.
 */

applyTestAuthEnv('test-secret-issue-2235');

let server: TestServer;

const post = (path: string, cookie: string, body: unknown = {}) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const clientWith = (cancel: (id: string) => Promise<void>, onCreate?: () => void): AppDeps =>
	({
		paypalClient: {
			createSubscription: async () => {
				onCreate?.();
				return { approvalUrl: 'https://paypal.example/new', externalSubscriptionId: 'I-NEW' };
			},
			cancel,
			revise: async () => ({}),
		},
	}) as unknown as AppDeps;

describe('Abgebrochener Checkout (#2235)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const seedPending = async (email: string): Promise<{ cookie: string; userId: number }> => {
		const cookie = await server.login(email);
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-OLD',
			plan: 'plus',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: new Date(Date.now() + 20 * 24 * 3600 * 1000),
		});
		return { cookie, userId: me.id };
	};

	it('AK2: POST /billing/subscriptions bei nur approval_pending → 201, alte Zeile gelöscht, cancel für ihre ID aufgerufen', async () => {
		const cancelled: string[] = [];
		server = await startTestServer(clientWith(async (id) => void cancelled.push(id)));
		const { cookie, userId } = await seedPending('ak2-2235@example.com');

		const res = await post('/billing/subscriptions', cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 201);
		assert.deepEqual(cancelled, ['I-OLD']);
		assert.equal(await Subscription.count({ where: { userId, externalSubscriptionId: 'I-OLD' } }), 0);
		assert.equal(await Subscription.count({ where: { userId, externalSubscriptionId: 'I-NEW' } }), 1);
	});

	it('AK2: 5xx des Kündigungsrufs → 502, keine neue Zeile, die alte bleibt', async () => {
		let created = 0;
		server = await startTestServer(
			clientWith(
				async () => {
					throw new PaypalHttpError('UNAVAILABLE', 503);
				},
				() => void (created += 1),
			),
		);
		const { cookie, userId } = await seedPending('ak2-5xx-2235@example.com');

		const res = await post('/billing/subscriptions', cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 502);
		assert.equal(created, 0, 'ohne erfolgreiches Verwerfen darf kein neues Abo angelegt werden');
		assert.equal(await Subscription.count({ where: { userId } }), 1);
		assert.equal(await Subscription.count({ where: { userId, externalSubscriptionId: 'I-OLD' } }), 1);
	});

	it('AK4: /change/preview aus nur approval_pending rechnet kein Guthaben an (voller Preis fällig)', async () => {
		server = await startTestServer(clientWith(async () => {}));
		const { cookie } = await seedPending('ak4-preview-2235@example.com');

		const res = await post('/billing/subscriptions/change/preview', cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 200);
		const preview = (await res.json()) as { creditCents: number; dueCents: number };
		assert.equal(preview.creditCents, 0);
		assert.equal(preview.dueCents, getPlansCatalog().prices.pro.monthly);
	});

	it('AK4: /change aus nur approval_pending legt kein Abo mit creditCents > 0 an', async () => {
		server = await startTestServer(clientWith(async () => {}));
		const { cookie, userId } = await seedPending('ak4-change-2235@example.com');

		await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' });

		const subs = await Subscription.findAll({ where: { userId } });
		assert.ok(
			subs.every((s) => ((s.get('creditCents') as number | null) ?? 0) === 0),
			'kein Guthaben aus unbezahltem Abo',
		);
	});
});
