import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Subscription, User } from '../models/index.js';
import { deleteAccount } from '../logics/deleteAccount.js';
import { PaypalHttpError, type PaypalClient } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2304 (docs/spec/issue-2304.md): Ein nie bestätigter PayPal-Checkout
 * (`approval_pending`) blockiert die Kontolöschung nicht, wird bei PayPal gekündigt und verworfen.
 * KEIN Produktivcode.
 */
applyTestAuthEnv('test-secret-issue-2304');

let server: TestServer;

const stubClient = (error?: Error) => {
	const cancelled: string[] = [];
	const paypalClient: PaypalClient = {
		createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
		cancel: async (id: string) => {
			cancelled.push(id);
			if (error) throw error;
		},
		revise: async () => ({}),
	};
	return { cancelled, paypalClient };
};

const setup = async (email: string, status = 'approval_pending') => {
	const cookie = await server.login(email);
	const me = (await (await server.json('/auth/me', { headers: { cookie } })).json()) as { id: number };
	await Subscription.create({
		userId: me.id,
		provider: 'paypal',
		externalSubscriptionId: `I-2304-${me.id}`,
		plan: 'pro',
		period: 'monthly',
		status,
		currentPeriodEnd: new Date('2026-12-01'),
	});
	return { cookie, userId: me.id, externalId: `I-2304-${me.id}` };
};

describe('Kontolöschung mit approval_pending-PayPal-Abo (#2304)', () => {
	beforeEach(async () => {
		await resetDb();
		server ??= await startTestServer();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: cancel gerufen, Konto gelöscht, Checkout-Zeile weg', async () => {
		const { userId, externalId } = await setup('ak1@example.com');
		const { cancelled, paypalClient } = stubClient();

		assert.equal(await deleteAccount(userId, { paypalClient }), 'deleted');
		assert.deepEqual(cancelled, [externalId]);
		assert.equal(await User.findByPk(userId), null);
		assert.equal((await Subscription.findAll({ where: { userId } })).length, 0);
	});

	for (const status of [404, 422]) {
		it(`AK2: cancel wirft PaypalHttpError ${status} → Konto gelöscht, Zeile weg`, async () => {
			const { userId } = await setup(`ak2-${status}@example.com`);
			const { paypalClient } = stubClient(new PaypalHttpError('x', status));

			assert.equal(await deleteAccount(userId, { paypalClient }), 'deleted');
			assert.equal(await User.findByPk(userId), null);
			assert.equal((await Subscription.findAll({ where: { userId } })).length, 0);
		});
	}

	for (const [label, error] of [
		['PaypalHttpError 503', new PaypalHttpError('down', 503)],
		['Netzfehler', new TypeError('fetch failed')],
	] as const) {
		it(`AK3: cancel wirft ${label} → 'paypal_unavailable', Konto und Zeile bleiben`, async () => {
			const { userId } = await setup(`ak3-${label.length}@example.com`);
			const { paypalClient } = stubClient(error);

			assert.equal(await deleteAccount(userId, { paypalClient }), 'paypal_unavailable');
			assert.ok(await User.findByPk(userId), 'Konto darf nicht gelöscht sein');
			assert.equal((await Subscription.findAll({ where: { userId } })).length, 1);
		});
	}

	it('AK4: active-Abo → subscription_active, kein cancel-Ruf', async () => {
		const { userId } = await setup('ak4@example.com', 'active');
		const { cancelled, paypalClient } = stubClient();

		assert.equal(await deleteAccount(userId, { paypalClient }), 'subscription_active');
		assert.equal(cancelled.length, 0);
		assert.ok(await User.findByPk(userId));
	});

	it('AK5: letzter Gruppen-Admin → last_group_admin, kein cancel-Ruf, Zeile bleibt', async () => {
		const { userId } = await setup('ak5@example.com');
		const other = (await User.create({ email: 'ak5-member@example.com' })).id;
		const group = await Group.create({ name: 'Familie', description: null });
		await GroupMember.create({ groupId: group.id, userId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: other, role: 'member', joinedAt: new Date() });
		const { cancelled, paypalClient } = stubClient();

		assert.equal(await deleteAccount(userId, { paypalClient }), 'last_group_admin');
		assert.equal(cancelled.length, 0);
		assert.equal((await Subscription.findAll({ where: { userId } })).length, 1);
	});
});
