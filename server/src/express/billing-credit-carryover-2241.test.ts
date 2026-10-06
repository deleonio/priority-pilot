import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
import Invoice from '../models/invoice.js';
import { getPlansCatalog } from '../logics/plans.js';
import type { AppDeps } from './index.js';

/** Rote Spec-Tests für #2241 (Spec docs/spec/issue-2241.md): Guthaben ≥ Preis wird auf Folgezyklen übertragen. */

applyTestAuthEnv('test-secret-issue-2241');

let server: TestServer;
const DAY_MS = 24 * 60 * 60 * 1000;

const post = (path: string, cookie: string, body: unknown = {}) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const startsAfterPaypal: { firstCycleCents?: number; startTime?: Date }[] = [];
const deps = (): AppDeps =>
	({
		paypalClient: {
			createSubscription: async (_planId: string, override?: { firstCycleCents?: number; startTime?: Date }) => {
				startsAfterPaypal.push({ firstCycleCents: override?.firstCycleCents, startTime: override?.startTime });
				return { approvalUrl: 'https://paypal.example/upgrade', externalSubscriptionId: 'I-NEW-2241' };
			},
			cancel: async () => {},
			revise: async () => ({}),
		},
		paypalVerifier: async () => 'verified',
		mailSender: async () => {},
	}) as unknown as AppDeps;

describe('Guthaben-Übertrag beim Upgrade (#2241)', () => {
	beforeEach(async () => {
		await resetDb();
		startsAfterPaypal.length = 0;
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1/AK2/AK5: Plus jährlich → Pro monatlich — keine Rechnung, k Perioden gedeckt, Rest bleibt, Vorschau nennt das Datum', async () => {
		server = await startTestServer(deps());
		const cookie = await server.login('carry-2241@example.com');
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-OLD-2241',
			plan: 'plus',
			period: 'yearly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 330 * DAY_MS),
		});
		const price = getPlansCatalog().prices.pro.monthly;

		const preview = (await (
			await post('/billing/subscriptions/change/preview', cookie, { plan: 'pro', period: 'monthly' })
		).json()) as { creditCents: number; dueCents: number; creditCoversUntil?: string };
		const k = Math.floor(preview.creditCents / price);
		const r = preview.creditCents - k * price;
		assert.ok(k >= 1, `Vorbedingung: Guthaben deckt mindestens einen Zyklus, war ${preview.creditCents}`);
		assert.equal(preview.dueCents, price - r, 'AK2: Vorschau nennt die Gebühr P − r, fällig bei Zustimmung');
		assert.ok(preview.creditCoversUntil, 'AK5: Vorschau nennt, bis wann das Guthaben reicht');
		const covers = new Date(preview.creditCoversUntil as string).getTime();
		assert.ok(covers >= Date.now() + k * 28 * DAY_MS && covers <= Date.now() + (k * 31 + 1) * DAY_MS);

		assert.equal((await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' })).status, 200);

		assert.equal(await Invoice.count(), 0, 'AK1: keine (0-€-)Rechnung beim Upgrade');
		const pending = await Subscription.findOne({ where: { userId: me.id, status: 'approval_pending' } });
		assert.equal(pending?.get('creditCents'), r, 'AK1: Rest r bleibt als Guthaben');
		const end = (pending?.get('currentPeriodEnd') as Date).getTime();
		assert.ok(end >= Date.now() + k * 28 * DAY_MS && end <= Date.now() + (k * 31 + 1) * DAY_MS, 'AK1: k Perioden');
		const start = startsAfterPaypal[0]?.startTime?.getTime() ?? 0;
		assert.ok(start >= Date.now() + k * 28 * DAY_MS, 'AK2: PayPal bucht die gedeckten Zyklen nicht ab');
		assert.equal(startsAfterPaypal[0]?.firstCycleCents, price - r, 'AK2: Gebühr P − r bei Zustimmung');
	});

	it('AK4: erste echte Abbuchung nach einem Guthaben-Upgrade verlängert ab altem currentPeriodEnd, nicht ab jetzt', async () => {
		const id = 'I-CARRY-2241';
		server = await startTestServer(deps());
		const cookie = await server.login('late-2241@example.com');
		const me = (await (await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } })).json()) as {
			id: number;
		};
		const oldEnd = new Date(Date.now() - 2 * DAY_MS);
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: id,
			plan: 'pro',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: oldEnd,
			creditCents: 300,
		});
		await fetch(`${server.baseUrl}/webhooks/paypal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'paypal-transmission-sig': 'ok' },
			body: JSON.stringify({
				id: 'WH-2241-1',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { id: 'PAYID-2241', billing_agreement_id: id, amount: { total: '5.99', currency: 'EUR' } },
			}),
		});
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: id } });
		const expected = new Date(oldEnd);
		expected.setUTCMonth(expected.getUTCMonth() + 1);
		assert.equal((sub?.get('currentPeriodEnd') as Date).getTime(), expected.getTime());
	});
});
