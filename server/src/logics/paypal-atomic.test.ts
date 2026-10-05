import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { applyPaymentEvent, type ApplyPaymentEventDeps } from './paypal.js';
import { issueInvoiceForPeriod } from './invoices.js';

/**
 * #2233 AK3/AK4 (Spec docs/spec/issue-2233.md): `PAYMENT.SALE.COMPLETED` wird atomar verarbeitet —
 * scheitert der Rechnungsbau, bleiben Periode, Status, Vormerkungen und `User.plan` unverändert;
 * die Wiederholung verlängert genau einmal und erzeugt genau eine Rechnung.
 */

const PERIOD_END = new Date('2026-12-01T00:00:00Z');
const NOW = new Date('2026-11-15T00:00:00Z');
const sale = { event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'SALE-A', billing_agreement_id: 'I-ATOMIC' } };

const seed = async () => {
	const user = await User.create({ email: 'atomic@example.com', displayName: 'U', passwordHash: 'x', plan: 'free' });
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-ATOMIC',
		plan: 'plus',
		period: 'monthly',
		status: 'past_due',
		firstFailureAt: new Date('2026-11-10T00:00:00Z'),
		pendingPlan: 'pro',
		pendingPeriod: 'yearly',
		pendingPlanEffectiveAt: null,
		currentPeriodEnd: PERIOD_END,
	});
	return { user, subscription };
};

/** Echter Rechnungslauf; reicht jedes weitere Argument (z. B. eine Transaktion) unverändert durch. */
const realIssue: ApplyPaymentEventDeps['issueInvoice'] = (s, n, saleId, charged, ...rest) =>
	(issueInvoiceForPeriod as (...args: unknown[]) => Promise<unknown>)(s, n, async () => {}, saleId, charged, ...rest);

describe('applyPaymentEvent — atomar (#2233 AK3/AK4)', () => {
	beforeEach(resetDb);
	after(closeDb);

	it('AK3: wirft issueInvoice, bleiben Abo, User.plan und Rechnungen unverändert', async () => {
		const { user, subscription } = await seed();

		await assert.rejects(
			applyPaymentEvent(subscription, sale, NOW, {
				issueInvoice: async () => {
					throw new Error('Rechnungsbau fehlgeschlagen');
				},
			}),
		);

		const fresh = (await Subscription.findByPk(subscription.get('id') as number))!;
		assert.equal((fresh.get('currentPeriodEnd') as Date).toISOString(), PERIOD_END.toISOString());
		assert.equal(fresh.get('status'), 'past_due');
		assert.notEqual(fresh.get('firstFailureAt'), null);
		assert.equal(fresh.get('plan'), 'plus');
		assert.equal(fresh.get('pendingPlan'), 'pro');
		assert.equal((await User.findByPk(user.id))?.get('plan'), 'free');
		assert.equal(await Invoice.count(), 0);
	});

	it('AK4: Fehlversuch, dann Wiederholung desselben Ereignisses → genau eine Verlängerung, genau eine Rechnung', async () => {
		const { subscription } = await seed();
		const failing = mock.method(Invoice, 'create', async () => {
			throw new Error('Rechnungsbau fehlgeschlagen');
		});
		try {
			await assert.rejects(applyPaymentEvent(subscription, sale, NOW, { issueInvoice: realIssue }));
		} finally {
			failing.mock.restore();
		}

		const retry = (await Subscription.findByPk(subscription.get('id') as number))!;
		await applyPaymentEvent(retry, sale, NOW, { issueInvoice: realIssue });

		const fresh = (await Subscription.findByPk(subscription.get('id') as number))!;
		const expected = new Date(PERIOD_END);
		expected.setUTCFullYear(expected.getUTCFullYear() + 1); // Vormerkung pro/yearly gilt ab der Abbuchung
		assert.equal((fresh.get('currentPeriodEnd') as Date).toISOString(), expected.toISOString());
		assert.equal(await Invoice.count(), 1);
	});
});
