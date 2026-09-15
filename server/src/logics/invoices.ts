import { Op } from 'sequelize';
import Invoice from '../models/invoice.js';
import InvoiceSequence from '../models/invoiceSequence.js';
import type Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { getPlansCatalog, type Plan } from './plans.js';
import { sendMailToUser, type MailSender } from './mail.js';

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
 * Stellt die Rechnung für den laufenden Abrechnungszeitraum des Abos aus und schickt sie dem
 * Nutzer per Mail. Idempotent je Zeitraum: existiert bereits eine Rechnung mit demselben
 * `subscriptionId` + `periodEnd`, wird sie unverändert zurückgegeben (ein wiederholter
 * Hintergrundlauf erzeugt keine zweite Rechnung).
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

	const existing = await Invoice.findOne({ where: { subscriptionId, periodEnd } });
	if (existing) {
		return existing;
	}

	const periodStart = new Date(periodEnd);
	periodStart.setUTCMonth(periodStart.getUTCMonth() - (PERIOD_MONTHS[period] ?? 1));

	const prices = getPlansCatalog().prices[plan];
	const amountCents = prices ? prices[period as keyof typeof prices] : 0;

	const invoice = await Invoice.create({
		userId: subscription.get('userId') as number,
		subscriptionId,
		number: await nextInvoiceNumber(now),
		periodStart,
		periodEnd,
		amountCents,
		taxNote: TAX_NOTE,
	});

	const user = await User.findByPk(subscription.get('userId') as number);
	if (user) {
		const number = invoice.get('number') as string;
		const sent = await sendMailToUser(
			user,
			{
				subject: `Ihre Rechnung ${number}`,
				text: [
					`Rechnung ${number}`,
					`Zeitraum: ${periodStart.toISOString().slice(0, 10)} bis ${periodEnd.toISOString().slice(0, 10)}`,
					`Paket: ${plan} (${period})`,
					`Betrag: ${(amountCents / 100).toFixed(2)} EUR`,
					TAX_NOTE,
				].join('\n'),
			},
			mailSend,
		);
		if (sent) {
			await invoice.update({ deliveredAt: now });
		}
	}

	return invoice;
};
