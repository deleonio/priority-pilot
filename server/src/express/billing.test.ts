import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Subscription, User, WebhookEvent } from '../models/index.js';
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';
import { applyDuePendingPlan, type PaypalVerificationResult } from '../logics/paypal.js';

/**
 * Rote Spec-Tests für #1495 (Spec docs/spec/issue-1495.md) — Webhook-Route AK1/AK3/AK4/AK5/AK6.
 * `server/src/express/routes/billing.ts` und die Mount-Verdrahtung in `index.ts` existieren noch
 * nicht: bis dahin liefert `/webhooks/paypal`/`/billing/return` 404 statt der erwarteten Statuscodes
 * — das ist der legitime Erst-Zustand für eine neue Route. KEIN Produktivcode.
 *
 * `paypalVerifier` ist ein neuer, injizierbarer `AppDeps`-Eintrag (Vorbild `obsidianGithubClient`,
 * `mailSender`) — noch nicht in `AppDeps` deklariert, daher der Cast über `unknown`.
 */

let server: TestServer;

const withVerifier = (result: PaypalVerificationResult | ((rawBody: Buffer) => PaypalVerificationResult)): AppDeps =>
	({
		paypalVerifier: async (rawBody: Buffer) => (typeof result === 'function' ? result(rawBody) : result),
	}) as unknown as AppDeps;

// #1506: Zahlungsereignisse stoßen `issueInvoiceForPeriod` an, dessen Default-Versand echten SMTP
// erreichen würde — ein injizierter Fake hält den Test ohne Netzwerk deterministisch (Vertrag
// `BillingDeps.mailSender`, docs/spec/issue-1506.md).
const withVerifierAndMail = (
	result: PaypalVerificationResult | ((rawBody: Buffer) => PaypalVerificationResult),
): AppDeps =>
	({
		paypalVerifier: async (rawBody: Buffer) => (typeof result === 'function' ? result(rawBody) : result),
		mailSender: async () => {},
	}) as unknown as AppDeps;

const rawPost = (path: string, rawBody: string, headers: Record<string, string> = {}) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: rawBody,
	});

