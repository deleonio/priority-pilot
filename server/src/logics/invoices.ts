import { Op } from 'sequelize';
import Invoice from '../models/invoice.js';
import InvoiceSequence from '../models/invoiceSequence.js';
import type Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { getPlansCatalog, type Plan } from './plans.js';
import { sendMailToUser, type MailSender } from './mail.js';
import { buildInvoicePdf } from './invoicePdf.js';
import { OPERATOR } from './operator.js';

/**
 * Rechnungsstellung (Issue #1495 AK8). Erzeugt je Abrechnungszeitraum genau eine Rechnung mit
 * fortlaufender Nummer und stellt sie dem Nutzer zu. **Kein Steuerausweis**: als Kleinunternehmer
 * nach §19 UStG wird keine Umsatzsteuer erhoben (ADR 0013) — die Rechnung trägt stattdessen den
 * festen Hinweistext {@link TAX_NOTE}.
 */

/** Fester Hinweis statt Steuerausweis (§19 UStG, Kleinunternehmerregelung). */
const TAX_NOTE = 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.';

/** Monate je Abrechnungszeitraum — Grundlage für den Rechnungszeitraum (`periodStart`). */
const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Deutsche Anzeige der Abrechnungszeiträume (#2031) — Katalog-Schlüssel bleiben englisch. */
const PERIOD_DISPLAY: Record<string, string> = {
	monthly: 'monatlich',
	quarterly: 'vierteljährlich',
	yearly: 'jährlich',
};

/** Anzeigename „Plus (monatlich)“: Paket großgeschrieben, Zeitraum deutsch (#2031). */
const displayLabel = (plan: Plan, period: string): string =>
	`${plan.charAt(0).toUpperCase()}${plan.slice(1)} (${PERIOD_DISPLAY[period] ?? period})`;

/**
 * Nächste Rechnungsnummer im Format `INV-<Jahr>-<6-stellig>`, lückenlos aufsteigend je
 * Kalenderjahr und eindeutig auch bei parallelen Aufrufen.
 *
 * Die Nummer entsteht aus einer reservierten Zeile in `invoice_sequences`: Der INSERT ist atomar,
 * die laufende Nummer ist die Anzahl der Reservierungen desselben Jahres bis einschließlich der
 * eigenen ID. Bewusst KEIN `count() + 1` und keine Transaktion — beides vergibt unter parallelen
 * Aufrufen dieselbe Nummer bzw. bricht auf der In-Memory-SQLite-Verbindung (`pool.max = 1`) ab.
 */
export const nextInvoiceNumber = async (now: Date): Promise<string> => {
	const year = now.getUTCFullYear();
	const reservation = await InvoiceSequence.create({ year });
	const ordinal = await InvoiceSequence.count({
		where: { year, id: { [Op.lte]: reservation.get('id') as number } },
	});
	return `INV-${year}-${String(ordinal).padStart(6, '0')}`;
};

/**
 * Stellt eine bereits angelegte Rechnung per Mail zu und setzt bei Erfolg `deliveredAt` (#2030).
 * Nutzt die gespeicherten `pdfBytes` — das PDF wird nie neu gebaut, Nummer und Anhang bleiben
 * byte-identisch. Ohne gespeichertes PDF oder Empfänger passiert nichts.
 */
const deliverInvoice = async (
	invoice: Invoice,
	user: User | null,
	label: string,
	now: Date,
	mailSend?: MailSender,
): Promise<void> => {
	const pdf = invoice.get('pdfBytes') as Uint8Array | null | undefined;
	if (!user || !pdf) {
		return;
	}
	const number = invoice.get('number') as string;
	const periodStart = invoice.get('periodStart') as Date;
	const periodEnd = invoice.get('periodEnd') as Date;
	const lineItems = invoice.get('lineItems') as { label: string; amountCents: number }[];
	const amountCents = invoice.get('amountCents') as number;
	const sent = await sendMailToUser(
		user,
		{
			subject: `Ihre Rechnung ${number}`,
			text: [
				`Rechnung ${number}`,
				`Zeitraum: ${periodStart.toISOString().slice(0, 10)} bis ${periodEnd.toISOString().slice(0, 10)}`,
				`Paket: ${label}`,
				...lineItems.map((item) => `${item.label}: ${(item.amountCents / 100).toFixed(2)} EUR`),
				`Betrag: ${(amountCents / 100).toFixed(2)} EUR`,
				TAX_NOTE,
			].join('\n'),
			attachments: [{ filename: `${number}.pdf`, contentType: 'application/pdf', content: pdf }],
		},
		mailSend,
	);
	if (sent) {
		await invoice.update({ deliveredAt: now });
	}
};

/**
 * Stellt die Rechnung für den laufenden Abrechnungszeitraum des Abos aus und schickt sie dem
 * Nutzer per Mail. Idempotent je Zeitraum: existiert bereits eine Rechnung mit demselben
 * `subscriptionId` + `periodEnd`, wird keine zweite angelegt (ein wiederholter Hintergrundlauf
 * erzeugt keine zweite Rechnung). Ist deren Mail noch nicht zugestellt (`deliveredAt` leer),
 * wird sie erneut versendet; ebenso alle älteren unzugestellten Rechnungen desselben Abos (#2030).
 *
 * @param mailSend injizierbarer Versand (Default: `sendMailToUser`s nodemailer-Transport).
 */
export const issueInvoiceForPeriod = async (
	subscription: Subscription,
	now: Date,
	mailSend?: MailSender,
): Promise<Invoice> => {
	const subscriptionId = subscription.get('id') as number;
	const periodEnd = subscription.get('currentPeriodEnd') as Date;
	const period = String(subscription.get('period'));
	const plan = String(subscription.get('plan')) as Plan;

	const label = displayLabel(plan, period);
	const user = await User.findByPk(subscription.get('userId') as number);
	// #2030: Nachholversand unzugestellter Rechnungen (Mailfehler schluckt `sendMailToUser`).
	const redeliverPending = async (exceptId?: number): Promise<void> => {
		const pending = await Invoice.findAll({
			where: { subscriptionId, deliveredAt: null, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) },
			order: [['periodEnd', 'ASC']],
		});
		for (const old of pending) {
			await deliverInvoice(old, user, label, now, mailSend);
		}
	};

	const existing = await Invoice.findOne({ where: { subscriptionId, periodEnd } });
	if (existing) {
		await redeliverPending();
		return existing.reload();
	}

	const periodStart = new Date(periodEnd);
	periodStart.setUTCMonth(periodStart.getUTCMonth() - (PERIOD_MONTHS[period] ?? 1));

	const prices = getPlansCatalog().prices[plan];
	const priceCents = prices ? prices[period as keyof typeof prices] : 0;
	// #1912: Guthaben aus einem Upgrade wird einmalig als eigene Position verrechnet.
	const creditCents = Math.min(Number(subscription.get('creditCents') ?? 0), priceCents);
	const lineItems =
		creditCents > 0
			? [
					{ label: `Paket ${label}`, amountCents: priceCents },
					{ label: 'Verrechnung Restlaufzeit', amountCents: -creditCents },
				]
			: [];
	const amountCents = priceCents - creditCents;

	const invoice = await Invoice.create({
		userId: subscription.get('userId') as number,
		subscriptionId,
		number: await nextInvoiceNumber(now),
		periodStart,
		periodEnd,
		amountCents,
		taxNote: TAX_NOTE,
		lineItems,
	});

	// PDF zum Erzeugungszeitpunkt bauen und speichern (#1955 AK3) — Anhang und späterer Download
	// teilen dieselben Bytes (byte-identisch). Wirft der Bau, bleibt keine halbe Rechnung stehen:
	// Der Idempotenz-Guard oben liefert sonst bei jedem Retry die unvollständige Rechnung ohne
	// PDF — also zerstören und hochreichen, der Retry erzeugt sie komplett neu (inkl. Guthaben,
	// das erst nach gelungenem PDF-Bau verrechnet wird).
	let pdfBytes: Uint8Array;
	try {
		pdfBytes = await buildInvoicePdf(
			invoice,
			OPERATOR,
			{
				displayName: String(user?.get('displayName') ?? ''),
				email: String(user?.get('email') ?? ''),
			},
			`Paket ${label}`,
		);
	} catch (error) {
		await invoice.destroy();
		throw error;
	}
	await invoice.update({ pdfBytes: Buffer.from(pdfBytes) });
	if (creditCents > 0) {
		await subscription.update({ creditCents: 0 });
	}
	await deliverInvoice(invoice, user, label, now, mailSend);
	await redeliverPending(invoice.get('id') as number);

	return invoice;
};
