import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { issueInvoiceForPeriod } from './invoices.js';
// Neues Modul aus Spec docs/spec/issue-1955.md — fehlender Export ist der legitime Erst-Zustand.
import { buildInvoicePdf, invoicePdfLines } from './invoicePdf.js';

/**
 * Rote Spec-Tests für #1955 AK1-AK3 (Spec docs/spec/issue-1955.md): Der Rechnungslauf erzeugt ein
 * PDF, speichert die Bytes an der Rechnung (Blob, AK3) und versendet sie als Anhang der
 * Rechnungsmail (AK1); der Idempotenz-Guard bleibt (kein Doppeltversand). Der PDF-Inhalt (AK2) wird
 * über `invoicePdfLines` geprüft — die Zeilen, aus denen das PDF gezeichnet wird. KEIN Produktivcode.
 */

const TAX_NOTE = 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.';
const OPERATOR = {
	name: 'Testbetreiber GmbH',
	address: ['Weg 1', '12345 Ort'],
	email: 'rechnung@betreiber.example',
	ustId: '',
};
const RECIPIENT = { displayName: 'Ada Beispiel', email: 'ada@example.com' };

const setup = async () => {
	const user = await User.create({
		email: 'pdf@example.com',
		displayName: 'Ada Beispiel',
		passwordHash: '__test__',
	});
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-PDF-1',
		plan: 'plus',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: new Date('2026-03-01T00:00:00Z'),
	});
	return { user, subscription };
};

describe('invoicePdf.ts — PDF-Inhalt (#1955 AK2)', () => {
	beforeEach(resetDb);
	after(async () => {
		await closeDb();
	});

	const invoice = (number = 'INV-2026-100001') =>
		Invoice.create({
			userId: 1,
			subscriptionId: 1,
			number,
			periodStart: new Date('2026-02-01T00:00:00Z'),
			periodEnd: new Date('2026-03-01T00:00:00Z'),
			amountCents: 799,
			taxNote: TAX_NOTE,
		});

	it('enthält Nummer, Datum, beide Parteien, Leistung, Zeitraum, Betrag und §19-Hinweis', async () => {
		const text = invoicePdfLines(await invoice(), OPERATOR, RECIPIENT, 'Paket plus (monthly)').join('\n');

		assert.ok(text.includes('INV-2026-100001'), 'Rechnungsnummer muss im PDF stehen');
		assert.ok(
			text.includes('Leistung: Paket plus (monthly)'),
			'Leistungsbeschreibung (Paket/Periode, AK2) muss drinstehen',
		);
		assert.ok(
			text.includes('2026-02-01') && text.includes('2026-03-01'),
			'Leistungszeitraum muss als ISO-Datum drinstehen',
		);
		assert.ok(
			text.includes(OPERATOR.name) && text.includes('Weg 1') && text.includes('12345 Ort'),
			'Betreiberangaben (Name, Anschrift) müssen drinstehen',
		);
		assert.ok(text.includes(OPERATOR.email), 'Betreiber-Kontakt muss drinstehen');
		assert.ok(
			text.includes(RECIPIENT.displayName) && text.includes(RECIPIENT.email),
			'Empfänger (Name, E-Mail) muss drinstehen',
		);
		assert.ok(text.includes('7,99'), 'Betrag muss in Euro mit Komma drinstehen');
		assert.ok(text.includes(TAX_NOTE), '§19-UStG-Hinweis muss drinstehen');
	});

	it('ohne ustId keine USt-IdNr.-Zeile, mit ustId erscheint sie', async () => {
		const base = invoicePdfLines(await invoice(), OPERATOR, RECIPIENT, 'Paket plus (monthly)').join('\n');
		assert.ok(!base.includes('USt-IdNr'), 'Ohne ustId darf keine USt-IdNr.-Zeile erscheinen');

		const withId = invoicePdfLines(
			await invoice('INV-2026-100002'),
			{ ...OPERATOR, ustId: 'DE123456789' },
			RECIPIENT,
			'Paket plus (monthly)',
		).join('\n');
		assert.ok(withId.includes('DE123456789'), 'Bei gesetzter ustId muss die USt-IdNr. im PDF stehen');
	});

	it('buildInvoicePdf liefert ein echtes PDF (%PDF-Magic)', async () => {
		const bytes = await buildInvoicePdf(await invoice(), OPERATOR, RECIPIENT, 'Paket plus (monthly)');
		assert.ok(bytes.length > 0, 'PDF-Bytes dürfen nicht leer sein');
		assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-', 'PDF muss mit der %PDF-Magic beginnen');
	});
});

describe('invoices.ts — PDF-Erzeugung und -Aufbewahrung (#1955 AK1/AK3)', () => {
	beforeEach(resetDb);
	after(async () => {
		await closeDb();
	});

	it('AK1/AK3: Zahlungslauf erzeugt PDF, legt es als Blob ab und hängt es an die Rechnungsmail', async () => {
		const { subscription } = await setup();
		const sent: unknown[] = [];

		const invoice = await issueInvoiceForPeriod(subscription, new Date('2026-03-01T10:00:00Z'), async (payload) => {
			sent.push(payload);
		});

		assert.equal(sent.length, 1, 'Der Erstlauf muss genau eine Mail versenden');
		const mail = sent[0] as { attachments?: { filename: string; contentType: string; content: Uint8Array }[] };
		assert.ok(mail.attachments?.length === 1, 'Die Rechnungsmail muss genau einen PDF-Anhang tragen');
		const attachment = mail.attachments[0]!;
		assert.equal(attachment.contentType, 'application/pdf');
		assert.ok(
			attachment.filename.includes(invoice.get('number') as string),
			'Der Anhang muss nach der Rechnungsnummer benannt sein',
		);
		const mailed = Buffer.from(attachment.content);
		assert.ok(mailed.length > 0 && mailed.subarray(0, 5).toString() === '%PDF-', 'Der Anhang muss ein echtes PDF sein');

		await invoice.reload();
		const stored = (invoice.get({ plain: true }) as { pdfBytes?: Uint8Array }).pdfBytes;
		assert.ok(stored, 'Die PDF-Bytes müssen an der Rechnung gespeichert sein (AK3, Aufbewahrung)');
		assert.ok(Buffer.from(stored).equals(mailed), 'Anhang und gespeicherte Bytes müssen byte-identisch sein');
	});

	it('AK1/AK6: Zweitlauf versendet keine zweite Mail', async () => {
		const { subscription } = await setup();
		const sent: unknown[] = [];
		const send = async (payload: unknown): Promise<void> => {
			sent.push(payload);
		};

		const first = await issueInvoiceForPeriod(subscription, new Date('2026-03-01T10:00:00Z'), send);
		const second = await issueInvoiceForPeriod(subscription, new Date('2026-03-01T10:00:00Z'), send);

		assert.equal(sent.length, 1, 'Ein Wiederholungslauf darf keine zweite Mail versenden');
		assert.equal(second.get('id'), first.get('id'), 'Der Zweitlauf muss dieselbe Rechnung zurückgeben');
	});
});