describe('Billing/Webhook-API (#1495)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: eine manipulierte Signatur wird abgewiesen — ohne Session und ohne CSRF-Token erreichbar', async () => {
		server = await startTestServer(withVerifier('invalid'));
		const res = await rawPost(
			'/webhooks/paypal',
			JSON.stringify({ id: 'WH-FORGED', event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: {} }),
			{ 'paypal-transmission-sig': 'forged' },
		);
		assert.equal(
			res.status,
			400,
			'Eine ungültige Signatur muss abgelehnt werden (kein 401/403 — kein Auth-Konzept hier)',
		);
	});

	it('AK1: der Handler verarbeitet den unveränderten Rohbody (Byte-Vergleich über den injizierten Verifier)', async () => {
		const sentRaw = '{"id":"WH-RAW-1",   "event_type":"BILLING.SUBSCRIPTION.ACTIVATED","resource":{}}';
		let seenRaw: string | undefined;
		server = await startTestServer(
			withVerifier((rawBody) => {
				seenRaw = rawBody.toString('utf8');
				return 'verified';
			}),
		);
		await rawPost('/webhooks/paypal', sentRaw, { 'paypal-transmission-sig': 'ok' });
		assert.equal(
			seenRaw,
			sentRaw,
			'Der Verifier muss exakt die gesendeten Bytes sehen (kein Re-Serialisieren vor der Prüfung)',
		);
	});

	it('AK3: dasselbe verifizierte Ereignis zweimal zugestellt wird nur einmal verarbeitet (Dedup über die Ereignis-ID)', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 1,
			provider: 'paypal',
			externalSubscriptionId: 'I-DEDUP',
			plan: 'free',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const body = JSON.stringify({
			id: 'WH-DEDUP-1',
			event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
			resource: { id: 'I-DEDUP', plan_id: 'PAYPAL_PLAN_ID_PLUS_MONTHLY' },
		});

		await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });
		await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });

		const stored = await WebhookEvent.findAll({ where: { externalEventId: 'WH-DEDUP-1' } });
		assert.equal(stored.length, 1, 'Ein zweifach zugestelltes Ereignis darf nur einmal persistiert/verarbeitet werden');
	});

	it('AK4: ein Upgrade wirkt sofort auf den Plan', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 2,
			provider: 'paypal',
			externalSubscriptionId: 'I-UPGRADE',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-UPGRADE-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-UPGRADE', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-UPGRADE' } });
		assert.equal(sub?.get('plan'), 'pro', 'Ein Upgrade muss sofort wirken');
	});

	it('AK4: ein Downgrade wirkt erst zum currentPeriodEnd, nicht sofort', async () => {
		server = await startTestServer(withVerifier('verified'));
		const periodEnd = new Date('2026-12-01');
		await Subscription.create({
			userId: 3,
			provider: 'paypal',
			externalSubscriptionId: 'I-DOWNGRADE',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: periodEnd,
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-DOWNGRADE-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-DOWNGRADE', plan_id: 'PAYPAL_PLAN_ID_PLUS_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-DOWNGRADE' } });
		assert.equal(sub?.get('plan'), 'pro', 'Ein Downgrade darf NICHT sofort wirken');
		assert.equal(sub?.get('pendingPlan'), 'plus', 'Der geplante Downgrade muss vermerkt sein');
	});

	it('AK5: die Rückkehr-URL ohne zugehöriges Webhook-Ereignis ändert den Plan nicht', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 4,
			provider: 'paypal',
			externalSubscriptionId: 'I-RETURN',
			plan: 'free',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		await fetch(`${server.baseUrl}/billing/return?subscription_id=I-RETURN`);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-RETURN' } });
		assert.equal(sub?.get('plan'), 'free', 'Ohne verifiziertes Webhook-Ereignis darf sich der Plan nicht ändern');
	});

	const cancelWebhook = (subscriptionId: string, eventType: string) =>
		rawPost(
			'/webhooks/paypal',
			JSON.stringify({ id: `WH-${subscriptionId}`, event_type: eventType, resource: { id: subscriptionId } }),
			{ 'paypal-transmission-sig': 'ok' },
		);

	it('#1896 AK3/AK7: eine Kündigung behält das Paket bis Periodenende und merkt free vor', async () => {
		server = await startTestServer(withVerifier('verified'));
		const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		await Subscription.create({
			userId: 5,
			provider: 'paypal',
			externalSubscriptionId: 'I-CANCEL',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: periodEnd,
		});
		await cancelWebhook('I-CANCEL', 'BILLING.SUBSCRIPTION.CANCELLED');

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CANCEL' } });
		assert.equal(sub?.get('plan'), 'pro', 'Bezahltes Paket läuft bis zum Periodenende weiter');
		assert.equal(sub?.get('status'), 'cancelled');
		assert.equal(sub?.get('pendingPlan'), 'free');
		assert.equal((sub?.get('pendingPlanEffectiveAt') as Date).getTime(), periodEnd.getTime());
		assert.equal((sub?.get('currentPeriodEnd') as Date).getTime(), periodEnd.getTime(), 'Periodenende bleibt (AK7)');

		await applyDuePendingPlan(sub!, new Date(periodEnd.getTime() + 1000));
		assert.equal(sub?.get('plan'), 'free', 'Nach dem Periodenende gilt free');
	});

	it('#1896 AK4: eine Kündigung nach abgelaufener Periode ist sofort fällig und führt zu free', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 5,
			provider: 'paypal',
			externalSubscriptionId: 'I-CANCEL-LATE',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
		});
		await cancelWebhook('I-CANCEL-LATE', 'BILLING.SUBSCRIPTION.CANCELLED');

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CANCEL-LATE' } });
		assert.equal(sub?.get('pendingPlan'), 'free');
		await applyDuePendingPlan(sub!, new Date());
		assert.equal(sub?.get('plan'), 'free');
	});

	it('#1896 AK3/AK4: /auth/me wendet die fällige Vormerkung free an, auch neben einem abgebrochenen Neu-Checkout', async () => {
		server = await startTestServer(withVerifier('verified'));
		const cookie = await server.register('cancel-me@example.com', 'password123');
		const dbUser = await User.findOne({ where: { email: 'cancel-me@example.com' } });
		await dbUser!.update({ plan: 'pro' });
		const userId = dbUser!.id as number;
		await Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: 'I-CANCEL-ME',
			plan: 'pro',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
			pendingPlan: 'free',
			pendingPlanEffectiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
		});

		const read = async () =>
			(await (await fetch(`${server.baseUrl}/auth/me`, { headers: { cookie } })).json()) as {
				plan: string;
				subscription: { plan: string } | null;
			};
		const me = await read();
		assert.equal(me.subscription?.plan, 'free');
		assert.equal(me.plan, 'free');
		assert.equal((await User.findByPk(userId))?.plan, 'free');

		// Vormerkung erneut fällig, dann ein abgebrochener Neu-Checkout (approval_pending).
		await dbUser!.update({ plan: 'pro' });
		await Subscription.update(
			{ plan: 'pro', pendingPlan: 'free', pendingPlanEffectiveAt: new Date(Date.now() - 1000) },
			{ where: { externalSubscriptionId: 'I-CANCEL-ME' } },
		);
		await Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: 'I-NEW-CHECKOUT',
			plan: 'pro',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		});
		const again = await read();
		assert.equal(again.plan, 'free');
		assert.equal((await User.findByPk(userId))?.plan, 'free');
	});

	it('#1896 AK4: EXPIRED setzt weiterhin sofort auf free', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 5,
			provider: 'paypal',
			externalSubscriptionId: 'I-EXPIRED',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		});
		await cancelWebhook('I-EXPIRED', 'BILLING.SUBSCRIPTION.EXPIRED');

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-EXPIRED' } });
		assert.equal(sub?.get('plan'), 'free');
		assert.equal(sub?.get('status'), 'cancelled');
	});

	it('AK2/ADR 0013: die Wiederholung nach einem unerreichbaren Erstversuch wird verarbeitet, nicht als Duplikat verworfen', async () => {
		let attempt = 0;
		server = await startTestServer(withVerifier(() => (++attempt === 1 ? 'unreachable' : 'verified')));
		await Subscription.create({
			userId: 6,
			provider: 'paypal',
			externalSubscriptionId: 'I-RETRY',
			plan: 'free',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const body = JSON.stringify({
			id: 'WH-RETRY-1',
			event_type: 'BILLING.SUBSCRIPTION.UPDATED',
			resource: { id: 'I-RETRY', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
		});

		const first = await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });
		assert.equal(first.status, 503, 'Ohne Prüfmöglichkeit muss PayPal zur Wiederholung aufgefordert werden');

		const second = await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });
		assert.equal(second.status, 200);
		assert.deepEqual(
			await second.json(),
			{ status: 'processed' },
			'Die Wiederholung holt die Verifikation nach — sie ist kein Duplikat',
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-RETRY' } });
		assert.equal(sub?.get('plan'), 'pro', 'Das nachträglich verifizierte Ereignis muss wirksam werden');
		const stored = await WebhookEvent.findOne({ where: { externalEventId: 'WH-RETRY-1' } });
		assert.equal(stored?.get('verified'), true, 'Die Zeile darf nicht dauerhaft unverifiziert bleiben');
		assert.notEqual(stored?.get('processedAt'), null, 'Die Verarbeitung muss vermerkt sein');
	});

	it('AK3: eine Wiederholung eines bereits verarbeiteten Ereignisses bleibt ein wirkungsloses Duplikat', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 7,
			provider: 'paypal',
			externalSubscriptionId: 'I-DUP',
			plan: 'free',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const body = JSON.stringify({
			id: 'WH-DUP-1',
			event_type: 'BILLING.SUBSCRIPTION.UPDATED',
			resource: { id: 'I-DUP', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
		});

		await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });
		const second = await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });

		assert.equal(second.status, 200);
		assert.deepEqual(await second.json(), { status: 'duplicate' });
		assert.equal(
			await WebhookEvent.count({ where: { externalEventId: 'WH-DUP-1' } }),
			1,
			'Dedup über (provider, externalEventId) bleibt bestehen',
		);
	});

	// AK4: der vorgemerkte Downgrade wird beim Lesen des Abos (`/auth/me`) fällig angewendet —
	// hier direkt an der Logik geprüft, damit der Nachweis ohne Session-Aufbau auskommt.
	const subscriptionWithPending = (pendingPlanEffectiveAt: Date) =>
		Subscription.create({
			userId: 8,
			provider: 'paypal',
			externalSubscriptionId: 'I-PENDING',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: pendingPlanEffectiveAt,
			pendingPlan: 'plus',
			pendingPlanEffectiveAt,
		});

	it('AK4: ein fälliger Downgrade wird angewendet, sobald das Periodenende erreicht ist', async () => {
		const sub = await subscriptionWithPending(new Date('2026-12-01'));

		const applied = await applyDuePendingPlan(sub, new Date('2026-12-01T00:00:01Z'));

		assert.equal(applied, true);
		assert.equal(sub.get('plan'), 'plus', 'Zum currentPeriodEnd muss der Downgrade wirken');
		assert.equal(sub.get('pendingPlan'), null, 'Die Vormerkung ist danach verbraucht');
		assert.equal(sub.get('pendingPlanEffectiveAt'), null);
	});

	it('AK4: ein noch nicht fälliger Downgrade bleibt unangetastet', async () => {
		const sub = await subscriptionWithPending(new Date('2026-12-01'));

		const applied = await applyDuePendingPlan(sub, new Date('2026-11-30'));

		assert.equal(applied, false);
		assert.equal(sub.get('plan'), 'pro', 'Vor dem Periodenende bleibt das bezahlte Paket aktiv');
		assert.equal(sub.get('pendingPlan'), 'plus');
	});
});

