import { Op, type Transaction } from 'sequelize';
import sequelize from '../database.js';
import Invoice from '../models/invoice.js';
import InvoiceSequence from '../models/invoiceSequence.js';
import CreditSequence from '../models/creditSequence.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { getPlansCatalog, type Plan } from './plans.js';
import { sendMailToUser, type MailSender } from './mail.js';
import { buildInvoicePdf, contractConfirmationLines } from './invoicePdf.js';
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

const PERIOD_DISPLAY_EN: Record<string, string> = { monthly: 'monthly', quarterly: 'quarterly', yearly: 'yearly' };

/** Feste Wörter der gespeicherten (deutschen) Paket- und Positionstexte → Englisch für die Rechnungsmail. */
const LABEL_WORDS_EN: [RegExp, string][] = [
	[/^Gutschrift zu Rechnung /, 'Credit note for invoice '],
	[/^Paket /, 'Plan '],
	[/^Abbuchung /, 'Charge '],
	[/^Verrechnung Restlaufzeit$/, 'Credit for the remaining term'],
	[/^Abweichung vom Paketpreis$/, 'Difference from the plan price'],
];

/** Englische Fassung eines gespeicherten Labels (`Paket Plus (monatlich)` → `Plan Plus (monthly)`). */
const PERIOD_LABEL_EN = (label: string): string =>
	Object.entries(PERIOD_DISPLAY).reduce(
		(text, [key, de]) => text.replace(`(${de})`, `(${PERIOD_DISPLAY_EN[key]})`),
		LABEL_WORDS_EN.reduce((text, [de, en]) => text.replace(de, en), label),
	);

/** Anzeigename „Plus (monatlich)“: Paket großgeschrieben, Zeitraum deutsch (#2031). */
export const displayLabel = (plan: Plan, period: string, sprache: CareSprache = 'de'): string =>
	`${plan.charAt(0).toUpperCase()}${plan.slice(1)} (${(sprache === 'en' ? PERIOD_DISPLAY_EN : PERIOD_DISPLAY)[period] ?? period})`;

/** Tatsächlich abgebuchter Betrag aus dem Zahlungsereignis (#2232). */
export interface ChargedAmount {
	amountCents: number;
	currency: string;
}

/**
 * Nächste Rechnungsnummer im Format `INV-<Jahr>-<6-stellig>`, lückenlos aufsteigend je
 * Kalenderjahr und eindeutig auch bei parallelen Aufrufen.
 *
 * Die Nummer entsteht aus einer reservierten Zeile in `invoice_sequences`: Der INSERT ist atomar,
 * die laufende Nummer ist die Anzahl der Reservierungen desselben Jahres bis einschließlich der
 * eigenen ID. Bewusst KEIN `count() + 1` und keine eigene Transaktion — beides vergibt unter parallelen
 * Aufrufen dieselbe Nummer bzw. bricht auf der In-Memory-SQLite-Verbindung (`pool.max = 1`) ab.
 * Läuft sie in der Transaktion der Rechnung (#2233), verbraucht ein Rollback keine Nummer.
 */
export const nextInvoiceNumber = async (now: Date, transaction?: Transaction): Promise<string> => {
	const year = now.getUTCFullYear();
	const reservation = await InvoiceSequence.create({ year }, { transaction });
	const ordinal = await InvoiceSequence.count({
		where: { year, id: { [Op.lte]: reservation.get('id') as number } },
		transaction,
	});
	return `INV-${year}-${String(ordinal).padStart(6, '0')}`;
};

/**
 * Nächste Gutschriftnummer im Format `GS-<Jahr>-<6-stellig>` (#2237) — eigener Kreis neben den
 * Rechnungsnummern, atomar über INSERTs in `credit_sequences` (Muster {@link nextInvoiceNumber};
 * In-Memory-SQLite `pool.max = 1`: nie `count() + 1`). Bewusst nicht exportiert: nur
 * {@link issueCreditNote} reserviert Nummern.
 */
const nextCreditNoteNumber = async (now: Date, transaction?: Transaction): Promise<string> => {
	const year = now.getUTCFullYear();
	const reservation = await CreditSequence.create({ year }, { transaction });
	const ordinal = await CreditSequence.count({
		where: { year, id: { [Op.lte]: reservation.get('id') as number } },
		transaction,
	});
	return `GS-${year}-${String(ordinal).padStart(6, '0')}`;
};

