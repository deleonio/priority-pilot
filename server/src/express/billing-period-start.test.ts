import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';

/**
 * Rote Spec-Tests für #2230 (Spec docs/spec/issue-2230.md): Rechnung und Periodenverlängerung
 * entstehen nur bei `PAYMENT.SALE.COMPLETED`, die erste Periode beginnt mit der ersten Abbuchung.
 * Ende-zu-Ende über Checkout-Route und Webhook.
 */

applyTestAuthEnv('test-secret-issue-2230');

let server: TestServer;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOLERANCE_MS = 5 * 60 * 1000;

const post = (path: string, cookie: string, body: unknown = {}) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const deps = (externalSubscriptionId: string): AppDeps =>
	({
		paypalClient: {
			createSubscription: async () => ({ approvalUrl: 'https://paypal.example/approve', externalSubscriptionId }),
			cancel: async () => {},
			revise: async () => ({}),
		},
		paypalVerifier: async () => 'verified',
		mailSender: async () => {},
	}) as unknown as AppDeps;

let counter = 0;
const webhook = (type: string, externalId: string, saleId?: string) =>
	fetch(`${server.baseUrl}/webhooks/paypal`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'paypal-transmission-sig': 'ok' },
		body: JSON.stringify({
			id: `WH-2230-${(counter += 1)}`,
			event_type: type,
			resource: { id: saleId ?? externalId, billing_agreement_id: externalId },
		}),
	});

const plusMonth = (date: Date, months = 1): Date => {
	const result = new Date(date);
	result.setUTCMonth(result.getUTCMonth() + months);
	return result;
};
const near = (actual: Date, expected: Date, tolerance = TOLERANCE_MS) =>
	Math.abs(actual.getTime() - expected.getTime()) <= tolerance;

const load = async (externalId: string) => {
	const sub = await Subscription.findOne({ where: { externalSubscriptionId: externalId } });
	assert.ok(sub, `Abo ${externalId} muss existieren`);
	const invoices = await Invoice.findAll({
		where: { subscriptionId: sub.get('id') as number },
		order: [['periodEnd', 'ASC']],
	});
	return { sub, invoices, end: sub.get('currentPeriodEnd') as Date };
};

