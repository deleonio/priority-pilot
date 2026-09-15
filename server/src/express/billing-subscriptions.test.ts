import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
// Invoice ist (Stand #1495) noch nicht aus models/index.ts re-exportiert — direkter Modul-Import
// (Muster models/invoice.test.ts), um diese Testdatei nicht an einer fremden Produktivlücke
// scheitern zu lassen (SKILL.md: Import-/Syntaxfehler ist kein legitimes Rot).
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';

/**
 * Rote Spec-Tests für #1505 (Spec docs/spec/issue-1505.md) — AK1-AK5 und AK7. Die Routen
 * `server/src/express/routes/billingSubscriptions.ts` existieren noch nicht: bis dahin liefert
 * jeder Aufruf 404 (ohne Session) bzw. 401 (mit Session, sobald requireAuth den Pfad kennt — der
 * globale `app.use(requireAuth)` greift bereits VOR jeder Router-Existenz, siehe #207) statt der
 * erwarteten Statuscodes. Legitimer Erstzustand für neue Routen. KEIN Produktivcode.
 *
 * `paypalClient` ist ein neuer, injizierbarer `AppDeps`-Eintrag (Vorbild `paypalVerifier`,
 * #1495) — noch nicht in `AppDeps` deklariert, daher der Cast über `unknown`.
 */

applyTestAuthEnv('test-secret-issue-1505');

let server: TestServer;

interface FakePaypalClient {
	createSubscription: (planId: string) => Promise<{ approvalUrl: string; externalSubscriptionId: string }>;
	cancel: (externalSubscriptionId: string) => Promise<void>;
	revise: (externalSubscriptionId: string, targetPlanId: string) => Promise<{ approvalUrl?: string }>;
}

const withClient = (client: Partial<FakePaypalClient>): AppDeps =>
	({
		paypalClient: {
			createSubscription: async (planId: string) => ({
				approvalUrl: `https://paypal.example/approve/${planId}`,
				externalSubscriptionId: `I-${planId}`,
			}),
			cancel: async () => {},
			revise: async () => ({}),
			...client,
		},
	}) as unknown as AppDeps;

