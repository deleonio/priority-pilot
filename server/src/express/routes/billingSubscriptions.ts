import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op, type Order } from 'sequelize';
import { Subscription, User } from '../../models/index.js';
import { OPEN_SUBSCRIPTION_STATUSES, PAID_FIRST } from '../../models/subscription.js';
import Invoice from '../../models/invoice.js';
import { getUserId } from '../requireAuth.js';
import { sendError, parseId, type ErrorDto } from '../http-error.js';
import { createPaypalProvider, type PaypalProviderDeps } from '../../logics/billing/paypalProvider.js';
import { rankOf } from '../../logics/billing/lifecycle.js';
import { PaypalHttpError, PERIOD_MONTHS } from '../../logics/paypal.js';
import { getPlansCatalog, PLAN_VALUES, type Plan } from '../../logics/plans.js';
import { prorateUpgrade } from '../../logics/proration.js';
import { notifyAdminsOfExtraordinaryCancellation } from '../../logics/cancellationMail.js';
import type { MailSender } from '../../logics/mail.js';
import { EMAIL_RE } from '../../logics/waitlist.js';

/**
 * Abo-Verwaltung für den angemeldeten Nutzer (Issue #1505, T6d): Anlegen, Kündigen, Wechseln und
 * Rechnungsabruf. Anders als der öffentliche `createBillingRouter` (#1495, Webhook + Rückkehr-URL)
 * hängt dieser Router HINTER `app.use(requireAuth)` — jede Route braucht eine Session (AK7).
 *
 * Wirksam wird eine Anlage/ein Wechsel ausschließlich über das verifizierte Webhook-Ereignis
 * (ADR 0013, Präzedenz #1495 AK5/AK6) — die Routen hier lösen nur den PayPal-Aufruf aus und lassen
 * `plan` am Datensatz unverändert.
 */

export interface BillingSubscriptionsDeps {
	/** Injizierbarer Abo-Client — Tests injizieren einen Fake (Muster `paypalVerifier`). */
	paypalClient?: PaypalProviderDeps['client'];
	/** Versand der Betreiber-Mail bei außerordentlicher Kündigung (#2308); Default nodemailer. */
	mailSender?: MailSender;
}

const PAID_PLANS = PLAN_VALUES.filter((plan): plan is Exclude<Plan, 'free'> => plan !== 'free');
const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];

const isPaidPlan = (value: unknown): value is Exclude<Plan, 'free'> =>
	PAID_PLANS.includes(value as Exclude<Plan, 'free'>);
const isPeriod = (value: unknown): value is Period => PERIODS.includes(value as Period);

/**
 * Store-Apps kaufen nie über PayPal (ADR 0016). Zweites Netz gegen falsch verdrahtete Oberflächen,
 * kein Sicherheitsmechanismus: der Header `X-Client-Channel` kommt vom Client.
 */
const rejectStoreChannel = (req: Request, res: Response<ErrorDto>): boolean => {
	if (!['play', 'appstore'].includes(req.get('X-Client-Channel') ?? '')) return false;
	sendError(res, 409, 'In der App ist kein Kauf über PayPal möglich.');
	return true;
};

type ApprovalDto = { approvalUrl: string };
/** `immediate`: wirkt der Wechsel sofort (Upgrade) oder erst zum Periodenende (ADR 0013) — die Oberfläche hat keine eigene Rangfolge. `startsAt` nennt den Startzeitpunkt (#2049). `priceCents` ist der Katalogpreis des Ziels (#2324), `currentPlan`/`currentPeriod` das laufende Paket beim Wechsel zum Periodenende. */
type PreviewDto = {
	priceCents: number;
	creditCents: number;
	dueCents: number;
	immediate: boolean;
	startsAt?: string;
	creditCoversUntil?: string;
	currentPlan?: Plan;
	currentPeriod?: Period;
};
type ReviseDto = { approvalUrl?: string };
export type InvoiceDto = {
	id: number;
	number: string;
	periodStart: string;
	periodEnd: string;
	amountCents: number;
	taxNote: string;
	paymentStatus: string;
};

export const serializeInvoice = (invoice: Invoice): InvoiceDto => ({
	id: invoice.id,
	number: invoice.number,
	periodStart: invoice.periodStart.toISOString(),
	periodEnd: invoice.periodEnd.toISOString(),
	amountCents: invoice.amountCents,
	taxNote: invoice.taxNote,
	paymentStatus: invoice.paymentStatus,
});