describe('Rechnung und Verlängerung nur bei SALE.COMPLETED (#2230)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1-AK3/AK6: Checkout → ACTIVATED → SALE.COMPLETED → SALE.COMPLETED → CANCELLED', async () => {
		const id = 'I-2230-FLOW';
		server = await startTestServer(deps(id));
		const cookie = await server.login('flow-2230@example.com');
		assert.equal((await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'monthly' })).status, 201);
		const afterCheckout = await load(id);

		await webhook('BILLING.SUBSCRIPTION.ACTIVATED', id);
		const activated = await load(id);
		assert.equal(activated.invoices.length, 0, 'AK3: ACTIVATED stellt keine Rechnung aus');
		assert.equal(activated.sub.get('status'), 'active');
		assert.equal(activated.end.getTime(), afterCheckout.end.getTime(), 'AK3: ACTIVATED verlängert nicht');

		const chargedAt = new Date();
		await webhook('PAYMENT.SALE.COMPLETED', id, 'PAYID-2230-1');
		const first = await load(id);
		assert.equal(first.invoices.length, 1, 'AK1: genau eine Rechnung je Abbuchung');
		assert.equal(first.invoices[0]?.get('saleId'), 'PAYID-2230-1');
		assert.ok(near(first.invoices[0]?.get('periodStart') as Date, chargedAt), 'AK1: Leistungszeitraum ab Abbuchung');
		assert.ok(
			near(first.invoices[0]?.get('periodEnd') as Date, plusMonth(chargedAt)),
			'AK1: Ende = Abbuchung + 1 Monat',
		);
		assert.ok(near(first.end, plusMonth(chargedAt)), 'AK2: Abo-Ende genau eine Periode nach der ersten Abbuchung');

		await webhook('PAYMENT.SALE.COMPLETED', id, 'PAYID-2230-2');
		const second = await load(id);
		assert.equal(second.invoices.length, 2);
		assert.equal(
			second.end.getTime(),
			plusMonth(first.end).getTime(),
			'AK2: zweite Abbuchung = genau eine weitere Periode',
		);

		await webhook('BILLING.SUBSCRIPTION.CANCELLED', id);
		const cancelled = await load(id);
		assert.equal(cancelled.sub.get('status'), 'cancelled');
		assert.equal(cancelled.end.getTime(), second.end.getTime(), 'AK6: Kündigung endet zum tatsächlichen Periodenende');
	});

	it('Regel 4: verspätete Zustimmung — die erste Abbuchung rechnet ab der Abbuchung, nicht ab dem Checkout', async () => {
		const id = 'I-2230-LATE';
		server = await startTestServer(deps(id));
		const cookie = await server.login('late-2230@example.com');
		assert.equal((await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'monthly' })).status, 201);
		await Subscription.update(
			{ currentPeriodEnd: new Date(Date.now() - 3 * 60 * 60 * 1000) },
			{ where: { externalSubscriptionId: id } },
		);

		const chargedAt = new Date();
		await webhook('PAYMENT.SALE.COMPLETED', id, 'PAYID-2230-L');
		assert.ok(near((await load(id)).end, plusMonth(chargedAt)), 'Ende = Abbuchung + 1 Periode');
	});

	it('AK4: Weiterführen mit Startaufschub — ACTIVATED ohne Rechnung, SALE.COMPLETED zum Start → Ende = Start + 1 Periode', async () => {
		const id = 'I-2230-DEFER';
		server = await startTestServer(deps(id));
		const cookie = await server.login('defer-2230@example.com');
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		const start = new Date(Date.now() + 15 * DAY_MS);
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-2230-OLD',
			plan: 'plus',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: start,
		});
		assert.equal((await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'monthly' })).status, 201);

		await webhook('BILLING.SUBSCRIPTION.ACTIVATED', id);
		assert.equal((await load(id)).invoices.length, 0, 'ohne Abbuchung keine Rechnung');

		await webhook('PAYMENT.SALE.COMPLETED', id, 'PAYID-2230-D');
		const { invoices, end } = await load(id);
		assert.equal(invoices.length, 1);
		assert.ok(near(end, plusMonth(start)), 'Ende = Start + 1 Periode');
		assert.ok(near(invoices[0]?.get('periodStart') as Date, start), 'Leistungszeitraum ab dem Start');
	});

	it('AK5: Upgrade mit Einrichtungsgebühr — ACTIVATED ohne Rechnung, Aktivierungs-Sale = eine Rechnung, Ende = Abbuchung + 1 Periode', async () => {
		const id = 'I-2230-UP';
		server = await startTestServer(deps(id));
		const cookie = await server.login('up-2230@example.com');
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-2230-UP-OLD',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 15 * DAY_MS),
		});
		assert.equal((await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' })).status, 200);

		await webhook('BILLING.SUBSCRIPTION.ACTIVATED', id);
		assert.equal((await load(id)).invoices.length, 0);

		const chargedAt = new Date();
		await webhook('PAYMENT.SALE.COMPLETED', id, 'PAYID-2230-U');
		const { invoices, end } = await load(id);
		assert.equal(invoices.length, 1);
		assert.ok(near(end, plusMonth(chargedAt)), 'Ende = Abbuchung + 1 Periode');
	});

	it('AK5: Upgrade, dessen erster Zyklus voll durch Guthaben gedeckt ist — Ende = Upgrade + 1 Periode, keine Rechnung', async () => {
		const id = 'I-2230-CREDIT';
		server = await startTestServer(deps(id));
		const cookie = await server.login('credit-2230@example.com');
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-2230-CREDIT-OLD',
			plan: 'plus',
			period: 'yearly',
			status: 'cancelled',
			currentPeriodEnd: new Date(Date.now() + 360 * DAY_MS),
		});
		const upgradedAt = new Date();
		assert.equal((await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' })).status, 200);

		await webhook('BILLING.SUBSCRIPTION.ACTIVATED', id);
		const { sub, invoices, end } = await load(id);
		assert.equal(sub.get('status'), 'active', 'Vorbedingung: ACTIVATED wurde verarbeitet');
		assert.equal(invoices.length, 0, 'ohne Abbuchung keine Rechnung');
		assert.ok(near(end, plusMonth(upgradedAt), 2 * DAY_MS), 'Paket endet nicht sofort: Ende ≈ Upgrade + 1 Periode');
	});
});