describe('Abo-Verwaltungs-API (#1505)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const login = (email: string) => server.login(email);
	const post = (path: string, cookie: string, body: unknown = {}) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});
	const get = (path: string, cookie: string) => fetch(`${server.baseUrl}${path}`, { headers: { Cookie: cookie } });

	it('AK1: POST /billing/subscriptions legt ein Abo mit Status approval_pending an und liefert die Zustimmungs-URL', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak1@example.com');

		const res = await post('/billing/subscriptions', cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 201);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.ok(body.approvalUrl, 'Antwort muss eine Zustimmungs-URL enthalten');

		const user = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.findOne({ where: { userId: user.id } });
		assert.ok(sub, 'Ein Subscription-Datensatz muss angelegt sein');
		assert.equal(sub?.get('status'), 'approval_pending');
	});

	it('AK2: ein zweiter POST /billing/subscriptions für denselben Nutzer mit laufendem Abo antwortet 409', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak2@example.com');

		const first = await post('/billing/subscriptions', cookie, { plan: 'pro', period: 'monthly' });
		assert.equal(first.status, 201, 'Vorbedingung: erstes Abo muss angelegt werden können');

		const second = await post('/billing/subscriptions', cookie, { plan: 'max', period: 'monthly' });
		assert.equal(second.status, 409, 'Ein zweites Abo bei laufendem/ausstehendem Abo muss abgelehnt werden');
	});

	it('AK2: ein Nutzer mit bereits aktivem Abo bekommt bei erneutem Anlegen 409', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak2-active@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-EXISTING',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions', cookie, { plan: 'max', period: 'monthly' });
		assert.equal(res.status, 409);
	});

	it('AK3: POST /billing/subscriptions/cancel ruft den Cancel-Aufruf mit der externen Abo-ID auf, plan bleibt unverändert', async () => {
		let calledWith: string | undefined;
		server = await startTestServer(
			withClient({
				cancel: async (externalSubscriptionId: string) => {
					calledWith = externalSubscriptionId;
				},
			}),
		);
		const cookie = await login('ak3@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-CANCEL-ME',
			plan: 'max',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/cancel', cookie);

		assert.equal(res.status, 200);
		assert.equal(calledWith, 'I-CANCEL-ME', 'Der Client muss mit der externen Abo-ID aufgerufen werden');
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CANCEL-ME' } });
		assert.equal(sub?.get('plan'), 'max', 'Der Plan darf sich durch den Aufruf allein nicht ändern (ADR 0013)');
	});

	it('AK4: POST /billing/subscriptions/change ruft den Revise-Aufruf mit der Ziel-Plan-ID auf und liefert die Zustimmungs-URL', async () => {
		let calledWith: [string, string] | undefined;
		server = await startTestServer(
			withClient({
				revise: async (externalSubscriptionId: string, targetPlanId: string) => {
					calledWith = [externalSubscriptionId, targetPlanId];
					return { approvalUrl: 'https://paypal.example/revise' };
				},
			}),
		);
		const cookie = await login('ak4@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-CHANGE-ME',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'max', period: 'monthly' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.equal(
			body.approvalUrl,
			'https://paypal.example/revise',
			'Zustimmungs-URL des Clients muss durchgereicht werden',
		);
		assert.equal(calledWith?.[0], 'I-CHANGE-ME', 'Der Client muss mit der externen Abo-ID aufgerufen werden');
		assert.ok(calledWith?.[1], 'Der Client muss mit der Ziel-Plan-ID aufgerufen werden');
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CHANGE-ME' } });
		assert.equal(sub?.get('plan'), 'pro', 'Der Plan darf sich durch den Aufruf allein nicht ändern (ADR 0013)');
	});

	it('AK4: liefert der Client keine Zustimmungs-URL, enthält die Antwort auch keine', async () => {
		server = await startTestServer(withClient({ revise: async () => ({}) }));
		const cookie = await login('ak4-noapproval@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-CHANGE-NOURL',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'max', period: 'monthly' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.equal(body.approvalUrl, undefined);
	});

	it('AK5: GET /billing/invoices liefert nur eigene Rechnungen', async () => {
		server = await startTestServer(withClient({}));
		const cookieA = await login('ak5-a@example.com');
		const cookieB = await login('ak5-b@example.com');
		const meA = (await (await get('/auth/me', cookieA)).json()) as { id: number };
		const meB = (await (await get('/auth/me', cookieB)).json()) as { id: number };
		const subA = await Subscription.create({
			userId: meA.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-A',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const subB = await Subscription.create({
			userId: meB.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-B',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await Invoice.create({
			userId: meA.id,
			subscriptionId: subA.get('id') as number,
			number: 'INV-2026-100001',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});
		await Invoice.create({
			userId: meB.id,
			subscriptionId: subB.get('id') as number,
			number: 'INV-2026-100002',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const res = await get('/billing/invoices', cookieA);

		assert.equal(res.status, 200);
		const body = (await res.json()) as { number: string }[];
		assert.equal(body.length, 1, 'Nur die eigene Rechnung darf zurückkommen');
		assert.equal(body[0].number, 'INV-2026-100001');
	});

	it('AK5: GET /billing/invoices/{id} einer fremden Rechnung antwortet 404', async () => {
		server = await startTestServer(withClient({}));
		const cookieA = await login('ak5-id-a@example.com');
		const cookieB = await login('ak5-id-b@example.com');
		const meB = (await (await get('/auth/me', cookieB)).json()) as { id: number };
		const subB = await Subscription.create({
			userId: meB.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-ID-B',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const invoiceB = await Invoice.create({
			userId: meB.id,
			subscriptionId: subB.get('id') as number,
			number: 'INV-2026-100003',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const res = await get(`/billing/invoices/${invoiceB.get('id')}`, cookieA);

		assert.equal(res.status, 404, 'Fremde Rechnungen dürfen weder inhaltlich noch über den Status verraten werden');
	});

	it('AK5: GET /billing/invoices/{id} der eigenen Rechnung antwortet 200', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak5-own@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-OWN',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const invoice = await Invoice.create({
			userId: me.id,
			subscriptionId: sub.get('id') as number,
			number: 'INV-2026-100004',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const res = await get(`/billing/invoices/${invoice.get('id')}`, cookie);

		assert.equal(res.status, 200);
		const body = (await res.json()) as { number: string };
		assert.equal(body.number, 'INV-2026-100004');
	});

	// AK7: alle vier Routen ohne Session → 401 (requireAuth greift bereits vor Router-Existenz, #207).
	describe('AK7: ohne Session → 401', () => {
		beforeEach(async () => {
			if (!server) server = await startTestServer(withClient({}));
		});

		it('POST /billing/subscriptions ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/subscriptions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: 'pro', period: 'monthly' }),
			});
			assert.equal(res.status, 401);
		});

		it('POST /billing/subscriptions/cancel ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, { method: 'POST' });
			assert.equal(res.status, 401);
		});

		it('POST /billing/subscriptions/change ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/subscriptions/change`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: 'max', period: 'monthly' }),
			});
			assert.equal(res.status, 401);
		});

		it('GET /billing/invoices ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/invoices`);
			assert.equal(res.status, 401);
		});
	});
});
