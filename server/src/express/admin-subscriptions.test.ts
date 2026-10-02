import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Subscription, User } from '../models/index.js';
import type { AppDeps } from './index.js';
import { PaypalHttpError } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #1959 (Spec docs/spec/issue-1959.md) — Admin-Routen Abo sperren/stornieren.
 * `POST /admin/users/:id/subscription/lock` und `POST /admin/users/:id/subscription/cancel`
 * existieren noch nicht: bis dahin liefern sie 404 statt der erwarteten Statuscodes — legitimer
 * Erst-Zustand. AK1 sichert zusätzlich die DTO-Erweiterung `subscriptionStatus` und die bewusste
 * Entscheidung „locked blockiert keinen Zweitabschluss" (docs/spec/issue-1959.md). KEIN
 * Produktivcode. Setup-Muster `billing-subscriptions-cancel.test.ts` (#2048).
 */

applyTestAuthEnv('test-secret-issue-1959');
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com,member2@example.com,tester@example.com';

const ADMIN_EMAIL = 'admin@example.com';
const MEMBER_EMAIL = 'member@example.com';
const MEMBER2_EMAIL = 'member2@example.com';
const TESTER_EMAIL = 'tester@example.com';

let server: TestServer;

/** Fake-PayPal-Client mit beobachtbarem `cancel` (Muster #2048) plus zustimmendem Checkout. */
const withPaypal = (cancel: (externalSubscriptionId: string) => Promise<void>): AppDeps =>
	({
		paypalClient: {
			createSubscription: async () => ({ approvalUrl: 'https://paypal.example/x', externalSubscriptionId: 'I-NEU' }),
			cancel,
			revise: async () => ({}),
		},
		paypalVerifier: async () => 'verified',
	}) as unknown as AppDeps;

describe('Admin-Abo-Routen #1959 (Spec docs/spec/issue-1959.md)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const login = async (
		email: string,
		role: 'admin' | 'member' | 'tester',
	): Promise<{ cookie: string; userId: number }> => {
		const cookie = await server.login(email, { role });
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		return { cookie, userId: me.id };
	};

	const createSub = (
		userId: number,
		overrides: Partial<{ provider: string; status: string; plan: string; externalSubscriptionId: string }> = {},
	) =>
		Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: `I-1959-${userId}`,
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
			...overrides,
		});

	it('AK1: Admin sperrt → 200, Subscription.status = locked, User.plan = free, kein PayPal-Aufruf; ohne Abo → 404', async () => {
		let paypalCalls = 0;
		server = await startTestServer(withPaypal(async () => (paypalCalls += 1)));
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId);

		const res = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(res.status, 200);
		const dto = (await res.json()) as { plan: string; subscriptionStatus: string | null };
		assert.equal(dto.plan, 'free');
		assert.equal(dto.subscriptionStatus, 'locked');

		const sub = (await Subscription.findOne({ where: { userId: member.userId } }))!;
		assert.equal(sub.get('status'), 'locked');
		const user = (await User.findByPk(member.userId))!;
		assert.equal(user.get('plan'), 'free');
		assert.equal(paypalCalls, 0, 'Sperren ist eine lokale Aktion — kein Provider-Aufruf');

		// Nutzer ohne Abo → 404 (Spec: „Kein Abo gefunden.")
		const resNone = await fetch(`${server.baseUrl}/admin/users/${admin.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(resNone.status, 404);
	});

	it('AK1: GET /admin/users liefert subscriptionStatus je Nutzer (active, null ohne Abo, locked nach Sperre)', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId);

		const listUsers = async (): Promise<{ id: number; subscriptionStatus: string | null }[]> => {
			const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { Cookie: admin.cookie } });
			assert.equal(res.status, 200);
			return (await res.json()) as { id: number; subscriptionStatus: string | null }[];
		};

		let users = await listUsers();
		assert.equal(users.find((u) => u.id === member.userId)?.subscriptionStatus, 'active');
		assert.equal(users.find((u) => u.id === admin.userId)?.subscriptionStatus, null, 'ohne Abo null');

		await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		users = await listUsers();
		assert.equal(users.find((u) => u.id === member.userId)?.subscriptionStatus, 'locked');
	});

	it('AK1: Abo-Historie (alt gekündigt + Neuabschluss aktiv) → Liste zeigt aktuellen Status, Sperre trifft die jüngste Zeile', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		// Je Abschluss eine neue Zeile: alte gekündigt (Vortag), Neuabschluss aktiv.
		await Subscription.create({
			userId: member.userId,
			provider: 'paypal',
			externalSubscriptionId: `I-1959-alt-${member.userId}`,
			plan: 'plus',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: new Date(Date.now() - 24 * 3600 * 1000),
		});
		await createSub(member.userId, { externalSubscriptionId: `I-1959-neu-${member.userId}` });

		const listRes = await fetch(`${server.baseUrl}/admin/users`, { headers: { Cookie: admin.cookie } });
		assert.equal(listRes.status, 200);
		const users = (await listRes.json()) as { id: number; subscriptionStatus: string | null }[];
		assert.equal(
			users.find((u) => u.id === member.userId)?.subscriptionStatus,
			'active',
			'Liste stellt den Status der jüngsten Zeile (Neuabschluss), nicht der alten',
		);

		const lockRes = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(lockRes.status, 200);
		const subs = await Subscription.findAll({ where: { userId: member.userId }, order: [['id', 'ASC']] });
		assert.equal(subs.length, 2);
		assert.equal(subs[0]!.get('status'), 'cancelled', 'alte Zeile unangetastet');
		assert.equal(subs[1]!.get('status'), 'locked', 'Sperre trifft die jüngste Zeile (Neuabschluss)');
		const user = (await User.findByPk(member.userId))!;
		assert.equal(user.get('plan'), 'free');
	});

	it('AK2: Webhook CANCELLED auf gesperrtem Abo → plan bleibt free (wasLocked-Guard)', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId);
		const lockRes = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(lockRes.status, 200, 'Setup: Sperre muss gelungen sein');

		const hook = await fetch(`${server.baseUrl}/webhooks/paypal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'paypal-transmission-sig': 'ok' },
			body: JSON.stringify({
				id: 'WH-1959-2',
				event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
				resource: { id: `I-1959-${member.userId}` },
			}),
		});
		assert.equal(hook.status, 200);
		const sub = (await Subscription.findOne({ where: { userId: member.userId } }))!;
		assert.equal(sub.get('status'), 'cancelled');
		const user = (await User.findByPk(member.userId))!;
		assert.equal(user.get('plan'), 'free', 'Sperre überlebt die Kündigung — kein plan-restore');
	});

	it('AK1: gesperrtes Abo blockiert keinen Zweitabschluss (locked nicht in OPEN_SUBSCRIPTION_STATUSES)', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId);
		const lockRes = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(lockRes.status, 200, 'Setup: Sperre muss gelungen sein');

		const res = await fetch(`${server.baseUrl}/billing/subscriptions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: member.cookie },
			body: JSON.stringify({ plan: 'pro', period: 'monthly' }),
		});
		assert.equal(
			res.status,
			201,
			'locked ist kein offenes Abo — ein neuer Abschluss schaltet wieder frei (Spec-Entscheidung)',
		);
	});

	it('AK2: Admin-Storno ruft cancel mit externalSubscriptionId; Status bleibt bis zum Webhook active; CANCELLED → cancelled, plan bleibt plus', async () => {
		let cancelledId: string | undefined;
		server = await startTestServer(
			withPaypal(async (externalSubscriptionId) => {
				cancelledId = externalSubscriptionId;
			}),
		);
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId);

		const res = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(res.status, 200);
		assert.equal(cancelledId, `I-1959-${member.userId}`, 'cancel mit der externen Abo-Id aufrufen');

		// ADR 0013: die Route löst nur den Provider-Aufruf aus — kein vorweggenommener Statuswechsel.
		let sub = (await Subscription.findOne({ where: { userId: member.userId } }))!;
		assert.equal(sub.get('status'), 'active', 'Wirksamkeit erst über das Webhook-Ereignis');

		const hook = await fetch(`${server.baseUrl}/webhooks/paypal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'paypal-transmission-sig': 'ok' },
			body: JSON.stringify({
				id: 'WH-1959-1',
				event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
				resource: { id: `I-1959-${member.userId}` },
			}),
		});
		assert.equal(hook.status, 200);
		sub = (await Subscription.findOne({ where: { userId: member.userId } }))!;
		assert.equal(sub.get('status'), 'cancelled');
		const user = (await User.findByPk(member.userId))!;
		assert.equal(user.get('plan'), 'plus', 'Paket läuft bis zum Ende des bezahlten Zeitraums');
	});

	it('AK2: bereits gekündigtes Abo (Restlaufzeit) → 409, kein PayPal-Aufruf', async () => {
		let paypalCalls = 0;
		server = await startTestServer(
			withPaypal(async () => {
				paypalCalls += 1;
			}),
		);
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId, { status: 'cancelled' });

		const res = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(res.status, 409);
		assert.equal(paypalCalls, 0);
	});

	it('AK2: Google-Play-Abo → 409 mit Hinweis, kein PayPal-Aufruf (Sperren bleibt möglich)', async () => {
		let paypalCalls = 0;
		server = await startTestServer(
			withPaypal(async () => {
				paypalCalls += 1;
			}),
		);
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		await createSub(member.userId, { provider: 'google', externalSubscriptionId: 'gpa-1959' });

		const res = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(res.status, 409);
		const body = (await res.json()) as { message?: string };
		assert.match(body.message ?? '', /Google/i, 'verständlicher Hinweis, kein nackter Fehlercode');
		assert.equal(paypalCalls, 0);

		const lockRes = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(lockRes.status, 200, 'Google-Play-Abo lässt sich rein lokal sperren');
	});

	it('AK2: PayPal lehnt ab (4xx) → 409; 5xx → 502', async () => {
		const failures: PaypalHttpError[] = [
			new PaypalHttpError('SUBSCRIPTION_STATUS_INVALID', 422),
			new PaypalHttpError('down', 500),
		];
		server = await startTestServer(
			withPaypal(async () => {
				throw failures.shift()!;
			}),
		);
		const admin = await login(ADMIN_EMAIL, 'admin');
		const member = await login(MEMBER_EMAIL, 'member');
		const member2 = await login(MEMBER2_EMAIL, 'member');
		await createSub(member.userId);
		await createSub(member2.userId);

		const res4xx = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(res4xx.status, 409);
		const res5xx = await fetch(`${server.baseUrl}/admin/users/${member2.userId}/subscription/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: admin.cookie },
			body: '{}',
		});
		assert.equal(res5xx.status, 502);
	});

	it('AK3: member/tester → 403 auf beide Routen; Selbstkündigung des Members bleibt nutzbar', async () => {
		server = await startTestServer(withPaypal(async () => {}));
		const member = await login(MEMBER_EMAIL, 'member');
		const tester = await login(TESTER_EMAIL, 'tester');
		await createSub(member.userId);

		for (const cookie of [member.cookie, tester.cookie]) {
			const lockRes = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/lock`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: '{}',
			});
			assert.equal(lockRes.status, 403);
			const cancelRes = await fetch(`${server.baseUrl}/admin/users/${member.userId}/subscription/cancel`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: '{}',
			});
			assert.equal(cancelRes.status, 403);
		}

		const selfCancel = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: member.cookie },
			body: '{}',
		});
		assert.equal(selfCancel.status, 200, 'die eigene Selbstkündigung bleibt unverändert nutzbar');
	});
});