/**
 * Stellt eine Gutschrift zur Originalrechnung aus (#2237): eigene Zeile in `invoices` mit eigener
 * Nummer, dem negativen Originalbetrag und dem Bezug aufs Original (`creditForInvoiceId`) — das
 * Original selbst bleibt unverändert (`paymentStatus 'paid'`). Läuft in der Transaktion des
 * Paketentzugs (#2233-Muster): wirft sie, bleibt auch das Abo unverändert und die Wiederholung des
 * Ereignisses erzeugt genau eine Gutschrift (die Nummernreservierung rollt mit zurück).
 *
 * Das PDF entsteht in derselben Transaktion und wird gespeichert (#2303); wirft der Bau, rollt alles
 * zurück. Die Mail folgt erst nach dem Commit, ein Fehlversand holt `redeliverPending` nach (#2030).
 * Kein eigenes `BEGIN`: die Transaktion des Aufrufers wird durchgereicht.
 *
 * @param mailSend injizierbarer Versand (Default: `sendMailToUser`s nodemailer-Transport).
 * @param pdfBuild injizierbarer PDF-Bau (Default: `buildInvoicePdf`) — Test-Seam wie `mailSend`.
 */
export const issueCreditNote = async (
	original: Invoice,
	now: Date,
	transaction?: Transaction,
	mailSend?: MailSender,
	pdfBuild: typeof buildInvoicePdf = buildInvoicePdf,
): Promise<Invoice> => {
	const amountCents = -(original.get('amountCents') as number);
	const credit = await Invoice.create(
		{
			userId: original.get('userId') as number,
			subscriptionId: original.get('subscriptionId') as number,
			number: await nextCreditNoteNumber(now, transaction),
			periodStart: original.get('periodStart') as Date,
			periodEnd: original.get('periodEnd') as Date,
			amountCents,
			currency: original.get('currency') as string,
			taxNote: TAX_NOTE,
			lineItems: [{ label: `Gutschrift zu Rechnung ${original.get('number')}`, amountCents }],
			paymentStatus: 'refunded',
			// Kein `saleId`: die Gutschrift darf nie Ziel künftiger Sale-Lookups sein (sonst
			// „Gutschrift auf Gutschrift" bei einem zweiten Ereignis derselben Sale).
			creditForInvoiceId: original.get('id') as number,
		},
		{ transaction },
	);
	const user = await User.findByPk(original.get('userId') as number, { transaction });
	const pdfBytes = await pdfBuild(
		credit,
		OPERATOR,
		{ displayName: String(user?.get('displayName') ?? ''), email: String(user?.get('email') ?? '') },
		`Zur Rechnung ${original.get('number')}`,
	);
	await credit.update({ pdfBytes: Buffer.from(pdfBytes) }, { transaction });
	const deliver = (): Promise<void> => deliverInvoice(credit, user, '', now, mailSend);
	await (transaction ? transaction.afterCommit(deliver) : deliver());
	return credit;
};

/**
 * Vertragsbestätigung (#2329, § 312f BGB) — nur für die erste Nicht-Gutschrift-Rechnung (frühester
 * `periodEnd`) eines Abos mit gespeicherter Zustimmung; sonst leer. Gemeinsame Quelle für PDF-Erstbau
 * und Mail (auch Nachholversand).
 */
const confirmationFor = async (
	invoice: Invoice,
	transaction?: Transaction,
	sprache: CareSprache = 'de',
): Promise<string[]> => {
	if (invoice.get('creditForInvoiceId') != null) {
		return [];
	}
	const subscriptionId = invoice.get('subscriptionId') as number;
	const subscription = await Subscription.findByPk(subscriptionId, { transaction });
	const consentAt = subscription?.get('withdrawalConsentAt') as Date | null | undefined;
	if (!subscription || !consentAt) {
		return [];
	}
	const first = await Invoice.findOne({
		where: { subscriptionId, creditForInvoiceId: null },
		order: [
			['periodEnd', 'ASC'],
			['id', 'ASC'],
		],
		transaction,
	});
	if (first?.get('id') !== invoice.get('id')) {
		return [];
	}
	const plan = String(subscription.get('plan')) as Plan;
	const period = String(subscription.get('period'));
	const prices = getPlansCatalog().prices[plan];
	const priceCents = prices ? prices[period as keyof typeof prices] : 0;
	return contractConfirmationLines(displayLabel(plan, period, sprache), priceCents, consentAt, sprache);
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
	const currency = invoice.get('currency') as string;
	// Gutschrift (#2303): eigener Betreff/Text; der Bezug aufs Original steht in der Position.
	const isCredit = invoice.get('creditForInvoiceId') != null;
	const kind = isCredit ? 'Gutschrift' : 'Rechnung';
	const sprache = spracheVon(user.get('sprache') as string | null);
	const confirmation = await confirmationFor(invoice, undefined, sprache);
	const amount = (cents: number): string => `${(cents / 100).toFixed(2)} ${currency}`;
	const sent = await sendMailToUser(
		user,
		{
			// Englisch nur die Mail; das PDF bleibt der deutsche Beleg (gespeicherte Bytes).
			subject: sprache === 'en' ? `Your ${isCredit ? 'credit note' : 'invoice'} ${number}` : `Ihre ${kind} ${number}`,
			text: (sprache === 'en'
				? [
						`${isCredit ? 'Credit note' : 'Invoice'} ${number}`,
						`Period: ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`,
						...(isCredit ? [] : [`Plan: ${PERIOD_LABEL_EN(label)}`]),
						...lineItems.map((item) => `${PERIOD_LABEL_EN(item.label)}: ${amount(item.amountCents)}`),
						`Amount: ${amount(amountCents)}`,
						'No VAT is charged under section 19 of the German VAT Act (UStG).',
						'The attached PDF is issued in German.',
						...(confirmation.length > 0 ? ['', ...confirmation] : []),
					]
				: [
						`${kind} ${number}`,
						`Zeitraum: ${periodStart.toISOString().slice(0, 10)} bis ${periodEnd.toISOString().slice(0, 10)}`,
						...(isCredit ? [] : [`Paket: ${label}`]),
						...lineItems.map((item) => `${item.label}: ${(item.amountCents / 100).toFixed(2)} ${currency}`),
						`Betrag: ${(amountCents / 100).toFixed(2)} ${currency}`,
						TAX_NOTE,
						...(confirmation.length > 0 ? ['', ...confirmation] : []),
					]
			).join('\n'),
			attachments: [{ filename: `${number}.pdf`, contentType: 'application/pdf', content: pdf }],
		},
		mailSend,
	);
	if (sent) {
		await invoice.update({ deliveredAt: now });
	}
};

