import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op, type Order } from 'sequelize';
import { Subscription } from '../../models/index.js';
import { OPEN_SUBSCRIPTION_STATUSES } from '../../models/subscription.js';
import Invoice from '../../models/invoice.js';
import { getUserId } from '../requireAuth.js';
import { sendError, parseId, type ErrorDto } from '../http-error.js';
import { createPaypalProvider, type PaypalProviderDeps } from '../../logics/billing/paypalProvider.js';
import { rankOf } from '../../logics/billing/lifecycle.js';
import { PaypalHttpError, PERIOD_MONTHS } from '../../logics/paypal.js';
import { getPlansCatalog, PLAN_VALUES, type Plan } from '../../logics/plans.js';
import { prorateUpgrade } from '../../logics/proration.js';

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
}

const PAID_PLANS = PLAN_VALUES.filter((plan): plan is Exclude<Plan, 'free'> => plan !== 'free');
const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_MS: Record<Period, number> = {
	monthly: 30 * 24 * 60 * 60 * 1000,
	quarterly: 91 * 24 * 60 * 60 * 1000,
	yearly: 365 * 24 * 60 * 60 * 1000,
};

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
/** `immediate`: wirkt der Wechsel sofort (Upgrade) oder erst zum Periodenende (ADR 0013) — die Oberfläche hat keine eigene Rangfolge. `startsAt` nennt den Startzeitpunkt (#2049). */
type PreviewDto = { creditCents: number; dueCents: number; immediate: boolean; startsAt?: string };
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

// Sofort wirksamer Wechsel mit Verrechnung (#2142): höheres Paket oder Zeitraumwechsel im gleichen Paket.
const isImmediateChange = (subscription: Subscription, plan: Plan, period: Period) => {
	const currentPlan = subscription.get('plan') as Plan;
	return rankOf(plan) > rankOf(currentPlan) || (plan === currentPlan && period !== subscription.get('period'));
};

// Abo aus einem Upgrade/Zeitraumwechsel, dessen erste Abbuchung noch aussteht (#2142): Periode endet ≤ jetzt, Guthaben gesetzt.
const awaitsFirstCharge = (subscription: Subscription) =>
	subscription.get('status') === 'active' &&
	(subscription.get('creditCents') as number) > 0 &&
	(subscription.get('currentPeriodEnd') as Date).getTime() <= Date.now();

const AWAITS_FIRST_CHARGE_MESSAGE = 'Der letzte Wechsel wird gerade abgerechnet — bitte später erneut versuchen.';

