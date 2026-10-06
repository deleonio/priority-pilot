import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Subscription, User, WebhookEvent } from '../models/index.js';
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';
import { applyDuePendingPlan, type PaypalClient, type PaypalVerificationResult } from '../logics/paypal.js';
import { getPlansCatalog } from '../logics/plans.js';

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

	// #2140 AK1 (Test-Pflege): ein Upgrade wirkt nicht mehr mit dem Webhook, sondern erst mit dem
	// Zahlungseingang (Spec docs/spec/issue-2140.md) — bis dahin nur vorgemerkt.
	it('AK4/#2140: ein Upgrade wird mit dem Webhook nur vorgemerkt und wirkt erst mit PAYMENT.SALE.COMPLETED', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
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

		let sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-UPGRADE' } });
		assert.equal(sub?.get('plan'), 'plus', 'Ohne Zahlungseingang bleibt das bisherige Paket');
		assert.equal(sub?.get('pendingPlan'), 'pro');

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-UPGRADE-2',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { id: 'SALE-UPGRADE', billing_agreement_id: 'I-UPGRADE' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-UPGRADE' } });
		assert.equal(sub?.get('plan'), 'pro', 'Mit dem Zahlungseingang wirkt das Upgrade');
		assert.equal(sub?.get('pendingPlan'), null);
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

	// Fehlaktivierung trotz abgebrochener Zahlung (Sandbox-Befund): der Webhook kann auf beliebige
	// Ereignisse abonniert sein („alle Events" im Dashboard) — der Server darf den Plan deshalb nur
	// aus UPDATED/ACTIVATED ändern, nicht aus jedem plan_id-tragenden Ereignis wie CREATED.
	it('ein CREATED-Ereignis mit höherwertiger plan_id aktiviert ein awaiting Approval liegendes Abo nicht', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 11,
			provider: 'paypal',
			externalSubscriptionId: 'I-CREATED',
			plan: 'plus',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-CREATED-1',
				event_type: 'BILLING.SUBSCRIPTION.CREATED',
				resource: { id: 'I-CREATED', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CREATED' } });
		assert.equal(sub?.get('status'), 'approval_pending', 'CREATED darf ein Abo nicht aktivieren');
		assert.equal(sub?.get('plan'), 'plus', 'CREATED darf den Plan nicht ändern');
	});

	it('ein Planwechsel-Ereignis auf einer bereits gekündigten Zeile belebt das Abo nicht wieder auf', async () => {
		server = await startTestServer(withVerifier('verified'));
		// Zustand nach replacePredecessors (#1912): abgelöstes Abo gekündigt und auf free gesetzt.
		await Subscription.create({
			userId: 12,
			provider: 'paypal',
			externalSubscriptionId: 'I-DEAD',
			plan: 'free',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-DEAD-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-DEAD', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-DEAD' } });
		assert.equal(sub?.get('status'), 'cancelled', 'Ein gekündigtes Abo darf nicht reaktiviert werden');
		assert.equal(sub?.get('plan'), 'free');
	});

	it('ein Downgrade mit Zeitraumwechsel merkt Paket UND Periode vor und wendet beide zum Periodenende an', async () => {
		server = await startTestServer(withVerifier('verified'));
		const periodEnd = new Date('2026-12-01');
		await Subscription.create({
			userId: 14,
			provider: 'paypal',
			externalSubscriptionId: 'I-DOWN-PERIOD',
			plan: 'pro',
			period: 'yearly',
			status: 'active',
			currentPeriodEnd: periodEnd,
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-DOWN-PERIOD-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-DOWN-PERIOD', plan_id: 'PAYPAL_PLAN_ID_PLUS_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-DOWN-PERIOD' } });
		assert.equal(sub?.get('plan'), 'pro', 'Vor dem Periodenende bleibt das bezahlte Paket');
		assert.equal(sub?.get('pendingPlan'), 'plus');
		assert.equal(sub?.get('period'), 'yearly', 'Vor dem Periodenende bleibt die alte Periode');
		assert.equal((sub?.get('pendingPlanEffectiveAt') as Date).getTime(), periodEnd.getTime());

		const applied = await applyDuePendingPlan(sub!, new Date('2026-12-01T00:00:01Z'));
		assert.equal(applied, true);
		assert.equal(sub?.get('plan'), 'plus');
		assert.equal(sub?.get('period'), 'monthly', 'Zum Periodenende muss auch der Zeitraum wechseln');
	});

	// Review #1998 (Blocker): Ein gleichrangiger Zeitraumwechsel ist eine erneute Entscheidung für
	// das aktuelle Paket — eine ältere Downgrade-Vormerkung muss damit entfallen, sonst fiele der
	// Nutzer zum Periodenende still auf das niedrigere Paket, obwohl er zuletzt das höhere
	// gewählt hat. #2140 (Test-Pflege): der Wechsel selbst ist jetzt zahlungsgebunden vorgemerkt
	// statt sofort geschrieben und ersetzt die Downgrade-Vormerkung.
	it('ein gleichrangiger Zeitraumwechsel ersetzt eine ältere Downgrade-Vormerkung durch die zahlungsgebundene', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 16,
			provider: 'paypal',
			externalSubscriptionId: 'I-PERIOD-DROP',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
			pendingPlan: 'plus',
			pendingPeriod: 'monthly',
			pendingPlanEffectiveAt: new Date('2026-12-01'),
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-PERIOD-DROP-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-PERIOD-DROP', plan_id: 'PAYPAL_PLAN_ID_PRO_YEARLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-PERIOD-DROP' } });
		assert.equal(sub?.get('period'), 'monthly', 'Der Zeitraumwechsel wartet auf die Abbuchung');
		assert.equal(sub?.get('pendingPlan'), 'pro', 'Die Downgrade-Vormerkung ist durch den Wechsel ersetzt');
		assert.equal(sub?.get('pendingPeriod'), 'yearly');
		assert.equal(sub?.get('pendingPlanEffectiveAt'), null);
		assert.equal(
			await applyDuePendingPlan(sub!, new Date('2026-12-01T00:00:01Z')),
			false,
			'Nach dem Periodenende fällt nichts mehr zurück',
		);
		assert.equal(sub?.get('plan'), 'pro', 'Das Paket bleibt unverändert');
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
		// #2140 (Test-Pflege): ein Upgrade wirkt erst mit dem Zahlungseingang, das Ereignis merkt es vor.
		assert.equal(sub?.get('pendingPlan'), 'pro', 'Das nachträglich verifizierte Ereignis muss wirksam werden');
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

	it('#2233 AK5: Rechnungsfehler → 503 ohne Verlängerung; gleiche event.id danach → 200, eine Verlängerung, eine Rechnung', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		const periodEnd = new Date('2026-12-01T00:00:00Z');
		await Subscription.create({
			userId: 6,
			provider: 'paypal',
			externalSubscriptionId: 'I-ATOMIC',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: periodEnd,
		});
		const body = JSON.stringify({
			id: 'WH-ATOMIC-1',
			event_type: 'PAYMENT.SALE.COMPLETED',
			resource: { id: 'SALE-ATOMIC', billing_agreement_id: 'I-ATOMIC' },
		});
		const failing = mock.method(Invoice, 'create', async () => {
			throw new Error('Rechnungsbau erzwungen fehlgeschlagen');
		});
		let first: Response;
		try {
			first = await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });
		} finally {
			failing.mock.restore();
		}
		assert.equal(first.status, 503);
		const afterFailure = await Subscription.findOne({ where: { externalSubscriptionId: 'I-ATOMIC' } });
		assert.equal(afterFailure?.get('currentPeriodEnd')?.toString(), periodEnd.toString(), 'keine Verlängerung');
		assert.equal(await Invoice.count(), 0);

		const second = await rawPost('/webhooks/paypal', body, { 'paypal-transmission-sig': 'ok' });

		assert.equal(second.status, 200);
		const renewed = await Subscription.findOne({ where: { externalSubscriptionId: 'I-ATOMIC' } });
		const expected = new Date(periodEnd);
		expected.setUTCMonth(expected.getUTCMonth() + 1);
		assert.equal((renewed?.get('currentPeriodEnd') as Date).toISOString(), expected.toISOString(), 'genau einmal');
		assert.equal(await Invoice.count(), 1);
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

	// Grenzfall-Race beim Downgrade mit Zeitraumwechsel: Die Abbuchung des neuen Zyklus kann eintreffen,
	// BEVOR irgendein /auth/me die fällige Vormerkung (Paket+Zeitraum) anwendet — Verlängerung und
	// Rechnung müssen trotzdem mit dem NEUEN Paket×Zeitraum rechnen, nicht mit dem alten.
	it('eine fällige Downgrade-Vormerkung wird vor der Abbuchung angewendet: Verlängerung und Rechnung rechnen mit dem neuen Paket×Zeitraum', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await Subscription.create({
			userId: 106,
			provider: 'paypal',
			externalSubscriptionId: 'I-BOUNDARY',
			plan: 'pro',
			period: 'yearly',
			status: 'active',
			currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
			pendingPlan: 'plus',
			pendingPeriod: 'monthly',
			pendingPlanEffectiveAt: new Date('2026-09-01T00:00:00Z'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-BOUNDARY-1',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { billing_agreement_id: 'I-BOUNDARY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-BOUNDARY' } });
		assert.equal(sub?.get('plan'), 'plus', 'Die fällige Vormerkung muss vor der Verlängerung greifen');
		assert.equal(sub?.get('period'), 'monthly');
		assert.equal(
			new Date(sub?.get('currentPeriodEnd') as Date).toISOString().slice(0, 10),
			'2026-10-01',
			'Die Verlängerung muss um den NEUEN Zeitraum (1 Monat) erfolgen, nicht um die alte Periode (12 Monate)',
		);
		assert.equal(sub?.get('pendingPlan'), null, 'Die Vormerkung ist mit der Abbuchung verbraucht');
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(invoices.length, 1, 'Genau eine Rechnung muss entstehen');
		assert.equal(
			invoices[0]?.get('amountCents'),
			getPlansCatalog().prices.plus.monthly,
			'Die Rechnung trägt den Preis des neuen Pakets (Plus monatlich)',
		);
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

	it('#2030 AK4: BILLING.SUBSCRIPTION.PAYMENT.FAILED versendet keine Rechnungsmail und legt keine Rechnung an', async () => {
		let mails = 0;
		server = await startTestServer({
			paypalVerifier: async () => 'verified',
			mailSender: async () => {
				mails++;
			},
		} as unknown as AppDeps);
		const created = await Subscription.create({
			userId: 105,
			provider: 'paypal',
			externalSubscriptionId: 'I-FAIL-NOMAIL',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-02-01'),
		});

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-FAIL-NOMAIL',
				event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
				resource: { billing_agreement_id: 'I-FAIL-NOMAIL' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		assert.equal(mails, 0, 'Bei fehlgeschlagener Zahlung keine Rechnungsmail');
		assert.equal(await Invoice.count({ where: { subscriptionId: created.get('id') as number } }), 0);
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

/**
 * Rote Spec-Tests für #2086 (Spec docs/spec/issue-2086.md, AK2/AK3) — echter Zahlungsstatus je
 * Rechnung: Rechnungen entstehen mit `paymentStatus 'paid'` (plus Sale-Referenz aus
 * `resource.id`). Die REFUNDED-Tests dieses Blocks sind mit #2237 entfernt: eine Erstattung
 * erzeugt künftig eine Gutschrift mit eigener Nummer, statt die Originalrechnung auf `refunded`
 * zu setzen (PO-Entscheid 2026-10-05, Test-Pflege — Verträge leben in #2237 weiter).
 * KEIN Produktivcode.
 */
describe('Billing/Webhook-API (#2086 — Zahlungsstatus)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const createSubscription = async (externalId: string): Promise<void> => {
		await Subscription.create({
			userId: 101,
			provider: 'paypal',
			externalSubscriptionId: externalId,
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
		});
	};

	it('AK2: PAYMENT.SALE.COMPLETED erzeugt die Rechnung mit paymentStatus "paid" und der Sale-Referenz aus resource.id', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await createSubscription('I-2086-PAID');

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-2086-1',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { id: 'PAYID-2086-A', billing_agreement_id: 'I-2086-PAID' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2086-PAID' } });
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(invoices.length, 1, 'Genau eine Rechnung muss entstehen');
		assert.equal(invoices[0]?.get('paymentStatus'), 'paid', 'Eine bestätigte Abbuchung muss die Rechnung paid setzen');
		assert.equal(
			invoices[0]?.get('saleId'),
			'PAYID-2086-A',
			'Die Sale-Referenz (resource.id) muss auf der Rechnung landen — Anker für spätere Erstattungen',
		);
	});

	it('#2230 AK3: BILLING.SUBSCRIPTION.ACTIVATED erzeugt keine Rechnung und verlängert nicht, setzt aber den Status active', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await createSubscription('I-2086-ACT');
		const before = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2086-ACT' } });
		await before!.update({ status: 'approval_pending' });

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-2086-2',
				event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
				resource: { id: 'I-2086-ACT', billing_agreement_id: 'I-2086-ACT' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2086-ACT' } });
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(invoices.length, 0, 'ACTIVATED ist keine Abbuchung — keine Rechnung');
		assert.equal(sub?.get('status'), 'active');
		assert.equal(
			(sub?.get('currentPeriodEnd') as Date).toISOString(),
			'2026-02-01T00:00:00.000Z',
			'ACTIVATED verlängert die Periode nicht',
		);
	});
});

/**
 * Rote Spec-Tests für #2237 (Spec docs/spec/issue-2237.md) — Erstattung/Rückbuchung erzeugen eine
 * Gutschrift und entziehen das Paket: REFUNDED/REVERSED legen je genau einen Gutschriftsbeleg an
 * (eigene Nummer `GS-<Jahr>-<6-stellig>`, Bezug auf die Originalrechnung via `creditForInvoiceId`),
 * statt die Originalrechnung auf `refunded` zu setzen (#2086 bewusst umgekehrt, PO-Entscheid
 * 2026-10-05). Das Konto fällt sofort auf `free` und das PayPal-Abo wird gekündigt; nicht
 * zuordenbare Ereignisse werden sichtbar protokolliert, DENIED wirkt wie ein fehlgeschlagener
 * Einzug. Die Gutschrift-Behandlung existiert noch nicht — die Tests scheitern an den neuen
 * Erwartungen (legitimer Erst-Zustand). KEIN Produktivcode.
 */
describe('Billing/Webhook-API (#2237 — Gutschrift und Paketentzug)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	/** Verifier 'verified', Fake-Mailversand und ein Fake-PayPal-Client mit beobachtbarem `cancel`. */
	const withVerifierMailClient = (cancel: (externalSubscriptionId: string) => Promise<void>): AppDeps =>
		({
			paypalVerifier: async () => 'verified',
			mailSender: async () => {},
			paypalClient: { cancel } as unknown as PaypalClient,
		}) as unknown as AppDeps;

	const createSubscription = async (externalId: string, userId = 101): Promise<Subscription> =>
		Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: externalId,
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
		});

	const postEvent = (id: string, eventType: string, resource: Record<string, unknown>): Promise<Response> =>
		rawPost('/webhooks/paypal', JSON.stringify({ id, event_type: eventType, resource }), {
			'paypal-transmission-sig': 'ok',
		});

	const creditNotesOf = async (subscriptionId: number): Promise<Invoice[]> => {
		const invoices = await Invoice.findAll({ where: { subscriptionId } });
		return invoices.filter((invoice) => /^GS-\d{4}-\d{6}$/.test(String(invoice.get('number'))));
	};

	it('AK1: REFUNDED erzeugt genau eine Gutschrift mit eigener Nummer und Bezug auf die Originalrechnung — das Original bleibt paid', async () => {
		server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
		await createSubscription('I-2237-AK1');
		await postEvent('WH-2237-1', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-OLD',
			billing_agreement_id: 'I-2237-AK1',
		});
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-AK1' } });
		await sub!.update({ currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z') });
		await postEvent('WH-2237-2', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-NEW',
			billing_agreement_id: 'I-2237-AK1',
		});

		await postEvent('WH-2237-REFUND', 'PAYMENT.SALE.REFUNDED', {
			id: 'REFUND-2237',
			sale_id: 'PAYID-2237-OLD',
			billing_agreement_id: 'I-2237-AK1',
		});

		const invoices = await Invoice.findAll({ where: { subscriptionId: sub!.get('id') as number } });
		assert.equal(invoices.length, 3, 'Zwei Originalrechnungen plus genau eine Gutschrift');
		const original = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2237-OLD');
		const creditNote = invoices.find((invoice) => /^GS-\d{4}-\d{6}$/.test(String(invoice.get('number'))));
		assert.ok(original && creditNote, 'Originalrechnung (saleId) und Gutschrift (GS-Nummer) müssen existieren');
		const creditRaw = creditNote.get({ plain: true }) as unknown as Record<string, unknown>;
		assert.equal(
			creditRaw.creditForInvoiceId,
			original.get('id'),
			'Die Gutschrift muss auf die Originalrechnung verweisen',
		);
		assert.equal(creditNote.get('paymentStatus'), 'refunded', 'Die Gutschrift dokumentiert die Erstattung');
		assert.equal(
			creditNote.get('amountCents'),
			-Number(original.get('amountCents')),
			'Die Gutschrift trägt den negativen Betrag der Originalrechnung',
		);
		assert.equal(
			original.get('paymentStatus'),
			'paid',
			'Die Originalrechnung bleibt unverändert paid (PO-Entscheid 2026-10-05)',
		);
		assert.match(String(original.get('number')), /^INV-\d{4}-\d{6}$/, 'Nummer des Originals bleibt unangetastet');
	});

	it('AK1: REFUNDED ohne passende sale_id verweist auf die neueste Rechnung des Abos (Fallback)', async () => {
		server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
		await createSubscription('I-2237-FB');
		await postEvent('WH-2237-3', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-FB',
			billing_agreement_id: 'I-2237-FB',
		});
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-FB' } });

		await postEvent('WH-2237-REFUND-FB', 'PAYMENT.SALE.REFUNDED', {
			id: 'REFUND-2237-FB',
			sale_id: 'PAYID-UNBEKANNT',
			billing_agreement_id: 'I-2237-FB',
		});

		const invoices = await Invoice.findAll({ where: { subscriptionId: sub!.get('id') as number } });
		assert.equal(invoices.length, 2, 'Originalrechnung plus genau eine Gutschrift');
		const original = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2237-FB');
		const creditNote = invoices.find((invoice) => /^GS-\d{4}-\d{6}$/.test(String(invoice.get('number'))));
		assert.ok(original && creditNote, 'Original und Gutschrift müssen existieren');
		const creditRaw = creditNote.get({ plain: true }) as unknown as Record<string, unknown>;
		assert.equal(creditRaw.creditForInvoiceId, original.get('id'), 'Der Fallback trifft die neueste Rechnung des Abos');
		assert.equal(original.get('paymentStatus'), 'paid', 'Auch ohne Referenz-Treffer bleibt das Original paid');
	});

	it('AK2: REVERSED wird wie REFUNDED behandelt — Gutschrift und Abo-Ende', async () => {
		server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
		await createSubscription('I-2237-AK2');
		await postEvent('WH-2237-4', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-RV',
			billing_agreement_id: 'I-2237-AK2',
		});

		await postEvent('WH-2237-REVERSED', 'PAYMENT.SALE.REVERSED', {
			id: 'REVERSAL-2237',
			sale_id: 'PAYID-2237-RV',
			billing_agreement_id: 'I-2237-AK2',
		});

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-AK2' } });
		const creditNotes = await creditNotesOf(sub!.get('id') as number);
		assert.equal(creditNotes.length, 1, 'REVERSED erzeugt genau eine Gutschrift');
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub!.get('id') as number } });
		const original = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2237-RV');
		assert.ok(original, 'Die Originalrechnung muss existieren');
		const creditRaw = creditNotes[0]!.get({ plain: true }) as unknown as Record<string, unknown>;
		assert.equal(
			creditRaw.creditForInvoiceId,
			original.get('id'),
			'Auch die REVERSED-Gutschrift verweist auf das Original',
		);
		assert.equal(sub!.get('plan'), 'free', 'REVERSED entzieht das Paket');
		assert.equal(sub!.get('status'), 'cancelled', 'REVERSED beendet das Abo');
	});

	it('AK3: nach REFUNDED steht der Nutzer sofort auf free, das Abo auf free/cancelled ohne Vormerkungen — PayPal-Abo gekündigt', async () => {
		const cancel = mock.fn(async (_id: string) => {});
		server = await startTestServer(withVerifierMailClient(cancel));
		const cookie = await server.login('ak3-2237@example.com');
		const me = (await (await server.json('/auth/me', { headers: { cookie } })).json()) as { id: number };
		await User.update({ plan: 'plus' }, { where: { id: me.id } });
		const sub = await createSubscription('I-2237-AK3', me.id);
		await sub.update({
			pendingPlan: 'pro',
			pendingPeriod: 'yearly',
			pendingPlanEffectiveAt: new Date('2027-06-01T00:00:00.000Z'),
		});
		await postEvent('WH-2237-5', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-AK3',
			billing_agreement_id: 'I-2237-AK3',
		});

		await postEvent('WH-2237-REFUND-AK3', 'PAYMENT.SALE.REFUNDED', {
			id: 'REFUND-2237-AK3',
			sale_id: 'PAYID-2237-AK3',
			billing_agreement_id: 'I-2237-AK3',
		});

		const user = await User.findByPk(me.id);
		assert.equal(user?.get('plan'), 'free', 'User.plan fällt sofort auf free');
		const reloaded = await Subscription.findByPk(sub.get('id') as number);
		assert.equal(reloaded!.get('plan'), 'free', 'Das Abo fällt auf free');
		assert.equal(reloaded!.get('status'), 'cancelled', 'Das Abo wird beendet');
		assert.equal(reloaded!.get('pendingPlan'), null, 'Die Paket-Vormerkung ist geleert');
		assert.equal(reloaded!.get('pendingPeriod'), null, 'Die Zeitraum-Vormerkung ist geleert');
		assert.equal(reloaded!.get('pendingPlanEffectiveAt'), null, 'Der Vormerkungs-Zeitpunkt ist geleert');
		assert.equal(cancel.mock.calls.length, 1, 'Das PayPal-Abo wird genau einmal gekündigt');
		assert.equal(cancel.mock.calls[0]?.arguments[0], 'I-2237-AK3');
	});

	it('AK4: verifiziertes Ereignis ohne zuordnbares Abo wird sichtbar mit Anbieter und Event-ID protokolliert', async () => {
		const warnSpy = mock.method(console, 'warn', () => {});
		try {
			server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
			const res = await postEvent('WH-2237-NOMATCH', 'PAYMENT.SALE.REFUNDED', {
				id: 'REFUND-2237-NM',
				sale_id: 'PAYID-2237-NM',
				billing_agreement_id: 'I-2237-UNBEKANNT',
			});
			assert.equal(res.status, 200, 'Ohne Abo-Match wird trotzdem 200 quittiert — sonst wiederholt PayPal endlos');
			assert.ok(
				warnSpy.mock.calls.some((call) => {
					const message = call.arguments.map(String).join(' ');
					return message.includes('WH-2237-NOMATCH') && message.includes('paypal');
				}),
				'Das Ereignis muss mit Anbieter und Event-ID protokolliert werden statt still verarbeitet zu werden',
			);
		} finally {
			warnSpy.mock.restore();
		}
	});

	it('AK5: dieselbe Event-ID zweimal zugestellt erzeugt genau eine Gutschrift', async () => {
		server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
		await createSubscription('I-2237-AK5');
		await postEvent('WH-2237-6', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-DUP',
			billing_agreement_id: 'I-2237-AK5',
		});

		const refundResource = {
			id: 'REFUND-2237-DUP',
			sale_id: 'PAYID-2237-DUP',
			billing_agreement_id: 'I-2237-AK5',
		};
		const first = await postEvent('WH-2237-DUP', 'PAYMENT.SALE.REFUNDED', refundResource);
		const second = await postEvent('WH-2237-DUP', 'PAYMENT.SALE.REFUNDED', refundResource);
		assert.equal(first.status, 200);
		assert.equal(second.status, 200, 'Ein Duplikat wird ohne Wirkung quittiert');

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-AK5' } });
		const creditNotes = await creditNotesOf(sub!.get('id') as number);
		assert.equal(creditNotes.length, 1, 'Der Dedup über den Unique-Index verhindert die zweite Gutschrift');
	});

	it('AK1: zweites Ereignis derselben Sale (REFUNDED dann REVERSED) erzeugt erneut eine negative Gutschrift aufs Original — kein Gutschrift-auf-Gutschrift', async () => {
		server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
		await createSubscription('I-2237-SEQ');
		await postEvent('WH-2237-7', 'PAYMENT.SALE.COMPLETED', {
			id: 'PAYID-2237-SEQ',
			billing_agreement_id: 'I-2237-SEQ',
		});

		await postEvent('WH-2237-REFUND-SEQ', 'PAYMENT.SALE.REFUNDED', {
			id: 'REFUND-2237-SEQ',
			sale_id: 'PAYID-2237-SEQ',
			billing_agreement_id: 'I-2237-SEQ',
		});
		await postEvent('WH-2237-REVERSED-SEQ', 'PAYMENT.SALE.REVERSED', {
			id: 'REVERSAL-2237-SEQ',
			sale_id: 'PAYID-2237-SEQ',
			billing_agreement_id: 'I-2237-SEQ',
		});

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-SEQ' } });
		const creditNotes = await creditNotesOf(sub!.get('id') as number);
		assert.equal(creditNotes.length, 2, 'Jedes verifizierte Ereignis erzeugt genau eine eigene Gutschrift');
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub!.get('id') as number } });
		const original = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2237-SEQ');
		assert.ok(original, 'Die Originalrechnung muss existieren');
		for (const creditNote of creditNotes) {
			const creditRaw = creditNote.get({ plain: true }) as unknown as Record<string, unknown>;
			assert.equal(
				creditRaw.creditForInvoiceId,
				original.get('id'),
				'Beide Gutschriften verweisen auf die Originalrechnung, nie auf eine Gutschrift',
			);
			assert.equal(
				creditNote.get('amountCents'),
				-Number(original.get('amountCents')),
				'Beide Gutschriften tragen den negativen Originalbetrag — keine positive Folge-Gutschrift',
			);
			assert.equal(creditNote.get('saleId'), null, 'Die Gutschrift trägt selbst keine Sale-Referenz');
		}
		assert.equal(original.get('paymentStatus'), 'paid', 'Das Original bleibt unverändert paid');
	});

	it('AK6: DENIED setzt beim ersten Auftreten firstFailureAt und past_due — ein weiterer Fehlschlag verlängert die Frist nicht', async () => {
		server = await startTestServer(withVerifierMailClient(mock.fn(async (_id: string) => {})));
		await createSubscription('I-2237-AK6');

		await postEvent('WH-2237-DENIED-1', 'PAYMENT.SALE.DENIED', {
			id: 'PAYID-2237-D1',
			billing_agreement_id: 'I-2237-AK6',
		});
		let sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-AK6' } });
		const firstFailureAt = sub!.get('firstFailureAt');
		assert.ok(firstFailureAt, 'Der erste DENIED muss firstFailureAt setzen');
		assert.equal(sub!.get('status'), 'past_due', 'Der erste DENIED stellt das Abo auf past_due');

		await postEvent('WH-2237-DENIED-2', 'PAYMENT.SALE.DENIED', {
			id: 'PAYID-2237-D2',
			billing_agreement_id: 'I-2237-AK6',
		});
		sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2237-AK6' } });
		assert.equal(
			(sub!.get('firstFailureAt') as Date).toISOString(),
			(firstFailureAt as Date).toISOString(),
			'Ein weiterer Fehlschlag verlängert die Frist nicht',
		);
		assert.equal(sub!.get('status'), 'past_due');
	});
});

