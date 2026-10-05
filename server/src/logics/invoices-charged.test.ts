import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { issueInvoiceForPeriod } from './invoices.js';
import { applyPaymentEvent } from './paypal.js';
import { getPlansCatalog } from './plans.js';

/**
 * Rote Spec-Tests für #2232 (Spec docs/spec/issue-2232.md): Die Rechnung trägt Betrag und Währung der
 * tatsächlichen Abbuchung aus `resource.amount`. Eigene Datei: `invoices-issue.test.ts` schließt die DB in `after()`.
 */

type Item = { label: string; amountCents: number };
const NOW = new Date('2026-04-01T00:00:00Z');
const plusMonthly = getPlansCatalog().prices.plus.monthly;
const cents = (n: number) => (n / 100).toFixed(2);

describe('Rechnungsbetrag aus dem Zahlungsereignis (#2232)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});
	after(async () => {
		await sequelize.close();
	});

	let seq = 0;
	const makeSub = async (extra: Record<string, unknown> = {}) => {
		seq += 1;
		const user = await User.create({ email: `r2232-${seq}@example.com`, displayName: 'U', passwordHash: 'x' });
		return Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: `I-2232-${seq}`,
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: NOW,
			...extra,
		});
	};
	const saleEvent = (amount?: { total: string; currency: string }) => ({
		event_type: 'PAYMENT.SALE.COMPLETED',
		resource: { id: `SALE-${seq}`, ...(amount ? { amount } : {}) },
	});
	/** Echte Kette Ereignis → `applyPaymentEvent` → `issueInvoiceForPeriod` (wie `paypalProvider.ts`). */
	const pay = async (sub: Subscription, amount?: { total: string; currency: string }) => {
		const mails: string[] = [];
		const charged: unknown[] = [];
		await applyPaymentEvent(sub, saleEvent(amount), NOW, {
			issueInvoice: (s, n, saleId, c) => {
				charged.push(c);
				return issueInvoiceForPeriod(
					s,
					n,
					async (p) => {
						mails.push(p.text);
					},
					saleId,
					c,
				);
			},
		});
		const invoice = (await (
			await import('../models/invoice.js')
		).default.findOne({
			where: { subscriptionId: sub.get('id') as number },
		}))!;
		return { invoice, mails, charged };
	};
	const sum = (items: Item[]) => items.reduce((s, i) => s + i.amountCents, 0);

	it('AK1: Einrichtungsgebühr 6,50 EUR → Rechnung 650, Abweichung zum Katalogpreis als eigene Position', async () => {
		const { invoice, charged } = await pay(await makeSub(), { total: '6.50', currency: 'EUR' });
		assert.deepEqual(charged, [{ amountCents: 650, currency: 'EUR' }]);
		assert.equal(invoice.get('amountCents'), 650);
		const items = invoice.get('lineItems') as Item[];
		assert.equal(sum(items), 650);
		assert.ok(
			items.some((i) => i.amountCents === 899 && /Pro/.test(i.label)),
			'Paketposition zum Katalogpreis',
		);
		assert.ok(
			items.some((i) => i.amountCents === 650 - 899),
			'Differenzposition',
		);
	});

	it('AK2: fälliger Downgrade Pro→Plus → Rechnung über den Plus-Betrag mit Label Plus', async () => {
		const sub = await makeSub({
			pendingPlan: 'plus',
			pendingPeriod: 'monthly',
			pendingPlanEffectiveAt: new Date('2026-03-31T00:00:00Z'),
		});
		const { invoice, mails } = await pay(sub, { total: cents(plusMonthly), currency: 'EUR' });
		assert.equal(invoice.get('amountCents'), plusMonthly);
		assert.deepEqual(invoice.get('lineItems'), []);
		assert.match(mails[0], /Paket: Plus \(/);
		assert.doesNotMatch(mails[0], /Paket: Pro/);
	});

	it('AK3: Abbuchung auf abgelöstem Abo (cancelled/free) → abgebuchter Betrag, kein 0-€-Beleg „Free“', async () => {
		const sub = await makeSub({ plan: 'free', status: 'cancelled' });
		const { invoice, mails } = await pay(sub, { total: '8.99', currency: 'EUR' });
		assert.equal(invoice.get('amountCents'), 899);
		assert.doesNotMatch(mails[0], /Free/);
		assert.match(mails[0], /Betrag: 8\.99 EUR/);
	});

	it('AK4: Betrag = Katalogpreis → keine Zusatzpositionen, saleId bleibt gespeichert', async () => {
		const { invoice } = await pay(await makeSub(), { total: '8.99', currency: 'EUR' });
		assert.equal(invoice.get('amountCents'), 899);
		assert.deepEqual(invoice.get('lineItems'), []);
		assert.match(String(invoice.get('saleId')), /^SALE-/);
	});

	it('AK5: Ereigniswährung wird gespeichert und statt „EUR“ im Mailtext ausgegeben', async () => {
		const { invoice, mails } = await pay(await makeSub(), { total: '8.99', currency: 'USD' });
		assert.equal(invoice.get('currency'), 'USD');
		assert.match(mails[0], /Betrag: 8\.99 USD/);
		assert.doesNotMatch(mails[0], /EUR/);
	});

	it('AK6: Ereignis ohne resource.amount → Katalogpreis, charged undefined, Währung EUR', async () => {
		const { invoice, charged } = await pay(await makeSub());
		assert.deepEqual(charged, [undefined]);
		assert.equal(invoice.get('amountCents'), 899);
		assert.equal(invoice.get('currency'), 'EUR');
	});
});