/**
 * Serialisiert transaktionslose Erzeugungsläufe (#2236): SQLite fährt mit EINER Verbindung
 * (`pool.max = 1`) — überlappende Transaktionen überlagern sich auf derselben Verbindung
 * („cannot start a transaction within a transaction“). Der nächste Lauf startet erst nach
 * Commit bzw. Rollback des vorherigen; Aufrufe mit eigener äußerer Transaktion (#2233)
 * durchlaufen die Warteschlange nicht.
 */
let creationQueue: Promise<unknown> = Promise.resolve();
const enqueueCreation = <T>(run: () => Promise<T>): Promise<T> => {
	const result = creationQueue.then(run, run);
	creationQueue = result.catch(() => undefined);
	return result;
};

/**
 * Stellt die Rechnung für den laufenden Abrechnungszeitraum des Abos aus und schickt sie dem
 * Nutzer per Mail. Idempotent je Abbuchung (#2301): mit `saleId` existiert höchstens eine Rechnung je
 * Sale-ID, ohne `saleId` je `subscriptionId` + `periodEnd` (ein wiederholter Hintergrundlauf
 * erzeugt keine zweite Rechnung). Ist deren Mail noch nicht zugestellt (`deliveredAt` leer),
 * wird sie erneut versendet; ebenso alle älteren unzugestellten Rechnungen desselben Abos (#2030).
 *
 * @param mailSend injizierbarer Versand (Default: `sendMailToUser`s nodemailer-Transport).
 * @param saleId Sale-Referenz des auslösenden Zahlungsereignisses (#2086) — Anker für spätere Erstattungen.
 * @param charged abgebuchter Betrag und Währung (#2232); ohne gilt der Katalogpreis in EUR.
 * @param transaction Transaktion des Zahlungsereignisses (#2233); der Mailversand folgt erst nach dem Commit.
 *  Ohne sie läuft der Erzeugungsblock in einer eigenen Transaktion (#2236).
 * @param pdfBuild injizierbarer PDF-Bau (Default: `buildInvoicePdf`) — Test-Seam wie `mailSend` (#2236).
 */