/**
 * Rote Spec-Tests für #2243 (Spec docs/spec/issue-2243.md) — eine späte Abbuchung
 * (`PAYMENT.SALE.COMPLETED`) auf einer `cancelled`-Zeile belebt das Abo nicht wieder auf: weder
 * Status, Periode noch `User.plan` ändern sich, die Rechnung über den abgebuchten Betrag entsteht trotzdem (#2232 AK3), der Fall wird protokolliert.
 * Heute setzt der Zweig die Zeile auf `active`, verlängert und stellt eine Rechnung aus. KEIN Produktivcode.
 */
describe('Billing/Webhook-API (#2243 — späte Abbuchung auf gekündigtem Abo)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const withVerifierMail = (): AppDeps =>
		({ paypalVerifier: async () => 'verified', mailSender: async () => {} }) as unknown as AppDeps;

	const postSale = (eventId: string, saleId: string, externalId: string): Promise<Response> =>
		rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: eventId,
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { id: saleId, billing_agreement_id: externalId, amount: { total: '8.99', currency: 'EUR' } },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

	it('AK1+AK2: gekündigte Zeile mit laufender Periode bleibt unverändert, mit Rechnung über den abgebuchten Betrag — Warnung mit Abo- und Sale-ID, 200', async () => {
		const warnSpy = mock.method(console, 'warn', () => {});
		try {
			server = await startTestServer(withVerifierMail());
			const cookie = await server.login('ak1-2243@example.com');
			const me = (await (await server.json('/auth/me', { headers: { cookie } })).json()) as { id: number };
			await User.update({ plan: 'plus' }, { where: { id: me.id } });
			const periodEnd = new Date('2099-01-01T00:00:00.000Z');
			const sub = await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: 'I-2243-AK1',
				plan: 'plus',
				period: 'monthly',
				status: 'cancelled',
				currentPeriodEnd: periodEnd,
			});

			const res = await postSale('WH-2243-1', 'PAYID-2243-1', 'I-2243-AK1');

			assert.equal(res.status, 200, 'Der Webhook wird quittiert — sonst wiederholt PayPal endlos');
			const reloaded = await Subscription.findByPk(sub.get('id') as number);
			assert.equal(reloaded!.get('status'), 'cancelled', 'Ein gekündigtes Abo darf nicht reaktiviert werden');
			assert.equal(reloaded!.get('plan'), 'plus');
			assert.equal((reloaded!.get('currentPeriodEnd') as Date).toISOString(), periodEnd.toISOString());
			assert.equal((await User.findByPk(me.id))?.get('plan'), 'plus', 'User.plan bleibt unverändert');
			const invoices = await Invoice.findAll({ where: { subscriptionId: sub.get('id') as number } });
			assert.equal(invoices.length, 1, 'Der abgebuchte Betrag bekommt seinen Beleg');
			assert.equal(invoices[0].get('amountCents'), 899);
			assert.ok(
				warnSpy.mock.calls.some((call) => {
					const message = call.arguments.map(String).join(' ');
					return message.includes('I-2243-AK1') && message.includes('PAYID-2243-1');
				}),
				'Der Fall muss mit externer Abo-ID und Sale-ID protokolliert werden',
			);
			assert.equal(await WebhookEvent.count({ where: { externalEventId: 'WH-2243-1' } }), 1);
		} finally {
			warnSpy.mock.restore();
		}
	});

	it('AK1: abgelöste Zeile (free) neben aktiver Zeile desselben Nutzers — späte Abbuchung ändert keine Zeile und nicht User.plan, stellt aber den Beleg aus', async () => {
		const warnSpy = mock.method(console, 'warn', () => {});
		try {
			server = await startTestServer(withVerifierMail());
			const cookie = await server.login('ak2-2243@example.com');
			const me = (await (await server.json('/auth/me', { headers: { cookie } })).json()) as { id: number };
			await User.update({ plan: 'pro' }, { where: { id: me.id } });
			const oldPeriodEnd = new Date('2026-12-01T00:00:00.000Z');
			const newPeriodEnd = new Date('2099-01-01T00:00:00.000Z');
			const old = await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: 'I-2243-OLD',
				plan: 'free',
				period: 'monthly',
				status: 'cancelled',
				currentPeriodEnd: oldPeriodEnd,
			});
			const current = await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: 'I-2243-NEW',
				plan: 'pro',
				period: 'monthly',
				status: 'active',
				currentPeriodEnd: newPeriodEnd,
			});

			const res = await postSale('WH-2243-2', 'PAYID-2243-2', 'I-2243-OLD');

			assert.equal(res.status, 200);

			const oldAfter = await Subscription.findByPk(old.get('id') as number);
			assert.equal(oldAfter!.get('status'), 'cancelled');
			assert.equal(oldAfter!.get('plan'), 'free');
			assert.equal((oldAfter!.get('currentPeriodEnd') as Date).toISOString(), oldPeriodEnd.toISOString());
			const currentAfter = await Subscription.findByPk(current.get('id') as number);
			assert.equal(currentAfter!.get('status'), 'active');
			assert.equal((currentAfter!.get('currentPeriodEnd') as Date).toISOString(), newPeriodEnd.toISOString());
			assert.equal((await User.findByPk(me.id))?.get('plan'), 'pro', 'User.plan bleibt unverändert');
			assert.equal(await Invoice.count({ where: { subscriptionId: old.get('id') as number } }), 1);
			assert.equal(await Invoice.count({ where: { subscriptionId: current.get('id') as number } }), 0);
		} finally {
			warnSpy.mock.restore();
		}
	});
});