/**
 * Rote Spec-Tests für #1506 (Spec docs/spec/issue-1506.md) — Zahlungsereignisse (AK1-AK4). Die
 * Abo-Suche über `resource.billing_agreement_id`, `applyPaymentEvent` und die Rechnungsauslösung
 * über den injizierten `mailSender` existieren noch nicht: bis dahin bleibt `currentPeriodEnd`/
 * `status`/`firstFailureAt` unverändert und es entsteht keine Rechnung — legitimer Erst-Zustand.
 * KEIN Produktivcode.
 */
describe('Billing/Webhook-API (#1506 — Zahlungsereignisse)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: PAYMENT.SALE.COMPLETED verlängert die Periode um einen Zeitraum, setzt active, löscht firstFailureAt und erzeugt genau eine Rechnung', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await Subscription.create({
			userId: 101,
			provider: 'paypal',
			externalSubscriptionId: 'I-PAY-1',
			plan: 'plus',
			period: 'monthly',
			status: 'past_due',
			firstFailureAt: new Date('2026-01-05'),
			currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-PAY-1',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { billing_agreement_id: 'I-PAY-1' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-PAY-1' } });
		assert.equal(sub?.get('status'), 'active', 'Eine erfolgreiche Abbuchung muss den Status auf active setzen');
		assert.equal(sub?.get('firstFailureAt'), null, 'Eine erfolgreiche Abbuchung muss firstFailureAt löschen');
		assert.equal(
			new Date(sub?.get('currentPeriodEnd') as Date).toISOString().slice(0, 10),
			'2026-03-01',
			'Die Periode muss um genau einen Monat (period=monthly) verschoben werden',
		);
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(invoices.length, 1, 'Genau eine Rechnung muss entstehen');
	});

	it('AK1: bei gleichzeitig gesetztem resource.id (Sale-ID) und resource.billing_agreement_id (Abo-ID) gewinnt billing_agreement_id für die Abo-Suche', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await Subscription.create({
			userId: 104,
			provider: 'paypal',
			externalSubscriptionId: 'I-PAY-BOTH',
			plan: 'plus',
			period: 'monthly',
			status: 'past_due',
			firstFailureAt: new Date('2026-01-05'),
			currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-PAY-BOTH',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { id: 'SALE-TXN-NOT-A-SUBSCRIPTION-ID', billing_agreement_id: 'I-PAY-BOTH' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-PAY-BOTH' } });
		assert.equal(
			sub?.get('status'),
			'active',
			'Die Abo-Suche muss über billing_agreement_id treffen, obwohl resource.id (Sale-/Transaktions-ID) ebenfalls gesetzt ist',
		);
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(invoices.length, 1, 'Genau eine Rechnung muss entstehen');
	});

	it('AK2: dasselbe PAYMENT.SALE.COMPLETED zweimal zugestellt erzeugt keine zweite Rechnung und verschiebt die Periode nicht erneut', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await Subscription.create({
			userId: 102,
			provider: 'paypal',
			externalSubscriptionId: 'I-PAY-2',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
		});
		const body = JSON.stringify({
			id: 'WH-PAY-2',
			event_type: 'PAYMENT.SALE.COMPLETED',
			resource: { billing_agreement_id: 'I-PAY-2' },
		});

		await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });
		await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-PAY-2' } });
		assert.equal(
			new Date(sub?.get('currentPeriodEnd') as Date).toISOString().slice(0, 10),
			'2026-03-01',
			'Eine doppelt zugestellte Zahlungsbestätigung darf die Periode nur einmal verschieben',
		);
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(
			invoices.length,
			1,
			'Eine doppelt zugestellte Zahlungsbestätigung darf keine zweite Rechnung erzeugen',
		);
	});

	it('AK3: BILLING.SUBSCRIPTION.PAYMENT.FAILED setzt beim ersten Mal firstFailureAt und status past_due', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await Subscription.create({
			userId: 103,
			provider: 'paypal',
			externalSubscriptionId: 'I-FAIL-1',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-02-01'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-FAIL-1',
				event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
				resource: { billing_agreement_id: 'I-FAIL-1' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-FAIL-1' } });
		assert.ok(sub?.get('firstFailureAt'), 'Der erste Fehlschlag muss firstFailureAt setzen');
		assert.equal(sub?.get('status'), 'past_due', 'Der erste Fehlschlag muss den Status auf past_due setzen');
	});

	it('AK3: ein weiteres PAYMENT.FAILED lässt firstFailureAt unverändert (Frist startet nicht neu)', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await Subscription.create({
			userId: 104,
			provider: 'paypal',
			externalSubscriptionId: 'I-FAIL-2',
			plan: 'plus',
			period: 'monthly',
			status: 'past_due',
			firstFailureAt: new Date('2026-01-05T00:00:00.000Z'),
			currentPeriodEnd: new Date('2026-02-01'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-FAIL-3',
				event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
				resource: { billing_agreement_id: 'I-FAIL-2' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-FAIL-2' } });
		assert.equal(
			new Date(sub?.get('firstFailureAt') as Date).toISOString(),
			'2026-01-05T00:00:00.000Z',
			'Ein weiterer Fehlschlag darf die bereits laufende Frist nicht verlängern',
		);
	});

	it('AK4: BILLING.SUBSCRIPTION.SUSPENDED setzt status suspended und lässt firstFailureAt unverändert', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		const firstFailureAt = new Date('2026-01-05T00:00:00.000Z');
		await Subscription.create({
			userId: 105,
			provider: 'paypal',
			externalSubscriptionId: 'I-SUSPEND-1',
			plan: 'plus',
			period: 'monthly',
			status: 'past_due',
			firstFailureAt,
			currentPeriodEnd: new Date('2026-02-01'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-SUSPEND-1',
				event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
				resource: { billing_agreement_id: 'I-SUSPEND-1' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-SUSPEND-1' } });
		assert.equal(sub?.get('status'), 'suspended', 'SUSPENDED muss den Status auf suspended setzen');
		assert.equal(
			new Date(sub?.get('firstFailureAt') as Date).toISOString(),
			firstFailureAt.toISOString(),
			'SUSPENDED darf die laufende Kulanzfrist nicht verändern',
		);
	});
});