export const issueInvoiceForPeriod = async (
	subscription: Subscription,
	now: Date,
	mailSend?: MailSender,
	saleId?: string | null,
	charged?: ChargedAmount,
	transaction?: Transaction,
	pdfBuild: typeof buildInvoicePdf = buildInvoicePdf,
): Promise<Invoice> => {
	const subscriptionId = subscription.get('id') as number;
	const periodEnd = subscription.get('currentPeriodEnd') as Date;
	const period = String(subscription.get('period'));
	const plan = String(subscription.get('plan')) as Plan;
	const prices = getPlansCatalog().prices[plan];
	const priceCents = prices ? prices[period as keyof typeof prices] : 0;

	// #2232: ein abgelöstes Abo (#1912) steht auf `free` — eine Abbuchung darauf ist kein „Free“-Beleg.
	const label =
		charged && priceCents === 0 ? `Abbuchung (${PERIOD_DISPLAY[period] ?? period})` : displayLabel(plan, period);
	const user = await User.findByPk(subscription.get('userId') as number, { transaction });
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
	// Mail nie aus einer Transaktion heraus, die noch zurückrollen kann (#2233).
	const afterCommit = async (deliver: () => Promise<void>): Promise<void> =>
		transaction ? transaction.afterCommit(deliver) : deliver();

	// #2301: ein Beleg je Abbuchung — mit Sale-ID zählt die Sale-ID, sonst die Periode. Eine
	// Periodenrechnung ohne Sale-ID wird übernommen (Sale-ID nachgetragen), eine mit anderer nicht.
	// Gutschriften übernehmen `periodEnd` und sind nie „vorhandene Rechnung“.
	const findExisting = async (): Promise<Invoice | null> => {
		if (!saleId) {
			return Invoice.findOne({ where: { subscriptionId, periodEnd, creditForInvoiceId: null }, transaction });
		}
		const bySale = await Invoice.findOne({
			where: { subscriptionId, saleId, creditForInvoiceId: null },
			transaction,
		});
		if (bySale) {
			return bySale;
		}
		const byPeriod = await Invoice.findOne({
			where: { subscriptionId, periodEnd, saleId: null, creditForInvoiceId: null },
			transaction,
		});
		await byPeriod?.update({ saleId }, { transaction });
		return byPeriod;
	};
	const existing = await findExisting();
	if (existing) {
		await afterCommit(() => redeliverPending());
		return existing.reload({ transaction });
	}

	// #2236: Nummern-Reservierung, Rechnung und PDF-Bau sind ein atomarer Schritt. Ohne äußere
	// Transaktion (#2233) läuft der Erzeugungsblock in einer eigenen — wirft der PDF-Bau, rollt
	// sie zurück und verbrennt weder Rechnung noch Nummer. Schachteln ist verboten: die
	// In-Memory-SQLite (`pool.max = 1`) bricht bei verschachtelten Transaktionen ab.
	const createInvoice = async (tx?: Transaction): Promise<Invoice> => {
		const periodStart = new Date(periodEnd);
		periodStart.setUTCMonth(periodStart.getUTCMonth() - (PERIOD_MONTHS[period] ?? 1));

		// #1912: Guthaben aus einem Upgrade wird einmalig als eigene Position verrechnet.
		const availableCents = Number(subscription.get('creditCents') ?? 0);
		const creditCents = Math.min(availableCents, priceCents);
		// #2232: der abgebuchte Betrag gilt; seine Abweichung zum Katalogpreis wird eigene Position.
		const amountCents = charged ? charged.amountCents : priceCents - creditCents;
		const lineItems =
			priceCents > 0 && amountCents !== priceCents
				? [
						{ label: `Paket ${label}`, amountCents: priceCents },
						{
							label: creditCents > 0 ? 'Verrechnung Restlaufzeit' : 'Abweichung vom Paketpreis',
							amountCents: amountCents - priceCents,
						},
					]
				: [];

		const invoice = await Invoice.create(
			{
				userId: subscription.get('userId') as number,
				subscriptionId,
				number: await nextInvoiceNumber(now, tx),
				periodStart,
				periodEnd,
				amountCents,
				currency: charged?.currency ?? 'EUR',
				taxNote: TAX_NOTE,
				lineItems,
				saleId: saleId ?? null,
			},
			{ transaction: tx },
		);

		// PDF zum Erzeugungszeitpunkt bauen und speichern (#1955 AK3) — Anhang und späterer Download
		// teilen dieselben Bytes (byte-identisch). Wirft der Bau, rollt die umgebende Transaktion
		// zurück — es bleibt weder eine halbe Rechnung noch eine verbrannte Nummer stehen; der
		// Retry erzeugt sie komplett neu (inkl. Guthaben, das erst nach gelungenem PDF-Bau verrechnet wird).
		const pdfBytes = await pdfBuild(
			invoice,
			OPERATOR,
			{
				displayName: String(user?.get('displayName') ?? ''),
				email: String(user?.get('email') ?? ''),
			},
			`Paket ${label}`,
			await confirmationFor(invoice, tx),
		);
		await invoice.update({ pdfBytes: Buffer.from(pdfBytes) }, { transaction: tx });
		if (creditCents > 0) {
			// #2241: nur der verrechnete Betrag wird verbraucht, ein Überschuss bleibt für Folgezyklen.
			await subscription.update({ creditCents: availableCents - creditCents }, { transaction: tx });
		}
		// Mail erst nach dem Commit der umgebenden Transaktion (#2233).
		const deliverAll = async (): Promise<void> => {
			await deliverInvoice(invoice, user, label, now, mailSend);
			await redeliverPending(invoice.get('id') as number);
		};
		await (tx ? tx.afterCommit(deliverAll) : afterCommit(deliverAll));

		return invoice;
	};

	if (transaction) {
		return createInvoice(transaction);
	}
	return enqueueCreation(() => sequelize.transaction(createInvoice));
};