export const createBillingSubscriptionsRouter = (deps: BillingSubscriptionsDeps = {}): Router => {
	const router = Router();
	// Kauf im Web gibt es nur bei PayPal (ADR 0013); Store-Kanäle blockt `rejectStoreChannel`.
	const provider = createPaypalProvider({ client: deps.paypalClient });
	const { checkout } = provider;

	// POST /billing/subscriptions — legt ein Abo an und liefert die Zustimmungs-URL (AK1). Ein
	// laufendes oder ausstehendes Abo desselben Nutzers blockt einen zweiten Anlauf (AK2). Bei einem
	// gekündigten Abo mit Restlaufzeit kanalisiert diese Route jeden Buchungsweg auf den Start zum
	// Periodenende (#2049 AK3).
	router.post('/billing/subscriptions', async (req: Request, res: Response<ApprovalDto | ErrorDto>) => {
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
		const existing = await Subscription.findOne({ where: { userId, status: OPEN_SUBSCRIPTION_STATUSES } });
		if (existing) {
			sendError(res, 409, 'Es besteht bereits ein laufendes oder ausstehendes Abo.');
			return;
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
			});
			res.status(201).json({ approvalUrl });
		} catch {
			sendError(res, 502, 'PayPal war nicht erreichbar.');
		}
	});

	// POST /billing/subscriptions/cancel — löst die Kündigung bei PayPal aus (AK3). `plan` bleibt
	// unverändert; wirksam wird die Kündigung erst über `BILLING.SUBSCRIPTION.CANCELLED`. Ein nie
	// bestätigter Checkout (`approval_pending`) blockiert sonst jede Neubuchung (409). Ein bereits
	// gekündigtes Abo antwortet ebenfalls 409 (#2048).
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
				order: ACTIVE_FIRST,
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
				// Enges Fenster (Review #1998): Die Zustimmung kann bei PayPal bereits eingegangen
				// sein, bevor ACTIVATED verarbeitet ist. Der Kündigungs-Ruf klärt das: Erfolg oder
				// 4xx (nie zugestimmt/nicht mehr kündbar) räumt die Zeile lokal auf — bei
				// Zustimmung kündigt derselbe Ruf das echte Abo dort. 5xx/Netzfehler ⇒ 502, die
				// Zeile bleibt für einen neuen Anlauf.
				try {
					await checkout.cancel(subscription.get('externalSubscriptionId') as string);
				} catch (error) {
					if (!(error instanceof PaypalHttpError) || error.status >= 500) {
						sendError(res, 502, 'PayPal war nicht erreichbar.');
						return;
					}
				}
				await subscription.destroy();
				res.status(200).json({});
				return;
			}
			try {
				await checkout.cancel(subscription.get('externalSubscriptionId') as string);
				res.status(200).json({});
			} catch (error) {
				// 4xx heißt: PayPal lehnt ab (bereits gekündigt, 422 SUBSCRIPTION_STATUS_INVALID) —
				// verständlicher 409 statt 502 (#2048). 5xx/Netzfehler bleiben 502.
				if (error instanceof PaypalHttpError && error.status < 500) {
					sendError(res, 409, 'Das Abo ist bereits gekündigt.');
					return;
				}
				sendError(res, 502, 'PayPal war nicht erreichbar.');
			}
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
		const subscription =
			(await Subscription.findOne({ where: { userId, status: OPEN_SUBSCRIPTION_STATUSES }, order: ACTIVE_FIRST })) ??
			// Gekündigt mit Restlaufzeit gilt als laufendes Abo (#2049) — 404 nur ohne jedes.
			(await findCancelledWithRemaining(userId));
		if (!subscription) {
			sendError(res, 404, 'Kein Abo gefunden.');
			return;
		}
		if (awaitsFirstCharge(subscription)) {
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
			if (subscription.get('provider') === provider.id && isImmediateChange(subscription, body.plan, body.period)) {
				const now = new Date();
				const { creditCents, firstCycleCents } = upgradeProration(subscription, body.plan, body.period, now);
				const { approvalUrl, externalSubscriptionId } = await checkout.create(body.plan, body.period, firstCycleCents);
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
					// Deckt das Guthaben den ersten Zyklus, gibt es keine Abbuchung — die Periode läuft ab dem Upgrade (#2230).
					currentPeriodEnd: firstCycleCents === 0 ? new Date(now.getTime() + PERIOD_MS[body.period]) : now,
					creditCents,
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
		const subscription =
			(await Subscription.findOne({ where: { userId, status: OPEN_SUBSCRIPTION_STATUSES }, order: ACTIVE_FIRST })) ??
			(await findCancelledWithRemaining(userId));
		if (!subscription) {
			sendError(res, 404, 'Kein Abo gefunden.');
			return;
		}
		if (awaitsFirstCharge(subscription)) {
			sendError(res, 409, AWAITS_FIRST_CHARGE_MESSAGE);
			return;
		}
		if (subscription.get('provider') === provider.id && isImmediateChange(subscription, body.plan, body.period)) {
			const now = new Date();
			const { creditCents, firstCycleCents } = upgradeProration(subscription, body.plan, body.period, now);
			res.status(200).json({ creditCents, dueCents: firstCycleCents, immediate: true, startsAt: now.toISOString() });
			return;
		}
		res.status(200).json({
			creditCents: 0,
			dueCents: getPlansCatalog().prices[body.plan][body.period],
			immediate: false,
			// Startzeitpunkt des Wechsels (#2049): beim laufenden Abo die nächste Abrechnung, bei
			// Kündigung mit Restlaufzeit das Periodenende — die Oberfläche zeigt beides.
			startsAt: (subscription.get('currentPeriodEnd') as Date).toISOString(),
		});
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
