import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { issueCreditNote, issueInvoiceForPeriod } from './invoices.js';
import { buildInvoicePdf } from './invoicePdf.js';
import type { MailSender } from './mail.js';

type MailPayload = Parameters<MailSender>[0];

/**
 * Rote Spec-Tests für #2303 AK1/AK3-AK5 (Spec docs/spec/issue-2303.md): Die Gutschrift bekommt ein
 * gespeichertes PDF, wird nach dem Commit zugestellt und bei Mailfehler nachgeholt. Neue Seams:
 * `issueCreditNote(original, now, transaction?, mailSend?, pdfBuild?)`. KEIN Produktivcode.
 */

const NOW = new Date('2026-11-02T10:00:00Z');

const setup = async () => {
	const user = await User.create({ email: 'gs@example.com', displayName: 'Ada', passwordHash: '__test__' });
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-GS-1',
		plan: 'plus',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
	});
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
	return { user, subscription, original };
};

const recorder = () => {
	const mails: MailPayload[] = [];
	return { mails, send: async (payload: MailPayload) => void mails.push(payload) };
};

const creditRows = () => Invoice.findAll({ where: { paymentStatus: 'refunded' } });

describe('invoices.ts — Gutschrift als PDF (#2303)', () => {
	beforeEach(resetDb);
	after(async () => {
		await closeDb();
	});

	it('AK1: speichert ein echtes PDF an der Gutschrift; der Bau bekommt die Gutschrift und den Bezug aufs Original', async () => {
		const { original } = await setup();
		let seen: { number: unknown; service: string } | undefined;
		const pdfBuild: typeof buildInvoicePdf = async (invoice, operator, recipient, service) => {
			seen = { number: invoice.get('number'), service };
			return buildInvoicePdf(invoice, operator, recipient, service);
		};

		const credit = await issueCreditNote(original, NOW, undefined, recorder().send, pdfBuild);

		const stored = (await credit.reload()).get('pdfBytes') as Uint8Array | null;
		assert.ok(
			stored && Buffer.from(stored).subarray(0, 4).toString() === '%PDF',
			'Gutschrift braucht gespeichertes PDF',
		);
		assert.match(String(seen?.number), /^GS-\d{4}-\d{6}$/);
		assert.ok(seen?.service.includes('INV-2026-000001'), 'Service-Zeile verweist auf die Originalrechnung');
	});

	it('AK3: Mail erst nach dem Commit — genau eine, Anhang byte-identisch zu pdfBytes, Betreff „Gutschrift“, deliveredAt gesetzt', async () => {
		const { original } = await setup();
		const { mails, send } = recorder();
		let creditId = 0;

		await sequelize.transaction(async (transaction) => {
			const credit = await issueCreditNote(original, NOW, transaction, send);
			creditId = credit.get('id') as number;
			assert.equal(mails.length, 0, 'Vor dem Commit darf keine Mail rausgehen');
		});

		assert.equal(mails.length, 1, 'Genau eine Mail nach dem Commit');
		const credit = await Invoice.findByPk(creditId);
		assert.ok(mails[0].subject.includes('Gutschrift') && mails[0].subject.includes(String(credit?.get('number'))));
		const attachment = mails[0].attachments?.[0];
		assert.ok(
			attachment && Buffer.from(attachment.content).equals(Buffer.from(credit?.get('pdfBytes') as Uint8Array)),
			'Anhang = gespeicherte Bytes',
		);
		assert.ok(credit?.get('deliveredAt'), 'deliveredAt nach erfolgreichem Versand');
	});

	it('AK3: rollt die Transaktion zurück, geht keine Mail raus', async () => {
		const { original } = await setup();
		const { mails, send } = recorder();

		await assert.rejects(
			sequelize.transaction(async (transaction) => {
				await issueCreditNote(original, NOW, transaction, send);
				throw new Error('rollback');
			}),
			/rollback/,
		);

		assert.equal(mails.length, 0);
	});

	it('AK4: scheitert der Versand, bleibt deliveredAt leer; redeliverPending stellt genau einmal nach', async () => {
		const { subscription, original } = await setup();
		const credit = await issueCreditNote(original, NOW, undefined, async () => {
			throw new Error('smtp down');
		});
		assert.equal((await credit.reload()).get('deliveredAt'), null, 'Fehlversand lässt deliveredAt leer');

		const { mails, send } = recorder();
		await issueInvoiceForPeriod(subscription, NOW, send);

		assert.equal(mails.length, 1, 'Nur die Gutschrift wird nachgeholt');
		assert.ok(mails[0].subject.includes('Gutschrift'));
		assert.ok((await credit.reload()).get('deliveredAt'), 'danach deliveredAt gesetzt');
	});

	it('AK5: wirft der PDF-Bau, rollt die Transaktion zurück — keine Gutschrift, die GS-Nummer bleibt frei', async () => {
		const { original } = await setup();

		await assert.rejects(
			sequelize.transaction((transaction) =>
				issueCreditNote(original, NOW, transaction, undefined, async () => {
					throw new Error('pdf kaputt');
				}),
			),
			/pdf kaputt/,
		);
		assert.equal((await creditRows()).length, 0, 'Keine Gutschrift-Zeile');

		const credit = await issueCreditNote(original, NOW, undefined, recorder().send);
		assert.match(String(credit.get('number')), /^GS-2026-000001$/, 'Nummer lückenlos, nicht verbrannt');
	});
});
