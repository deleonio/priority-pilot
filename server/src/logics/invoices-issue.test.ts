import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import Invoice from '../models/invoice.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { issueInvoiceForPeriod } from './invoices.js';

/**
 * Ergänzung der Impl-Phase zu #1495 AK8: die Spec-Phase hat `issueInvoiceForPeriod` vertraglich
 * festgelegt (`docs/spec/issue-1495.md`), aber nur die Nummernvergabe abgedeckt
 * (`invoices.test.ts`). Hier wird der Rechnungsinhalt geprüft — Betrag aus dem Paketkatalog, KEIN
 * Steuerausweis, §19-Hinweis, angestoßene Zustellung — sowie die Idempotenz je Abrechnungszeitraum.
 * Eigene Datei, weil `invoices.test.ts` die Sequelize-Verbindung in seinem `after()` schließt.
 */

describe('invoices.ts — issueInvoiceForPeriod (#1495 AK8)', () => {
	const now = new Date('2026-04-01T00:00:00Z');

	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('stellt genau eine Rechnung je Zeitraum aus, ohne Steuerausweis, und stößt die Zustellung an', async () => {
		const user = await User.create({ email: 'rechnung@example.com', displayName: 'Rechnung', passwordHash: 'x' });
		const subscription = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: 'I-INVOICE',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
		});
		const sent: { subject: string; text: string }[] = [];

		const invoice = await issueInvoiceForPeriod(subscription, now, async (payload) => {
			sent.push({ subject: payload.subject, text: payload.text });
		});

		assert.equal(invoice.get('amountCents'), 799, 'Betrag kommt aus dem Paketkatalog (plans.ts)');
		assert.match(invoice.get('taxNote') as string, /§19 UStG/);
		assert.ok(!Object.keys(Invoice.getAttributes()).includes('taxRate'), 'Kein Steuersatz — §19 UStG');
		assert.equal(sent.length, 1, 'Die Rechnung muss zugestellt werden');
		assert.match(sent[0].text, /§19 UStG/);
		assert.ok(invoice.get('deliveredAt'), 'Nach erfolgreicher Zustellung ist deliveredAt gesetzt');

		const again = await issueInvoiceForPeriod(subscription, now, async () => {});
		assert.equal(again.get('id'), invoice.get('id'), 'Ein zweiter Lauf erzeugt keine zweite Rechnung');
	});
});
