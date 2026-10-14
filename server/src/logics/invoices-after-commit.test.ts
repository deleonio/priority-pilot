import { describe, it, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { issueCreditNote, issueInvoiceForPeriod } from './invoices.js';
import type { MailSender } from './mail.js';

type MailPayload = Parameters<MailSender>[0];

/**
 * Rote Spec-Tests für #2541 AK1-AK5 (Spec docs/spec/issue-2541.md): Ein Fehler im Versand NACH dem
 * Commit darf den auslösenden Aufruf nicht werfen; Rechnung bleibt gespeichert, `deliveredAt` leer.
 * Der Fehler wird über `Invoice.prototype.update({ deliveredAt })` erzwungen — ein werfender
 * `mailSend` genügt nicht, `sendMailToUser` schluckt ihn. KEIN Produktivcode.
 */

const NOW = new Date('2026-11-02T10:00:00Z');

const setup = async () => {
	const user = await User.create({ email: 'after@example.com', displayName: 'Ada', passwordHash: '__test__' });
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-AC-1',
		plan: 'plus',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
	});
	return { user, subscription };
};

const okSend = async (_payload: MailPayload): Promise<void> => undefined;

describe('invoices.ts — Fehler nach dem Commit (#2541)', () => {
	const logged: string[] = [];
	const originalError = console.error;
	let failDelivery = true;

	beforeEach(async () => {
		await resetDb();
		logged.length = 0;
		failDelivery = true;
		console.error = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
		const realUpdate = Invoice.prototype.update;
		mock.method(Invoice.prototype, 'update', function (this: Invoice, ...args: Parameters<typeof realUpdate>) {
			const values = args[0] as Record<string, unknown> | undefined;
			if (failDelivery && values && 'deliveredAt' in values) {
				return Promise.reject(new Error('db down nach commit'));
			}
			return realUpdate.apply(this, args);
		});
	});
	afterEach(() => {
		console.error = originalError;
		mock.restoreAll();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1/AK4: mit äußerer Transaktion wird der Aufruf erfüllt, Rechnung bleibt, deliveredAt leer, Log mit Nummer', async () => {
		const { subscription } = await setup();

		await assert.doesNotReject(
			sequelize.transaction((transaction) =>
				issueInvoiceForPeriod(subscription, NOW, okSend, null, undefined, transaction),
			),
		);

		const stored = await Invoice.findOne({ where: { subscriptionId: subscription.id } });
		assert.ok(stored, 'Rechnung bleibt gespeichert');
		assert.match(String(stored.get('number')), /^INV-\d{4}-\d{6}$/);
		assert.ok(stored.get('pdfBytes'), 'pdfBytes bleibt gespeichert');
		assert.equal(stored.get('deliveredAt'), null);
		assert.ok(
			logged.some((line) => line.includes(String(stored.get('number')))),
			'console.error enthält die Rechnungsnummer',
		);
	});

	it('AK2/AK4: ohne äußere Transaktion wird der Aufruf erfüllt, Rechnung bleibt, deliveredAt leer, Log mit Nummer', async () => {
		const { subscription } = await setup();

		await assert.doesNotReject(issueInvoiceForPeriod(subscription, NOW, okSend));

		const stored = await Invoice.findOne({ where: { subscriptionId: subscription.id } });
		assert.ok(stored, 'Rechnung bleibt gespeichert');
		assert.equal(stored.get('deliveredAt'), null);
		assert.ok(logged.some((line) => line.includes(String(stored.get('number')))));
	});

	it('AK3/AK4: Gutschrift in Transaktion — Aufruf erfüllt, Gutschrift gespeichert, Log mit GS-Nummer', async () => {
		const { user, subscription } = await setup();
		const original = await Invoice.create({
			userId: user.id,
			subscriptionId: subscription.id,
			number: 'INV-2026-000001',
			periodStart: new Date('2026-11-01T00:00:00Z'),
			periodEnd: new Date('2026-12-01T00:00:00Z'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
			pdfBytes: Buffer.from('%PDF-original'),
			deliveredAt: NOW,
		});
		let creditId = 0;

		await assert.doesNotReject(
			sequelize.transaction(async (transaction) => {
				creditId = (await issueCreditNote(original, NOW, transaction, okSend)).get('id') as number;
			}),
		);

		const credit = await Invoice.findByPk(creditId);
		assert.ok(credit, 'Gutschrift bleibt gespeichert');
		assert.match(String(credit.get('number')), /^GS-\d{4}-\d{6}$/);
		assert.ok(logged.some((line) => line.includes(String(credit.get('number')))));
	});

	it('AK5: ein Folgelauf mit funktionierendem Versand stellt die Rechnung nach', async () => {
		const { subscription } = await setup();
		await assert.doesNotReject(issueInvoiceForPeriod(subscription, NOW, okSend));
		const first = await Invoice.findOne({ where: { subscriptionId: subscription.id } });
		assert.equal(first?.get('deliveredAt'), null);

		failDelivery = false;
		await issueInvoiceForPeriod(subscription, NOW, okSend);

		const after = await Invoice.findOne({ where: { subscriptionId: subscription.id } });
		assert.ok(after?.get('deliveredAt'), 'deliveredAt nach Nachholversand gesetzt');
	});
});
