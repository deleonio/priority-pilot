import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Subscription, User, WebhookEvent } from '../models/index.js';
import Invoice from '../models/invoice.js';
import type { AppDeps } from './index.js';
import { applyDuePendingPlan, type PaypalVerificationResult } from '../logics/paypal.js';
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
 * `resource.id`), und `PAYMENT.SALE.REFUNDED` setzt genau die zugehörige Rechnung auf
 * `refunded`. Bis zur Impl-Phase trägt das Invoice-Modell weder `paymentStatus` noch `saleId`
 * und der REFUNDED-Zweig ist ein No-op — die Status-Assertion scheitert an `undefined`
 * (legitimer Erst-Zustand). KEIN Produktivcode.
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

	it('AK3: PAYMENT.SALE.REFUNDED setzt genau die Rechnung mit passender sale_id auf refunded, andere bleiben paid', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await createSubscription('I-2086-REF');
		const postCompleted = (saleId: string): Promise<Response> =>
			rawPost(
				'/webhooks/paypal',
				JSON.stringify({
					id: `WH-2086-${saleId}`,
					event_type: 'PAYMENT.SALE.COMPLETED',
					resource: { id: saleId, billing_agreement_id: 'I-2086-REF' },
				}),
				{ 'paypal-transmission-sig': 'ok' },
			);
		// Zwei Perioden: zwei echte Rechnungen (der Rechnungslauf keyed auf subscriptionId + periodEnd).
		await postCompleted('PAYID-2086-OLD');
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2086-REF' } });
		await sub!.update({ currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z') });
		await postCompleted('PAYID-2086-NEW');

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-2086-REFUND',
				event_type: 'PAYMENT.SALE.REFUNDED',
				resource: { id: 'REFUND-2086', sale_id: 'PAYID-2086-OLD', billing_agreement_id: 'I-2086-REF' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const invoices = await Invoice.findAll({ where: { subscriptionId: sub!.get('id') as number } });
		assert.equal(invoices.length, 2, 'Vorbedingung: zwei Rechnungen müssen existieren');
		const oldInvoice = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2086-OLD');
		const newInvoice = invoices.find((invoice) => invoice.get('saleId') === 'PAYID-2086-NEW');
		assert.ok(oldInvoice && newInvoice, 'Beide Rechnungen müssen ihre Sale-Referenz tragen');
		assert.equal(oldInvoice.get('paymentStatus'), 'refunded', 'Genau die betroffene Rechnung wird refunded');
		assert.equal(newInvoice.get('paymentStatus'), 'paid', 'Andere Rechnungen bleiben unberührt');
	});

	it('AK3: PAYMENT.SALE.REFUNDED ohne passende sale_id trifft die neueste Rechnung des Abos (Fallback, Erstattung geht nicht still verloren)', async () => {
		server = await startTestServer(withVerifierAndMail('verified'));
		await createSubscription('I-2086-FB');
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-2086-3',
				event_type: 'PAYMENT.SALE.COMPLETED',
				resource: { id: 'PAYID-2086-FB', billing_agreement_id: 'I-2086-FB' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-2086-REFUND-FB',
				event_type: 'PAYMENT.SALE.REFUNDED',
				// sale_id passt zu keiner Rechnung (Altrechnung vor der Spalte) — Fallback neueste Rechnung.
				resource: { id: 'REFUND-2086-FB', sale_id: 'PAYID-UNBEKANNT', billing_agreement_id: 'I-2086-FB' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-2086-FB' } });
		const invoices = await Invoice.findAll({ where: { subscriptionId: sub?.get('id') as number } });
		assert.equal(invoices.length, 1, 'Vorbedingung: genau eine Rechnung muss existieren');
		assert.equal(
			invoices[0]?.get('paymentStatus'),
			'refunded',
			'Ohne Referenz-Treffer muss der Fallback die neueste Rechnung des Abos treffen',
		);
	});
});
