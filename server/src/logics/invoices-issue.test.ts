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

		assert.equal(invoice.get('amountCents'), 899, 'Betrag kommt aus dem Paketkatalog (plans.ts)');
		assert.match(invoice.get('taxNote') as string, /§19 UStG/);
		assert.ok(!Object.keys(Invoice.getAttributes()).includes('taxRate'), 'Kein Steuersatz — §19 UStG');
		assert.equal(sent.length, 1, 'Die Rechnung muss zugestellt werden');
		assert.match(sent[0].text, /§19 UStG/);
		assert.ok(invoice.get('deliveredAt'), 'Nach erfolgreicher Zustellung ist deliveredAt gesetzt');

		const again = await issueInvoiceForPeriod(subscription, now, async () => {});
		assert.equal(again.get('id'), invoice.get('id'), 'Ein zweiter Lauf erzeugt keine zweite Rechnung');
	});

	// #2030 — Rechnungen mit gescheitertem Mailversand werden in Folgeläufen nachzugestellt.
	const makeSub = async (email: string, ext: string, periodEnd: string) => {
		const user = await User.create({ email, displayName: 'Nachholen', passwordHash: 'x' });
		return Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: ext,
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(periodEnd),
		});
	};
	const failing = async () => {
		throw new Error('SMTP down');
	};
	type Sent = { subject: string; attachments?: { content: unknown }[] };

	it('#2030 AK1: unzugestellte Rechnung wird im Folgelauf erneut versendet (gleiche Nummer, gleiche PDF-Bytes)', async () => {
		const sub = await makeSub('retry@example.com', 'I-RETRY', '2026-04-01T00:00:00Z');
		const first = await issueInvoiceForPeriod(sub, now, failing);
		assert.ok(!first.get('deliveredAt'), 'Nach Mailfehler bleibt deliveredAt leer');
		const pdf = Buffer.from((first.get({ plain: true }) as { pdfBytes: Uint8Array }).pdfBytes);

		const sent: Sent[] = [];
		const second = await issueInvoiceForPeriod(sub, now, async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 1, 'Der Folgelauf muss die Rechnung erneut zustellen');
		assert.match(sent[0].subject, new RegExp(String(first.get('number'))), 'Gleiche Rechnungsnummer');
		assert.ok(Buffer.from(sent[0].attachments![0].content as Uint8Array).equals(pdf), 'PDF-Bytes unverändert');
		assert.equal(second.get('id'), first.get('id'));
		assert.ok(second.get('deliveredAt'), 'deliveredAt nach gelungener Zustellung gesetzt');
		assert.equal(await Invoice.count({ where: { subscriptionId: sub.get('id') as number } }), 1);
	});

	it('#2030 AK1: scheitert der Nachversand erneut, bleibt deliveredAt leer', async () => {
		const sub = await makeSub('retry2@example.com', 'I-RETRY2', '2026-04-01T00:00:00Z');
		await issueInvoiceForPeriod(sub, now, failing);
		const again = await issueInvoiceForPeriod(sub, now, failing);
		assert.ok(!again.get('deliveredAt'));
	});

	it('#2030 AK2: zugestellte Rechnung wird im Folgelauf nicht erneut versendet', async () => {
		const sub = await makeSub('done@example.com', 'I-DONE', '2026-04-01T00:00:00Z');
		await issueInvoiceForPeriod(sub, now, async () => {});
		let calls = 0;
		await issueInvoiceForPeriod(sub, now, async () => {
			calls++;
		});
		assert.equal(calls, 0);
	});

	it('#2030 AK3: Lauf für neuere Periode stellt ältere unzugestellte Rechnungen desselben Abos nach', async () => {
		const sub = await makeSub('older@example.com', 'I-OLDER', '2026-04-01T00:00:00Z');
		const old = await issueInvoiceForPeriod(sub, now, failing);
		await sub.update({ currentPeriodEnd: new Date('2026-05-01T00:00:00Z') });

		const sent: Sent[] = [];
		const next = await issueInvoiceForPeriod(sub, new Date('2026-05-01T00:00:00Z'), async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 2, 'Neue Rechnung plus nachgeholte ältere');
		await old.reload();
		assert.ok(old.get('deliveredAt'), 'Ältere Rechnung ist nachgestellt');
		assert.ok(next.get('deliveredAt'));
		assert.notEqual(old.get('number'), next.get('number'));
	});
});
