import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';
import { PaypalHttpError } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2327 (Spec docs/spec/issue-2327.md): `DELETE /admin/users/:id` existiert
 * noch nicht — bis dahin 404 statt der erwarteten Statuscodes. KEIN Produktivcode.
 * Setup-Muster `admin-subscription-delete.test.ts`.
 */
applyTestAuthEnv('test-secret-issue-2327');
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com,member2@example.com';

let server: TestServer;

const withPaypal = (cancel: (externalSubscriptionId: string) => Promise<void>): AppDeps =>
	({
		paypalClient: {
			createSubscription: async () => ({ approvalUrl: 'https://paypal.example/x', externalSubscriptionId: 'I-NEU' }),
			cancel,
			revise: async () => ({}),
		},
		paypalVerifier: async () => 'verified',
	}) as unknown as AppDeps;

describe('Admin löscht fremdes Konto #2327 (Spec docs/spec/issue-2327.md)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const login = async (email: string, role: 'admin' | 'member') => {
		const cookie = await server.login(email, { role });
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		return { cookie, userId: me.id };
	};

	const del = (id: number | string, cookie: string) =>
		fetch(`${server.baseUrl}/admin/users/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });

	const subscribe = async (userId: number, status: string) =>
		Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: `I-2327-${userId}-${status}`,
			plan: 'pro',
			period: 'monthly',
			status,
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
		});

	it('AK1+AK4: Admin löscht fremdes Konto → 204, Nutzer weg, Rechnung und Abo-Datensatz bleiben, Admin-Session besteht', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const sub = await subscribe(member.userId, 'cancelled');
		await Invoice.create({
			userId: member.userId,
			subscriptionId: sub.id,
			number: 'INV-2327-1',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		} as never);

		const res = await del(member.userId, admin.cookie);
		assert.equal(res.status, 204);
		assert.equal(await User.findByPk(member.userId), null);
		assert.equal(await Invoice.count({ where: { userId: member.userId } }), 1, 'Rechnung bleibt');
		assert.equal(await Subscription.count({ where: { userId: member.userId } }), 1, 'Abo-Datensatz bleibt');
		const still = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: admin.cookie } });
		assert.equal(still.status, 200, 'Admin-Session bleibt bestehen');
	});

	it('AK2: Nicht-Admin 403; eigene Id 400; ungültige Id 400; unbekannte Id 404', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const other = await login('member2@example.com', 'member');

		assert.equal((await del(other.userId, member.cookie)).status, 403);
		assert.equal((await del(admin.userId, admin.cookie)).status, 400);
		assert.equal((await del('abc', admin.cookie)).status, 400);
		assert.equal((await del(999999, admin.cookie)).status, 404);
		assert.ok(await User.findByPk(admin.userId), 'eigenes Konto bleibt');
		assert.ok(await User.findByPk(other.userId), 'fremdes Konto bleibt nach 403');
	});

	it('AK3: laufendes Abo → 409 subscription_active, Konto bleibt', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		await subscribe(member.userId, 'active');

		const res = await del(member.userId, admin.cookie);
		assert.equal(res.status, 409);
		assert.equal(((await res.json()) as { code?: string }).code, 'subscription_active');
		assert.ok(await User.findByPk(member.userId));
	});

	it('AK3: letzter Admin einer Gruppe mit weiteren Mitgliedern → 409 last_group_admin, Konto bleibt', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const other = await login('member2@example.com', 'member');
		const group = await Group.create({ name: 'Familie', description: null });
		await GroupMember.create({ groupId: group.id, userId: member.userId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: other.userId, role: 'member', joinedAt: new Date() });

		const res = await del(member.userId, admin.cookie);
		assert.equal(res.status, 409);
		assert.equal(((await res.json()) as { code?: string }).code, 'last_group_admin');
		assert.ok(await User.findByPk(member.userId));
	});

	it('AK3: PayPal-Kündigung scheitert (503) → 502 paypal_unavailable, Konto und Abo bleiben', async () => {
		server = await startTestServer(
			withPaypal(async () => {
				throw new PaypalHttpError('down', 503);
			}),
		);
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		await subscribe(member.userId, 'approval_pending');

		const res = await del(member.userId, admin.cookie);
		assert.equal(res.status, 502);
		assert.equal(((await res.json()) as { code?: string }).code, 'paypal_unavailable');
		assert.ok(await User.findByPk(member.userId));
		assert.equal(await Subscription.count({ where: { userId: member.userId } }), 1);
	});
});
