import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { Subscription, WebhookEvent } from '../models/index.js';
import type { AppDeps } from './index.js';
import type { PaypalVerificationResult } from '../logics/paypal.js';

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
			resource: { id: 'I-DEDUP', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
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
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-UPGRADE-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-UPGRADE', plan_id: 'PAYPAL_PLAN_ID_MAX_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-UPGRADE' } });
		assert.equal(sub?.get('plan'), 'max', 'Ein Upgrade muss sofort wirken');
	});

	it('AK4: ein Downgrade wirkt erst zum currentPeriodEnd, nicht sofort', async () => {
		server = await startTestServer(withVerifier('verified'));
		const periodEnd = new Date('2026-12-01');
		await Subscription.create({
			userId: 3,
			provider: 'paypal',
			externalSubscriptionId: 'I-DOWNGRADE',
			plan: 'max',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: periodEnd,
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-DOWNGRADE-1',
				event_type: 'BILLING.SUBSCRIPTION.UPDATED',
				resource: { id: 'I-DOWNGRADE', plan_id: 'PAYPAL_PLAN_ID_PRO_MONTHLY' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-DOWNGRADE' } });
		assert.equal(sub?.get('plan'), 'max', 'Ein Downgrade darf NICHT sofort wirken');
		assert.equal(sub?.get('pendingPlan'), 'pro', 'Der geplante Downgrade muss vermerkt sein');
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

	it('AK6: eine Kündigung setzt den Plan über das Webhook-Ereignis auf free zurück', async () => {
		server = await startTestServer(withVerifier('verified'));
		await Subscription.create({
			userId: 5,
			provider: 'paypal',
			externalSubscriptionId: 'I-CANCEL',
			plan: 'max',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await rawPost(
			'/webhooks/paypal',
			JSON.stringify({
				id: 'WH-CANCEL-1',
				event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
				resource: { id: 'I-CANCEL' },
			}),
			{ 'paypal-transmission-sig': 'ok' },
		);

		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CANCEL' } });
		assert.equal(sub?.get('plan'), 'free', 'Eine Kündigung muss den Plan zurücksetzen');
		assert.equal(sub?.get('status'), 'cancelled');
	});
});
