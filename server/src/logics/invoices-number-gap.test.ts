import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from 'sequelize';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import InvoiceSequence from '../models/invoiceSequence.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { issueInvoiceForPeriod, type ChargedAmount } from './invoices.js';
import type { MailSender } from './mail.js';
import type { buildInvoicePdf } from './invoicePdf.js';

/**
 * #2236 AK1/AK2 (Spec docs/spec/issue-2236.md): ohne äußere Transaktion darf ein
 * fehlgeschlagener PDF-Bau keine `InvoiceSequence`-Reservierung verbrennen — der nächste
 * erfolgreiche Lauf vergibt die niedrigste freie Nummer erneut; parallele Aufrufe liefern
 * weiterhin eindeutige, aufeinanderfolgende Nummern.
 *
 * Test-Seam: injizierbarer PDF-Builder als siebter Parameter (`pdfBuild`, analog `mailSend`) —
 * die Produktions-Signatur ergänzt die Impl-Phase, hier über Cast angesprochen.
 */

type IssueWithPdfBuild = (
	subscription: Subscription,
	now: Date,
	mailSend?: MailSender,
	saleId?: string | null,
	charged?: ChargedAmount,
	transaction?: Transaction,
	pdfBuild?: typeof buildInvoicePdf,
) => Promise<Invoice>;

const issue = issueInvoiceForPeriod as unknown as IssueWithPdfBuild;

const PERIOD_END = new Date('2026-12-01T00:00:00Z');
const NOW = new Date('2026-11-15T00:00:00Z');

const seed = async (email: string, ext: string) => {
	const user = await User.create({ email, displayName: 'U', passwordHash: 'x' });
	return Subscription.create({
		userId: user.get('id') as number,
		provider: 'paypal',
		externalSubscriptionId: ext,
		plan: 'pro',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: PERIOD_END,
	});
};

describe('issueInvoiceForPeriod — Nummernvergabe ohne äußere Transaktion (#2236)', () => {
	beforeEach(resetDb);
	after(closeDb);

	it('AK1: PDF-Bau scheitert → keine Reservierung; nächster Lauf vergibt INV-<Jahr>-000001 erneut', async () => {
		const subscription = await seed('gap@example.com', 'I-GAP');
		const pdfBuild: typeof buildInvoicePdf = async () => {
			throw new Error('PDF-Bau fehlgeschlagen');
		};

		await assert.rejects(issue(subscription, NOW, async () => {}, undefined, undefined, undefined, pdfBuild));
		assert.equal(await Invoice.count(), 0, 'Keine halbe Rechnung bleibt stehen');
		assert.equal(await InvoiceSequence.count(), 0, 'Keine Nummern-Reservierung bleibt verbrannt');

		const invoice = await issue(subscription, NOW, async () => {});
		assert.equal(
			invoice.get('number'),
			'INV-2026-000001',
			'Die erste ausgestellte Rechnung trägt die niedrigste freie Nummer',
		);
		assert.equal(await InvoiceSequence.count(), 1, 'Genau die Reservierung der existierenden Rechnung');
	});

	it('AK2: zwei parallele Aufrufe liefern zwei verschiedene, aufeinanderfolgende Nummern', async () => {
		const a = await seed('parallel-a@example.com', 'I-PAR-A');
		const b = await seed('parallel-b@example.com', 'I-PAR-B');

		const [ia, ib] = await Promise.all([issue(a, NOW, async () => {}), issue(b, NOW, async () => {})]);

		const numbers = [String(ia.get('number')), String(ib.get('number'))].sort();
		assert.deepEqual(numbers, ['INV-2026-000001', 'INV-2026-000002'], 'Aufeinanderfolgende, eindeutige Nummern');
	});
});