// Neben dem laufenden Abo kann ein ausstehendes Upgrade liegen; Kündigung und Wechsel gelten dem laufenden.
const ACTIVE_FIRST: Order = [['status', 'ASC']];

// Gekündigtes Abo mit Restlaufzeit (#2049): gilt wie ein laufendes Abo — Muster des Cancel-Fallbacks.
const findCancelledWithRemaining = (userId: number) =>
	Subscription.findOne({
		where: { userId, status: 'cancelled', currentPeriodEnd: { [Op.gt]: new Date() } },
		order: ACTIVE_FIRST,
	});

// Basis eines Wechsels: das bezahlte Abo zuerst (laufend, sonst gekündigt mit Restlaufzeit, #2049), ein
// offener Checkout nur ohne beides — er ist nie bezahlt und bringt kein Guthaben ein (#2235).
const findChangeBasis = async (userId: number) =>
	(await Subscription.findOne({ where: { userId, status: 'active' } })) ??
	(await findCancelledWithRemaining(userId)) ??
	(await Subscription.findOne({ where: { userId, status: 'approval_pending' } }));

// Guthaben und erster Zyklus eines Upgrades — gemeinsame Eingabe-Ermittlung für Wechsel und Vorschau.
const upgradeProration = (subscription: Subscription, plan: Plan, period: Period, now: Date) => {
	const currentPlan = subscription.get('plan') as Plan;
	const currentPeriod = subscription.get('period') as Period;
	const periodEnd = subscription.get('currentPeriodEnd') as Date;
	const periodStart = new Date(periodEnd);
	periodStart.setUTCMonth(periodStart.getUTCMonth() - PERIOD_MONTHS[currentPeriod]);
	const { prices } = getPlansCatalog();
	return prorateUpgrade({
		oldPriceCents: prices[currentPlan][currentPeriod],
		newPriceCents: prices[plan][period],
		periodStart,
		periodEnd,
		now,
	});
};

/**
 * Übertrag eines Guthabens über dem neuen Preis (#2241): k volle Zyklen deckt das Guthaben, der Rest r
 * mindert den Folgezyklus. PayPal kann keinen einzelnen späteren Zyklus mindern — P − r wird wie beim
 * Upgrade (#1912) als Einrichtungsgebühr bei der Zustimmung eingezogen, die Abrechnung beginnt nach
 * k + 1 Zyklen. Ein Guthaben, das genau aufgeht, bleibt als r = P stehen (keine Gebühr, #2230).
 */
const creditCarryover = (creditCents: number, priceCents: number, period: Period, now: Date) => {
	const coveredCycles = priceCents > 0 ? Math.max(0, Math.ceil(creditCents / priceCents) - 1) : 0;
	const restCents = creditCents - coveredCycles * priceCents;
	const after = (cycles: number) => {
		const date = new Date(now);
		date.setUTCMonth(date.getUTCMonth() + cycles * PERIOD_MONTHS[period]);
		return date;
	};
	const feeCents = Math.max(0, priceCents - restCents);
	return {
		coveredCycles,
		restCents,
		feeCents,
		// Ohne Gebühr gibt es keine Abbuchung bei der Zustimmung — die Periode deckt dann auch Zyklus k + 1.
		periodEnd: after(feeCents === 0 ? coveredCycles + 1 : coveredCycles),
		startTime: after(coveredCycles + 1),
	};
};

// Sofort wirksamer Wechsel mit Verrechnung (#2142): höheres Paket oder Zeitraumwechsel im gleichen Paket.
const isImmediateChange = (subscription: Subscription, plan: Plan, period: Period) => {
	const currentPlan = subscription.get('plan') as Plan;
	return rankOf(plan) > rankOf(currentPlan) || (plan === currentPlan && period !== subscription.get('period'));
};

// Sofortwechsel mit Verrechnung nur aus einem bezahlten Abo derselben Zahlungsart (#2142, #2235).
const isCreditedChange = (subscription: Subscription, providerId: string, plan: Plan, period: Period) =>
	subscription.get('status') !== 'approval_pending' &&
	subscription.get('provider') === providerId &&
	isImmediateChange(subscription, plan, period);

// Abo aus einem Upgrade/Zeitraumwechsel, dessen erste Abbuchung noch aussteht (#2142): Periode endet ≤ jetzt, Guthaben gesetzt.
const awaitsFirstCharge = (subscription: Subscription) =>
	subscription.get('status') === 'active' &&
	(subscription.get('creditCents') as number) > 0 &&
	(subscription.get('currentPeriodEnd') as Date).getTime() <= Date.now();

