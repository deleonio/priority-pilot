import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlanChange } from './paypal.js';
// Neuer Seam (#2745, docs/spec/issue-2745.md) — Modul fehlt noch: legitimer Erst-Zustand Rot.
import { resolveCancellationEnd, refundRemainingTerm } from './cancellationRefund.js';
import { Subscription, User, Invoice } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #2745 (Spec docs/spec/issue-2745.md): Quartals-/Jahresabo ab der zweiten
 * Laufzeit endet einen Kalendermonat nach `cancellationRequestedAt`, anteiliger PayPal-Refund über
 * `Invoice.saleId` plus Gutschrift (`issueCreditNote`). Gegenfälle (erste Laufzeit, Monatsabo,
 * Google-Play) sind bewusst GRÜNE Guards gegen Übererfüllung — ihr Verhalten existiert bereits.
 */

const NOW = new Date('2026-11-15T10:00:00Z');
const MONTH_LATER = new Date('2026-12-15T10:00:00Z');

const cancelledEvent = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED' } as Parameters<typeof applyPlanChange>[1];

/** PayPal-Abo im zweiten Jahr: eine abgelaufene Rechnung (2025/26) + aktuelle (2026/27, mit saleId). */
const secondTermAnnualSub = async () => {
	const user = await User.create({ email: '2745-year2@example.test', passwordHash: 'x', plan: 'plus' });
	const subscription = await Subscription.create({
		userId: user.get('id') as number,
		provider: 'paypal',
		externalSubscriptionId: 'I-2745-Y2',
		plan: 'plus',
		period: 'yearly',
		status: 'active',
		currentPeriodEnd: new Date('2027-06-01T00:00:00Z'),
		cancellationRequestedAt: NOW,
	});
	const subId = subscription.get('id') as number;
	await Invoice.create({
		userId: user.get('id') as number,
		subscriptionId: subId,
		number: 'INV-2025-000001',
		periodStart: new Date('2025-06-01T00:00:00Z'),
		periodEnd: new Date('2026-06-01T00:00:00Z'),
		amountCents: 9900,
		paymentStatus: 'paid',
	});
	const current = await Invoice.create({
		userId: user.get('id') as number,
		subscriptionId: subId,
		number: 'INV-2026-000002',
		periodStart: new Date('2026-06-01T00:00:00Z'),
		periodEnd: new Date('2027-06-01T00:00:00Z'),
		amountCents: 9900,
		paymentStatus: 'paid',
		saleId: 'SALE-2745',
	});
	return { user, subscription, current };
};

describe('#2745 Kündigung ab der zweiten Laufzeit — Ende + Erstattung', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: CANCELLED auf verlängertem Jahresabo setzt Ende auf cancellationRequestedAt + 1 Monat', async () => {
		const { subscription } = await secondTermAnnualSub();
		await applyPlanChange(subscription, cancelledEvent, NOW);

		const reloaded = await Subscription.findByPk(subscription.get('id') as number);
		assert.equal(
			(reloaded?.get('pendingPlanEffectiveAt') as Date)?.toISOString(),
			MONTH_LATER.toISOString(),
			'Vertragsende muss cancellationRequestedAt + 1 Kalendermonat sein, nicht currentPeriodEnd',
		);
	});

	it('AK2: Refund mit Sale-ID der aktuellen Periode und taggenauem Cent-Betrag, Gutschrift zur Originalrechnung', async () => {
		const { subscription, current } = await secondTermAnnualSub();
		const refunds: Array<{ saleId: string; amountCents: number }> = [];
		// Periode 2026-06-01→2027-06-01 (365 d), neues Ende 2026-12-15 → 168 d bezahlt nach Ende:
		// floor(9900 * 168 / 365) = 4556 Cent (Muster prorateUpgrade, utcDay).
		const result = await refundRemainingTerm({
			subscription,
			now: MONTH_LATER,
			refund: async (saleId, amountCents) => {
				refunds.push({ saleId, amountCents });
			},
		});

		assert.deepEqual(refunds, [{ saleId: 'SALE-2745', amountCents: 4556 }]);
		const credit = await Invoice.findOne({ where: { creditForInvoiceId: current.get('id') as number } });
		assert.ok(credit, 'Es wird eine Gutschrift zur Originalrechnung ausgestellt');
		assert.equal(credit.get('amountCents'), -4556);
		assert.equal(result.creditNote.get('id'), credit.get('id'));
	});

	it('AK6: Fehlschlagender PayPal-Refund rejected und wird an den Aufrufer gemeldet (Ende greift trotzdem, Retry #2606)', async () => {
		const { subscription } = await secondTermAnnualSub();
		await assert.rejects(
			refundRemainingTerm({
				subscription,
				now: MONTH_LATER,
				refund: async () => {
					throw new Error('PAYPAL-REFUND-FAILED');
				},
			}),
			/PAYPAL-REFUND-FAILED/,
		);
	});

	it('AK1-Gegenfall AK3: Kündigung in der ersten Laufzeit liefert kein gekürztes Ende (null)', async () => {
		const { subscription } = await secondTermAnnualSub();
		// Erste Laufzeit: nur die aktuelle Rechnung existiert.
		await Invoice.destroy({ where: { number: 'INV-2025-000001' } });
		assert.equal(await resolveCancellationEnd(subscription, NOW), null);
	});

	it('AK4-Gegenfall: Monatsabo und Google-Play liefern kein gekürztes Ende (null)', async () => {
		const { user, subscription } = await secondTermAnnualSub();
		const monthly = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: 'I-2745-M',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
			cancellationRequestedAt: NOW,
		});
		const play = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'google_play',
			externalSubscriptionId: 'GP-2745',
			plan: 'plus',
			period: 'yearly',
			status: 'active',
			currentPeriodEnd: new Date('2027-06-01T00:00:00Z'),
			cancellationRequestedAt: NOW,
		});
		assert.equal(await resolveCancellationEnd(monthly, NOW), null, 'Monatsabo bleibt unverändert');
		assert.equal(await resolveCancellationEnd(play, NOW), null, 'Google-Play folgt Play-Regeln');
		assert.notEqual(await resolveCancellationEnd(subscription, NOW), null, 'Jahresabo ab 2. Laufzeit schon');
	});
});
