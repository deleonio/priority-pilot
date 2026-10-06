import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import Invoice from '../models/invoice.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { issueInvoiceForPeriod } from './invoices.js';

/**
 * Rote Spec-Tests für #2301 (Spec docs/spec/issue-2301.md): Idempotenz der Rechnungserzeugung über
 * die Sale-ID statt nur über die Periode. Eigene Datei: andere Invoice-Testdateien schließen die DB in `after()`.
 */

const NOW = new Date('2026-04-01T00:00:00Z');
const PERIOD_END = new Date('2026-05-01T00:00:00Z');
const noMail = async () => {};

describe('Ein Beleg je Abbuchung (#2301)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});
	after(async () => {
		await sequelize.close();
	});

	let seq = 0;
	const makeSub = async () => {
		seq += 1;
		const user = await User.create({ email: `r2301-${seq}@example.com`, displayName: 'U', passwordHash: 'x' });
		return Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: `I-2301-${seq}`,
			plan: 'plus',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: PERIOD_END,
		});
	};
	const countOf = (sub: Subscription) => Invoice.count({ where: { subscriptionId: sub.get('id') as number } });

	it('AK1: zwei Sale-IDs in derselben Periode erzeugen zwei Rechnungen mit je eigener saleId', async () => {
		const sub = await makeSub();
		const a = await issueInvoiceForPeriod(sub, NOW, noMail, 'SALE-A');
		const b = await issueInvoiceForPeriod(sub, NOW, noMail, 'SALE-B');
		assert.notEqual(a.get('id'), b.get('id'));
		assert.equal(a.get('saleId'), 'SALE-A');
		assert.equal(b.get('saleId'), 'SALE-B');
		assert.equal(await countOf(sub), 2);
	});

	it('AK2: dieselbe Sale-ID zweimal erzeugt genau eine Rechnung', async () => {
		const sub = await makeSub();
		const first = await issueInvoiceForPeriod(sub, NOW, noMail, 'SALE-X');
		const second = await issueInvoiceForPeriod(sub, NOW, noMail, 'SALE-X');
		assert.equal(second.get('id'), first.get('id'));
		assert.equal(await countOf(sub), 1);
	});

	it('AK4: ohne saleId bleibt der Aufruf periodenidempotent', async () => {
		const sub = await makeSub();
		const first = await issueInvoiceForPeriod(sub, NOW, noMail);
		const second = await issueInvoiceForPeriod(sub, NOW, noMail);
		assert.equal(second.get('id'), first.get('id'));
		assert.equal(await countOf(sub), 1);
	});
});