// Genehmigtes Upgrade (#2238): bei PayPal zugestimmt, aber noch nicht bezahlt — ein Wechsel ließe sein Abo verwaisen.
const awaitsApprovedUpgrade = async (userId: number) =>
	(await Subscription.findOne({ where: { userId, status: 'approval_pending', approvedAt: { [Op.ne]: null } } })) !==
	null;

const AWAITS_FIRST_CHARGE_MESSAGE = 'Der letzte Wechsel wird gerade abgerechnet — bitte später erneut versuchen.';

/**
 * Speichert die Angaben einer bei PayPal ausgelösten Kündigung am Abo und meldet eine
 * außerordentliche den Betreibern — gemeinsam für den App-Weg (#2308) und die Kündigung ohne Login (#2317).
 */
export const recordCancellation = async (
	subscription: Subscription,
	request: { kind: 'ordinary' | 'extraordinary'; reason: string; email: string },
	send?: MailSender,
): Promise<void> => {
	await subscription.update({
		cancellationKind: request.kind,
		cancellationReason: request.kind === 'extraordinary' ? request.reason : null,
		cancellationEmail: request.email,
		cancellationRequestedAt: new Date(),
	});
	if (request.kind === 'extraordinary') {
		const user = await User.findByPk(subscription.get('userId') as number);
		await notifyAdminsOfExtraordinaryCancellation(subscription, user?.email ?? null, send);
	}
};

