import { Op } from 'sequelize';
import Invoice from '../models/invoice.js';
import Subscription from '../models/subscription.js';
import { issueCreditNote } from './invoices.js';

/**
 * Kündigung ab der zweiten Laufzeit (#2745, § 309 Nr. 9 BGB): ein Quartals-/Jahresabo, das nach der
 * ersten Laufzeit gekündigt wird, endet einen **Kalendermonat** nach Kündigungseingang statt zum
 * Ende der bezahlten Periode — und die bezahlte Zeit danach wird anteilig über PayPal erstattet
 * (Sale-Referenz `Invoice.saleId`, #2086) und per Rechnungskorrektur (`issueCreditNote`, #2237)
 * ausgewiesen. Erste Laufzeit, Monatsabos und Google-Play (Anbieterregeln) bleiben unberührt;
 * die Upgrade-Ablösung (#1912) beginnt als neues Abo wieder bei der ersten Laufzeit.
 * Reine Rechen-/Entscheidungsfunktion mit DB-Lesezugriff — der Anbieteraufruf wird injiziert.
 */

/** Taggenaue Tageszahl — Muster `proration.ts` (`utcDay`). */
const DAY_MS = 24 * 60 * 60 * 1000;
const utcDay = (date: Date): number => Math.floor(date.getTime() / DAY_MS);

/**
 * Gekürztes Vertragsende einer Kündigung (#2745): `cancellationRequestedAt` + 1 Kalendermonat, wenn
 * ein PayPal-Quartals-/Jahresabo bereits in der zweiten Laufzeit läuft (mindestens eine bezahlte
 * Rechnung für eine frühere Periode dieses Abos) und das gekürzte Ende wirklich früher liegt als das
 * Periodenende. Sonst `null` — der Aufrufer behält das bisherige Verhalten (Ende = `currentPeriodEnd`).
 * Ohne `cancellationRequestedAt` (etwa Kündigung direkt bei PayPal) gilt der Prüfzeitpunkt als Eingang.
 */
export const resolveCancellationEnd = async (subscription: Subscription, now: Date): Promise<Date | null> => {
	if (subscription.get('provider') !== 'paypal') {
		return null;
	}
	if (!['quarterly', 'yearly'].includes(String(subscription.get('period')))) {
		return null;
	}
	const currentPeriodEnd = subscription.get('currentPeriodEnd') as Date;
	const requestedAt = (subscription.get('cancellationRequestedAt') as Date | null) ?? now;
	const shortenedEnd = new Date(requestedAt);
	shortenedEnd.setUTCMonth(shortenedEnd.getUTCMonth() + 1);
	if (shortenedEnd >= currentPeriodEnd) {
		return null;
	}
	// Zweite Laufzeit: mindestens eine bezahlte Rechnung für eine frühere Periode (keine Gutschrift).
	const earlier = await Invoice.findOne({
		where: {
			subscriptionId: subscription.get('id') as number,
			paymentStatus: 'paid',
			creditForInvoiceId: null,
			periodEnd: { [Op.lte]: requestedAt },
		},
	});
	return earlier ? shortenedEnd : null;
};

/**
 * Erstattet die bezahlte Zeit nach dem gekürzten Ende (#2745): taggenauer Cent-Betrag der Restlaufzeit
 * (Muster `prorateUpgrade`), PayPal-Refund über die Sale-Referenz der laufenden Periode, danach die
 * Gutschrift zur Originalrechnung. Wirft der Refund, geschieht nichts — der Aufrufer meldet den
 * Fehlschlag, das Vertragsende aus {@link resolveCancellationEnd} greift trotzdem (AK6).
 * Idempotent: die Gutschrift entsteht bereits VOR dem PayPal-Aufruf als persistierte Refund-Absicht;
 * wirft der Refund, wird sie wieder entfernt. Findet der Kulanz-Sweep im Retry eine vorhandene
 * Gutschrift zur laufenden Rechnung, erkennt die Schranke den bereits ausgelösten Refund und
 * erstattet kein zweites Mal.
 *
 * @returns die ausgestellte (oder bereits vorhandene) Gutschrift als `creditNote`, `null` ohne Erstattungsfall.
 */
export const refundRemainingTerm = async ({
	subscription,
	now,
	refund,
}: {
	subscription: Subscription;
	now: Date;
	refund: (saleId: string, amountCents: number) => Promise<void>;
}): Promise<{ creditNote: Invoice | null }> => {
	const end = await resolveCancellationEnd(subscription, now);
	if (!end) {
		return { creditNote: null };
	}
	// Laufende Periode: die neueste bezahlte Rechnung mit Sale-Referenz, deren Zeitraum das Ende überdauert.
	const current = await Invoice.findOne({
		where: {
			subscriptionId: subscription.get('id') as number,
			paymentStatus: 'paid',
			creditForInvoiceId: null,
			saleId: { [Op.ne]: null },
			periodEnd: { [Op.gt]: end },
		},
		order: [['periodEnd', 'DESC']],
	});
	if (!current) {
		return { creditNote: null };
	}
	const existing = await Invoice.findOne({ where: { creditForInvoiceId: current.get('id') as number } });
	if (existing) {
		return { creditNote: existing };
	}
	const periodStart = current.get('periodStart') as Date;
	const periodEnd = current.get('periodEnd') as Date;
	const periodDays = utcDay(periodEnd) - utcDay(periodStart);
	const daysAfterEnd = utcDay(periodEnd) - utcDay(end);
	const amountCents =
		periodDays > 0 ? Math.floor(((current.get('amountCents') as number) * daysAfterEnd) / periodDays) : 0;
	if (amountCents <= 0) {
		return { creditNote: null };
	}
	// Absicht vor dem externen Aufruf persistieren (F2 des Kreuzverhörs): die Gutschrift ist der
	// Merker, an dem die Idempotenz-Schranke (oben) einen bereits ausgelösten Refund im Retry erkennt
	// — sonst erstattete ein Sweep-Retry nach fehlgeschlagener Finalisierung ein zweites Mal. Wirft
	// der Refund, ist die Absicht hinfällig: Gutschrift entfernen, nichts geschieht (AK6).
	const creditNote = await issueCreditNote(current, now, undefined, undefined, undefined, amountCents);
	try {
		await refund(current.get('saleId') as string, amountCents);
	} catch (error) {
		await creditNote.destroy();
		throw error;
	}
	return { creditNote };
};