/**
 * Rote Spec-Tests für #2301 (Spec docs/spec/issue-2301.md) — eine späte Abbuchung auf einem gekündigten
 * Abo mit vorhandener Periodenrechnung bekommt eine eigene Rechnung mit ihrer Sale-ID; die Erstattung
 * dieser Sale-ID erzeugt die Gutschrift zu genau dieser Rechnung. KEIN Produktivcode.
 */
describe('Billing/Webhook-API (#2301 — ein Beleg je Abbuchung)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const post = (eventId: string, eventType: string, resource: Record<string, unknown>): Promise<Response> =>
		rawPost('/webhooks/paypal', JSON.stringify({ id: eventId, event_type: eventType, resource }), {
			'paypal-transmission-sig': 'ok',
		});

	it('AK3: späte Abbuchung (Sale B) auf gekündigtem Abo mit Periodenrechnung (Sale A) → eigene Rechnung B; Erstattung von B → Gutschrift zu B', async () => {
		const warnSpy = mock.method(console, 'warn', () => {});
		try {
			server = await startTestServer({
				paypalVerifier: async () => 'verified',
				mailSender: async () => {},
				paypalClient: { cancel: async () => {} } as unknown as PaypalClient,
			} as unknown as AppDeps);
			const sub = await Subscription.create({
				userId: 101,
				provider: 'paypal',
				externalSubscriptionId: 'I-2301-AK3',
				plan: 'plus',
				period: 'monthly',
				status: 'active',
				currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
			});
			const subId = sub.get('id') as number;
			const sale = (id: string) => ({
				id,
				billing_agreement_id: 'I-2301-AK3',
				amount: { total: '8.99', currency: 'EUR' },
			});

			await post('WH-2301-A', 'PAYMENT.SALE.COMPLETED', sale('PAYID-2301-A'));
			await sub.reload();
			await sub.update({ status: 'cancelled' });
			await post('WH-2301-B', 'PAYMENT.SALE.COMPLETED', sale('PAYID-2301-B'));

			const invoices = await Invoice.findAll({ where: { subscriptionId: subId } });
			assert.equal(invoices.length, 2, 'Jede Abbuchung hat genau einen Beleg');
			const invoiceB = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2301-B');
			assert.ok(invoiceB, 'Die späte Abbuchung trägt ihre Sale-ID auf einer eigenen Rechnung');

			await post('WH-2301-REFUND', 'PAYMENT.SALE.REFUNDED', {
				id: 'REFUND-2301',
				sale_id: 'PAYID-2301-B',
				billing_agreement_id: 'I-2301-AK3',
			});

			const all = await Invoice.findAll({ where: { subscriptionId: subId } });
			const creditNote = all.find((invoice) => /^GS-\d{4}-\d{6}$/.test(String(invoice.get('number'))));
			assert.ok(creditNote, 'Die Erstattung erzeugt eine Gutschrift');
			const raw = creditNote.get({ plain: true }) as unknown as Record<string, unknown>;
			assert.equal(raw.creditForInvoiceId, invoiceB.get('id'), 'Die Gutschrift verweist auf Rechnung B');
		} finally {
			warnSpy.mock.restore();
		}
	});
});