export const createBillingSubscriptionsRouter = (deps: BillingSubscriptionsDeps = {}): Router => {
	const router = Router();
	// Kauf im Web gibt es nur bei PayPal (ADR 0013); Store-Kanäle blockt `rejectStoreChannel`.
	const provider = createPaypalProvider({ client: deps.paypalClient });
	const { checkout } = provider;

	// Verwirft einen nie bestätigten Checkout (`approval_pending`). Enges Fenster (Review #1998): Die
	// Zustimmung kann bei PayPal bereits eingegangen sein, bevor ACTIVATED verarbeitet ist. Der
	// Kündigungs-Ruf klärt das: Erfolg oder 4xx (nie zugestimmt/nicht mehr kündbar) räumt die Zeile
	// lokal auf — bei Zustimmung kündigt derselbe Ruf das echte Abo dort. 5xx/Netzfehler ⇒ `false`,
	// die Zeile bleibt für einen neuen Anlauf.
	const discardPendingCheckout = async (subscription: Subscription): Promise<boolean> => {
		try {
			await checkout.cancel(subscription.get('externalSubscriptionId') as string);
		} catch (error) {
			if (!(error instanceof PaypalHttpError) || error.status >= 500) return false;
		}
		await subscription.destroy();
		return true;
	};

	// POST /billing/subscriptions — legt ein Abo an und liefert die Zustimmungs-URL (AK1). Ein
	// laufendes Abo desselben Nutzers blockt einen zweiten Anlauf (AK2); ein offener Checkout wird
	// vorher verworfen, auch wenn der Nutzer nach einem Abbruch nie zurückkehrte (#2235). Bei einem
	// gekündigten Abo mit Restlaufzeit kanalisiert diese Route jeden Buchungsweg auf den Start zum
	// Periodenende (#2049 AK3).
	router.post('/billing/subscriptions', async (req: Request, res: Response<ApprovalDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		if (rejectStoreChannel(req, res)) return;
		const body = req.body as { plan?: unknown; period?: unknown; withdrawalConsent?: unknown } | undefined;
		if (!isPaidPlan(body?.plan) || !isPeriod(body?.period)) {
			sendError(res, 400, 'plan muss plus oder pro sein, period monthly, quarterly oder yearly.');
			return;
		}
		// Zustimmung zum sofortigen Leistungsbeginn (#2329, § 312f BGB) — ohne sie kein Abo.
		if (body.withdrawalConsent !== true) {
			sendError(res, 400, 'withdrawalConsent muss true sein (Zustimmung zum sofortigen Leistungsbeginn).');
			return;
		}
		// Ein Abo mit Zahlungsrückstand läuft weiter und blockt ebenso (#2240).
		const running = OPEN_SUBSCRIPTION_STATUSES.filter((status) => status !== 'approval_pending');
		if (await Subscription.findOne({ where: { userId, status: running } })) {
			sendError(res, 409, 'Es besteht bereits ein laufendes Abo.');
			return;
		}
		for (const pending of await Subscription.findAll({ where: { userId, status: 'approval_pending' } })) {
			if (!(await discardPendingCheckout(pending))) {
				sendError(res, 502, 'PayPal war nicht erreichbar.');
				return;
			}
		}
		try {
			// Bei einem gekündigten Abo mit Restlaufzeit startet das neue Abo erst zum Periodenende
			// (#2049) — jeder Buchungsweg läuft über denselben Startzeitpunkt, ein zweites sofort
			// abbuchendes Abo entsteht so nicht.
			const cancelled = await findCancelledWithRemaining(userId);
			const start = (cancelled?.get('currentPeriodEnd') as Date | undefined) ?? new Date();
			const { approvalUrl, externalSubscriptionId } = await checkout.create(
				body.plan,
				body.period,
				undefined,
				cancelled === null ? undefined : start,
			);
			await Subscription.create({
				userId,
				provider: provider.id,
				externalSubscriptionId,
				plan: body.plan,
				period: body.period,
				status: 'approval_pending',
				// Die erste Periode beginnt mit der ersten Abbuchung (#2230).
				currentPeriodEnd: start,
				withdrawalConsentAt: new Date(),
			});
			res.status(201).json({ approvalUrl });
		} catch {
			sendError(res, 502, 'PayPal war nicht erreichbar.');
		}
	});

	// POST /billing/subscriptions/cancel — löst die Kündigung bei PayPal aus (AK3). `plan` bleibt
	// unverändert; wirksam wird die Kündigung erst über `BILLING.SUBSCRIPTION.CANCELLED`. Ein nie
	// bestätigter Checkout (`approval_pending`) blockiert sonst jede Neubuchung (409). Ein bereits
	// gekündigtes Abo antwortet ebenfalls 409 (#2048). Der Body `{ kind, reason?, email }` aus dem
	// Bestätigungsschritt (#2308) wird vor dem PayPal-Aufruf geprüft und danach am Abo gespeichert.
	router.post(
		'/billing/subscriptions/cancel',
		async (req: Request, res: Response<Record<string, never> | ErrorDto>) => {
			const userId = getUserId(req);
			if (userId === undefined) {
				sendError(res, 401, 'Anmeldung erforderlich.');
				return;
			}
			const subscription = await Subscription.findOne({
				where: { userId, status: OPEN_SUBSCRIPTION_STATUSES },
				order: [PAID_FIRST],
			});
			if (!subscription) {
				// Gekündigt mit laufendem Zeitraum ist kein fehlendes Abo — verständlicher 409 statt 404 (#2048).
				const cancelled = await findCancelledWithRemaining(userId);
				if (cancelled) {
					sendError(res, 409, 'Das Abo ist bereits gekündigt.');
					return;
				}
				sendError(res, 404, 'Kein Abo gefunden.');
				return;
			}
			if (subscription.get('status') === 'approval_pending') {
				if (!(await discardPendingCheckout(subscription))) {
					sendError(res, 502, 'PayPal war nicht erreichbar.');
					return;
				}
				res.status(200).json({});
				return;
			}
			const body = req.body as { kind?: unknown; reason?: unknown; email?: unknown } | undefined;
			const kind = body?.kind;
			const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
			const email = typeof body?.email === 'string' ? body.email.trim() : '';
			if (kind !== 'ordinary' && kind !== 'extraordinary') {
				sendError(res, 400, 'kind muss ordinary oder extraordinary sein.');
				return;
			}
			if (kind === 'extraordinary' && reason === '') {
				sendError(res, 400, 'Bitte einen Grund angeben.');
				return;
			}
			if (!EMAIL_RE.test(email)) {
				sendError(res, 400, 'Bitte eine gültige E-Mail-Adresse angeben.');
				return;
			}
			try {
				await checkout.cancel(subscription.get('externalSubscriptionId') as string);
			} catch (error) {
				// 4xx heißt: PayPal lehnt ab (bereits gekündigt, 422 SUBSCRIPTION_STATUS_INVALID) —
				// verständlicher 409 statt 502 (#2048). 5xx/Netzfehler bleiben 502.
				if (error instanceof PaypalHttpError && error.status < 500) {
					sendError(res, 409, 'Das Abo ist bereits gekündigt.');
					return;
				}
				sendError(res, 502, 'PayPal war nicht erreichbar.');
				return;
			}
			await recordCancellation(subscription, { kind, reason, email }, deps.mailSender);
			res.status(200).json({});
		},
	);

	// POST /billing/subscriptions/change — löst den Paketwechsel bei PayPal aus (AK4). `plan`
	// bleibt unverändert; wirksam wird der Wechsel erst über das Webhook-Ereignis. Ein Upgrade legt
	// ein neues Abo mit um das Guthaben reduziertem ersten Zyklus an (#1912); das alte kündigt erst
	// die Bestätigung des neuen (`replacePredecessors`). Downgrades laufen weiter über `revise`; bei
	// einem gekündigten Abo mit Restlaufzeit startet jedes neue Abo erst am Periodenende (#2049).
	router.post('/billing/subscriptions/change', async (req: Request, res: Response<ReviseDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		if (rejectStoreChannel(req, res)) return;
		const body = req.body as { plan?: unknown; period?: unknown } | undefined;
		if (!isPaidPlan(body?.plan) || !isPeriod(body?.period)) {
			sendError(res, 400, 'plan muss plus oder pro sein, period monthly, quarterly oder yearly.');
			return;
		}
		// Gekündigt mit Restlaufzeit gilt als laufendes Abo (#2049) — 404 nur ohne jedes.
		const subscription = await findChangeBasis(userId);
		if (!subscription) {
			sendError(res, 404, 'Kein Abo gefunden.');
			return;
		}
		if (awaitsFirstCharge(subscription) || (await awaitsApprovedUpgrade(userId))) {
			sendError(res, 409, AWAITS_FIRST_CHARGE_MESSAGE);
			return;
		}
		try {
			const currentPlan = subscription.get('plan') as Plan;
			// Gekündigtes Abo, Ziel nicht höher (#2049): `revise` liefe ins Leere (bei PayPal bereits
			// beendet) — stattdessen ein neues Abo, dessen erste Abbuchung erst am Periodenende startet.
			if (subscription.get('status') === 'cancelled' && rankOf(body.plan) <= rankOf(currentPlan)) {
				const start = subscription.get('currentPeriodEnd') as Date;
				const { approvalUrl, externalSubscriptionId } = await checkout.create(body.plan, body.period, undefined, start);
				await Subscription.create({
					userId,
					provider: provider.id,
					externalSubscriptionId,
					plan: body.plan,
					period: body.period,
					status: 'approval_pending',
					currentPeriodEnd: start,
				});
				res.status(200).json({ approvalUrl });
				return;
			}
			if (isCreditedChange(subscription, provider.id, body.plan, body.period)) {
				const now = new Date();
				const { creditCents } = upgradeProration(subscription, body.plan, body.period, now);
				const carry = creditCarryover(creditCents, getPlansCatalog().prices[body.plan][body.period], body.period, now);
				const { approvalUrl, externalSubscriptionId } = await checkout.create(
					body.plan,
					body.period,
					carry.feeCents,
					carry.startTime,
				);
				// Ein abgebrochener früherer Upgrade-Anlauf bliebe sonst als offenes Abo liegen.
				await Subscription.destroy({
					where: { userId, status: 'approval_pending', id: { [Op.ne]: subscription.get('id') } },
				});
				await Subscription.create({
					userId,
					provider: provider.id,
					externalSubscriptionId,
					plan: body.plan,
					period: body.period,
					status: 'approval_pending',
					// Gedeckte Zyklen laufen ab dem Upgrade (#2230, #2241); der Rest mindert die erste Abbuchung.
					currentPeriodEnd: carry.periodEnd,
					creditCents: carry.restCents,
				});
				res.status(200).json({ approvalUrl });
				return;
			}
			const { approvalUrl } = await checkout.change(
				subscription.get('externalSubscriptionId') as string,
				body.plan,
				body.period,
			);
			res.status(200).json(approvalUrl ? { approvalUrl } : {});
		} catch {
			sendError(res, 502, 'PayPal war nicht erreichbar.');
		}
	});

	// POST /billing/subscriptions/change/preview — Betragsvorschau vor dem Wechsel (#1913): dieselbe
	// Rechnung wie der Wechsel, aber ohne PayPal-Aufruf und ohne Schreibzugriff.
	router.post('/billing/subscriptions/change/preview', async (req: Request, res: Response<PreviewDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const body = req.body as { plan?: unknown; period?: unknown } | undefined;
		if (!isPaidPlan(body?.plan) || !isPeriod(body?.period)) {
			sendError(res, 400, 'plan muss plus oder pro sein, period monthly, quarterly oder yearly.');
			return;
		}
		const subscription = await findChangeBasis(userId);
		if (!subscription) {
			sendError(res, 404, 'Kein Abo gefunden.');
			return;
		}
		if (awaitsFirstCharge(subscription) || (await awaitsApprovedUpgrade(userId))) {
			sendError(res, 409, AWAITS_FIRST_CHARGE_MESSAGE);
			return;
		}
		if (isCreditedChange(subscription, provider.id, body.plan, body.period)) {
			const now = new Date();
			const { creditCents, firstCycleCents } = upgradeProration(subscription, body.plan, body.period, now);
			const price = getPlansCatalog().prices[body.plan][body.period];
			// #2241: deckt das Guthaben volle Zyklen, nennt die Vorschau, bis wann — und die Gebühr P − r, die bei der Zustimmung fällig wird.
			const carry = creditCents >= price ? creditCarryover(creditCents, price, body.period, now) : undefined;
			res.status(200).json({
				priceCents: price,
				creditCents,
				dueCents: carry?.feeCents ?? firstCycleCents,
				immediate: true,
				startsAt: now.toISOString(),
				...(carry && { creditCoversUntil: carry.periodEnd.toISOString() }),
			});
			return;
		}
		const price = getPlansCatalog().prices[body.plan][body.period];
		const currentPlan = subscription.get('plan') as Plan;
		// Startzeitpunkt des Wechsels (#2049): beim laufenden Abo die nächste Abrechnung, bei
		// Kündigung mit Restlaufzeit das Periodenende — die Oberfläche zeigt beides.
		const startsAt = (subscription.get('currentPeriodEnd') as Date).toISOString();
		// #2324: Downgrade — das laufende Paket läuft bis zum Periodenende weiter, jetzt wird nichts abgebucht.
		if (rankOf(body.plan) < rankOf(currentPlan)) {
			res.status(200).json({
				priceCents: price,
				creditCents: 0,
				dueCents: 0,
				immediate: false,
				startsAt,
				currentPlan,
				currentPeriod: subscription.get('period') as Period,
			});
			return;
		}
		res.status(200).json({ priceCents: price, creditCents: 0, dueCents: price, immediate: false, startsAt });
	});

	// GET /billing/invoices — eigene Rechnungen des angemeldeten Nutzers (AK5).
	router.get('/billing/invoices', async (req: Request, res: Response<InvoiceDto[] | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const invoices = await Invoice.findAll({ where: { userId }, order: [['periodStart', 'DESC']] });
		res.json(invoices.map(serializeInvoice));
	});

	// GET /billing/invoices/{id} — eigene Rechnung; fremde oder unbekannte Id liefert 404 (AK5,
	// Muster `apiTokens.ts`: weder inhaltlich noch über den Status wird eine fremde Rechnung verraten).
	router.get('/billing/invoices/:id', async (req: Request, res: Response<InvoiceDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const id = parseId(req.params.id);
		if (id === null) {
			sendError(res, 404, 'Rechnung nicht gefunden.');
			return;
		}
		const invoice = await Invoice.findOne({ where: { id, userId } });
		if (!invoice) {
			sendError(res, 404, 'Rechnung nicht gefunden.');
			return;
		}
		res.json(serializeInvoice(invoice));
	});

	// GET /billing/invoices/{id}/pdf — das zum Erzeugungszeitpunkt gespeicherte Rechnungs-PDF
	// (#1955 AK4, byte-identisch zum Mail-Anhang). Fremde oder unbekannte Ids — darunter
	// Altrechnungen ohne gespeichertes PDF — liefern 404 wie die Stamm-Route.
	router.get('/billing/invoices/:id/pdf', async (req: Request, res: Response<Buffer | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const id = parseId(req.params.id);
		if (id === null) {
			sendError(res, 404, 'Rechnung nicht gefunden.');
			return;
		}
		const invoice = await Invoice.findOne({ where: { id, userId } });
		const pdfBytes = invoice?.get('pdfBytes') as Buffer | null | undefined;
		if (!invoice || !pdfBytes) {
			sendError(res, 404, 'Rechnung nicht gefunden.');
			return;
		}
		// Rechnungsnummer ist servergeneriert (`INV-<Jahr>-<6-stellig>`) — header-sicher.
		res
			.status(200)
			.set('Content-Type', 'application/pdf')
			.set('Content-Disposition', `attachment; filename="${invoice.get('number') as string}.pdf"`)
			.send(pdfBytes);
	});

	return router;
};
