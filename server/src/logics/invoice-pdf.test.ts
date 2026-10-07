import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../models/index.js';
import Invoice from '../models/invoice.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { pdfContains } from '../test/pdf.js';
import { issueInvoiceForPeriod } from './invoices.js';
// Neues Modul aus Spec docs/spec/issue-1955.md — fehlender Export ist der legitime Erst-Zustand.
import { buildInvoicePdf } from './invoicePdf.js';

/**
 * Rote Spec-Tests für #1955 AK1-AK3 (Spec docs/spec/issue-1955.md): Der Rechnungslauf erzeugt ein
 * PDF, speichert die Bytes an der Rechnung (Blob, AK3) und versendet sie als Anhang der
 * Rechnungsmail (AK1); der Idempotenz-Guard bleibt (kein Doppeltversand). Der PDF-Inhalt (AK2) wird
 * am echten PDF geprüft (`pdfContains`). KEIN Produktivcode.
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

	const pdf = (invoiceRow: Invoice, service = 'Paket plus (monthly)', operator = OPERATOR) =>
		buildInvoicePdf(invoiceRow, operator, RECIPIENT, service);

	it('enthält Nummer, Datum, beide Parteien, Leistung, Zeitraum, Betrag und §19-Hinweis', async () => {
		const bytes = await pdf(await invoice());
		const has = (text: string) => pdfContains(bytes, text);

		assert.ok(has('INV-2026-100001'), 'Rechnungsnummer muss im PDF stehen');
		assert.ok(has('Paket plus (monthly)'), 'Leistungsbeschreibung (Paket/Periode, AK2) muss drinstehen');
		assert.ok(has('Leistungszeitraum: 2026-02-01 bis 2026-03-01'), 'Leistungszeitraum muss als ISO-Datum drinstehen');
		assert.ok(
			has(OPERATOR.name) && has('Weg 1') && has('12345 Ort'),
			'Betreiberangaben (Name, Anschrift) müssen drinstehen',
		);
		assert.ok(has(OPERATOR.email), 'Betreiber-Kontakt muss drinstehen');
		assert.ok(has(RECIPIENT.displayName) && has(RECIPIENT.email), 'Empfänger (Name, E-Mail) muss drinstehen');
		assert.ok(has('7,99 €'), 'Betrag muss in Euro mit Komma drinstehen');
		assert.ok(has(TAX_NOTE), '§19-UStG-Hinweis muss drinstehen');
	});

	it('#2142 AK5: lineItems erscheinen mit Bezeichnung und Betrag, ohne lineItems bleibt das PDF unverändert', async () => {
		const plain = await invoice('INV-2026-100010');
		const withItems = await invoice('INV-2026-100011');
		await withItems.update({
			lineItems: [
				{ label: 'Paket pro (yearly)', amountCents: 9900 },
				{ label: 'Verrechnung Restwert', amountCents: -400 },
			],
		});

		const bytes = await pdf(withItems, 'Paket pro (yearly)');
		assert.ok(pdfContains(bytes, 'Paket pro (yearly)') && pdfContains(bytes, '99,00 €'), 'Paketposition');
		assert.ok(pdfContains(bytes, 'Verrechnung Restwert') && pdfContains(bytes, '-4,00 €'), 'Verrechnungsposition');
		assert.ok(!pdfContains(await pdf(plain), 'Verrechnung'));
	});

	it('ohne ustId keine USt-IdNr.-Zeile, mit ustId erscheint sie', async () => {
		assert.ok(!pdfContains(await pdf(await invoice()), 'USt-IdNr'), 'Ohne ustId darf keine USt-IdNr.-Zeile erscheinen');

		const withId = await pdf(await invoice('INV-2026-100002'), undefined, { ...OPERATOR, ustId: 'DE123456789' });
		assert.ok(pdfContains(withId, 'DE123456789'), 'Bei gesetzter ustId muss die USt-IdNr. im PDF stehen');
	});

	it('Grußzeile trägt den Betreibernamen statt eines festen Personennamens', async () => {
		const bytes = await pdf(await invoice(), undefined, { ...OPERATOR, name: 'Signatur Testname' });
		assert.ok(pdfContains(bytes, 'Signatur Testname'));
		assert.ok(!pdfContains(bytes, 'Martin Oppitz'));
	});

	it('buildInvoicePdf liefert ein echtes PDF (%PDF-Magic)', async () => {
		const bytes = await buildInvoicePdf(await invoice(), OPERATOR, RECIPIENT, 'Paket plus (monthly)');
		assert.ok(bytes.length > 0, 'PDF-Bytes dürfen nicht leer sein');
		assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-', 'PDF muss mit der %PDF-Magic beginnen');
	});

	// #2233 AK1: WinAnsi-only Helvetica wirft bei Kyrillisch/Polnisch/Emoji — Unicode-Schrift gefordert.
	for (const displayName of ['Иван Петров', 'Łukasz Żółć Ślęzak', 'Anna 🎉']) {
		it(`#2233 AK1: buildInvoicePdf baut ein gültiges PDF für „${displayName}"`, async () => {
			const bytes = await buildInvoicePdf(
				await invoice(),
				OPERATOR,
				{ displayName, email: 'x@example.com' },
				'Paket plus (monthly)',
			);
			assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
		});
	}

	// #2303 AK2 (Spec docs/spec/issue-2303.md): Gutschrift-Titel statt „Rechnung“, Bezug aufs Original.
	it('#2303 AK2: Gutschrift trägt Titel „Gutschrift“, Bezug auf die Originalrechnung und kein „Rechnung GS-“', async () => {
		const credit = await Invoice.create({
			userId: 1,
			subscriptionId: 1,
			number: 'GS-2026-000001',
			periodStart: new Date('2026-02-01T00:00:00Z'),
			periodEnd: new Date('2026-03-01T00:00:00Z'),
			amountCents: -799,
			taxNote: TAX_NOTE,
			paymentStatus: 'refunded',
			creditForInvoiceId: 1,
		});

		const bytes = await pdf(credit, 'Zur Rechnung INV-2026-000001');

		assert.ok(pdfContains(bytes, 'Gutschrift GS-2026-000001'), 'Titel ist der Gutschrift-Titel');
		assert.ok(pdfContains(bytes, 'INV-2026-000001'), 'Die Nummer der Originalrechnung muss im PDF stehen');
		assert.ok(!pdfContains(bytes, 'Rechnung GS-'), 'Eine Gutschrift darf nicht als „Rechnung“ betitelt sein');
		assert.ok(pdfContains(bytes, 'Gutschriftdatum'), 'Datumszeile heißt bei Gutschriften „Gutschriftdatum“');
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

	it('#2233 AK2: Nutzer mit kyrillischem Anzeigenamen bekommt eine Rechnung mit gespeicherten pdfBytes', async () => {
		const { user, subscription } = await setup();
		await user.update({ displayName: 'Иван Петров' });

		const invoice = await issueInvoiceForPeriod(subscription, new Date('2026-03-01T10:00:00Z'), async () => {});

		await invoice.reload();
		const stored = (invoice.get({ plain: true }) as { pdfBytes?: Uint8Array }).pdfBytes;
		assert.ok(stored && Buffer.from(stored).subarray(0, 5).toString() === '%PDF-');
	});
});
