import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';
import { PaypalHttpError } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #2295 (Spec docs/spec/issue-2295.md) — Admin löscht Abos und Rechnungen.
 * `DELETE /admin/users/:id/subscriptions[/:subscriptionId]` existiert noch nicht: bis dahin 404
 * statt der erwarteten Statuscodes. KEIN Produktivcode. Setup-Muster `admin-subscriptions.test.ts`.
 */

applyTestAuthEnv('test-secret-issue-2295');
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

const FUTURE = () => new Date(Date.now() + 30 * 24 * 3600 * 1000);

describe('Admin-Abo-Löschen #2295 (Spec docs/spec/issue-2295.md)', () => {
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

	const createSub = async (userId: number, ext: string, plan = 'plus', overrides: Record<string, unknown> = {}) =>
		(
			await Subscription.create({
				userId,
				provider: 'paypal',
				externalSubscriptionId: ext,
				plan,
				period: 'monthly',
				status: 'active',
				currentPeriodEnd: FUTURE(),
				...overrides,
			})
		).get('id') as number;

	let seq = 0;
	const createInvoice = async (userId: number, subscriptionId: number, extra: Record<string, unknown> = {}) =>
		(
			await Invoice.create({
				userId,
				subscriptionId,
				number: `INV-2295-${++seq}`,
				periodStart: new Date('2026-02-01'),
				periodEnd: new Date('2026-03-01'),
				amountCents: 799,
				taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
				pdfBytes: Buffer.from('%PDF-1.4 test'),
				...extra,
			} as never)
		).get('id') as number;

	const del = (path: string, cookie: string) =>
		fetch(`${server.baseUrl}${path}`, { method: 'DELETE', headers: { Cookie: cookie } });

	it('AK1+AK2: Einzel-Löschen entfernt Abo, Rechnungen (PDF) und Gutschrift; Plan = verbleibendes laufendes Abo', async () => {
		const cancelled: string[] = [];
		server = await startTestServer(withPaypal(async (id) => void cancelled.push(id)));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const keep = await createSub(member.userId, 'I-KEEP', 'plus');
		const gone = await createSub(member.userId, 'I-GONE', 'pro');
		const keepInv = await createInvoice(member.userId, keep);
		const goneInv = await createInvoice(member.userId, gone);
		await createInvoice(member.userId, keep, { creditForInvoiceId: goneInv });
		await User.update({ plan: 'pro' }, { where: { id: member.userId } });

		const res = await del(`/admin/users/${member.userId}/subscriptions/${gone}`, admin.cookie);
		assert.equal(res.status, 200);
		assert.deepEqual(cancelled, ['I-GONE'], 'PayPal-Abo wird gekündigt');
		assert.equal(await Subscription.findByPk(gone), null);
		assert.equal(await Invoice.findByPk(goneInv), null);
		assert.equal(await Invoice.count({ where: { creditForInvoiceId: goneInv } }), 0, 'Gutschrift mitgelöscht');
		assert.ok(await Subscription.findByPk(keep));
		assert.ok(await Invoice.findByPk(keepInv));
		assert.equal((await User.findByPk(member.userId))!.get('plan'), 'plus', 'AK2: Paket des verbleibenden Abos');

		const own = (await (
			await fetch(`${server.baseUrl}/admin/users/${member.userId}/invoices`, {
				headers: { Cookie: admin.cookie },
			})
		).json()) as unknown[];
		assert.equal(own.length, 1, 'Admin-Rechnungsliste ohne gelöschte Rechnung');
		const memberCookie = await server.login('member@example.com', { role: 'member' });
		const mine = (await (
			await fetch(`${server.baseUrl}/billing/invoices`, {
				headers: { Cookie: memberCookie },
			})
		).json()) as unknown[];
		assert.equal(mine.length, 1, '/billing/invoices ohne gelöschte Rechnung');
	});

	it('AK2: letztes Abo gelöscht → plan free', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const only = await createSub(member.userId, 'I-ONLY');
		await User.update({ plan: 'plus' }, { where: { id: member.userId } });
		const res = await del(`/admin/users/${member.userId}/subscriptions/${only}`, admin.cookie);
		assert.equal(res.status, 200);
		assert.equal((await User.findByPk(member.userId))!.get('plan'), 'free');
	});

	it('AK3: Alle löschen entfernt alle Abos und Rechnungen, plan free, fremde Daten unberührt', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const other = await login('member2@example.com', 'member');
		const a = await createSub(member.userId, 'I-A');
		const b = await createSub(member.userId, 'I-B', 'pro');
		await createInvoice(member.userId, a);
		await createInvoice(member.userId, b);
		const otherSub = await createSub(other.userId, 'I-OTHER');
		const otherInv = await createInvoice(other.userId, otherSub);
		await User.update({ plan: 'pro' }, { where: { id: member.userId } });

		const res = await del(`/admin/users/${member.userId}/subscriptions`, admin.cookie);
		assert.equal(res.status, 200);
		assert.equal(await Subscription.count({ where: { userId: member.userId } }), 0);
		assert.equal(await Invoice.count({ where: { userId: member.userId } }), 0);
		assert.equal((await User.findByPk(member.userId))!.get('plan'), 'free');
		assert.ok(await Subscription.findByPk(otherSub), 'fremdes Abo bleibt');
		assert.ok(await Invoice.findByPk(otherInv), 'fremde Rechnung bleibt');
	});

	for (const status of [404, 422]) {
		it(`AK4: PayPal ${status} → trotzdem gelöscht (200)`, async () => {
			server = await startTestServer(
				withPaypal(async () => {
					throw new PaypalHttpError(status, 'x');
				}),
			);
			const admin = await login('admin@example.com', 'admin');
			const member = await login('member@example.com', 'member');
			const sub = await createSub(member.userId, 'I-X');
			await createInvoice(member.userId, sub);
			const res = await del(`/admin/users/${member.userId}/subscriptions/${sub}`, admin.cookie);
			assert.equal(res.status, 200);
			assert.equal(await Subscription.findByPk(sub), null);
			assert.equal(await Invoice.count({ where: { userId: member.userId } }), 0);
		});
	}

	for (const status of [400, 500]) {
		it(`AK4: PayPal ${status} → nichts gelöscht, Fehlerstatus mit Meldung (Einzel und Alle)`, async () => {
			server = await startTestServer(
				withPaypal(async () => {
					throw new PaypalHttpError(status, 'x');
				}),
			);
			const admin = await login('admin@example.com', 'admin');
			const member = await login('member@example.com', 'member');
			const sub = await createSub(member.userId, 'I-X');
			await createInvoice(member.userId, sub);
			await User.update({ plan: 'plus' }, { where: { id: member.userId } });
			for (const path of [`/subscriptions/${sub}`, '/subscriptions']) {
				const res = await del(`/admin/users/${member.userId}${path}`, admin.cookie);
				assert.ok(res.status >= 400 && res.status !== 404 && res.status !== 403, `Status ${res.status}`);
				assert.equal(typeof ((await res.json()) as { error?: string }).error, 'string');
			}
			assert.ok(await Subscription.findByPk(sub));
			assert.equal(await Invoice.count({ where: { userId: member.userId } }), 1);
			assert.equal((await User.findByPk(member.userId))!.get('plan'), 'plus');
		});
	}

	it('AK4: Netzfehler → nichts gelöscht', async () => {
		server = await startTestServer(
			withPaypal(async () => {
				throw new Error('ECONNRESET');
			}),
		);
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const sub = await createSub(member.userId, 'I-NET');
		const res = await del(`/admin/users/${member.userId}/subscriptions/${sub}`, admin.cookie);
		assert.ok(res.status >= 500, `Status ${res.status}`);
		assert.ok(await Subscription.findByPk(sub));
	});

	it('AK5: Nicht-Admin 403; unbekannter Nutzer/Abo/fremdes Abo 404', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login('admin@example.com', 'admin');
		const member = await login('member@example.com', 'member');
		const other = await login('member2@example.com', 'member');
		const mine = await createSub(member.userId, 'I-M');
		const foreign = await createSub(other.userId, 'I-F');

		assert.equal((await del(`/admin/users/${member.userId}/subscriptions/${mine}`, member.cookie)).status, 403);
		assert.equal((await del(`/admin/users/${member.userId}/subscriptions`, member.cookie)).status, 403);
		assert.equal((await del(`/admin/users/999999/subscriptions`, admin.cookie)).status, 404);
		assert.equal((await del(`/admin/users/999999/subscriptions/${mine}`, admin.cookie)).status, 404);
		assert.equal((await del(`/admin/users/${member.userId}/subscriptions/999999`, admin.cookie)).status, 404);
		assert.equal((await del(`/admin/users/${member.userId}/subscriptions/${foreign}`, admin.cookie)).status, 404);
		assert.ok(await Subscription.findByPk(foreign), 'fremdes Abo unberührt');
		assert.ok(await Subscription.findByPk(mine));
	});
});
