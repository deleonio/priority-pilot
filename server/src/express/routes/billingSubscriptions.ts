import { Router } from 'express';
import type { Request, Response } from 'express';
import { Subscription } from '../../models/index.js';
import { OPEN_SUBSCRIPTION_STATUSES } from '../../models/subscription.js';
import Invoice from '../../models/invoice.js';
import { getUserId } from '../requireAuth.js';
import { sendError, parseId, type ErrorDto } from '../http-error.js';
import { createPaypalClient, paypalPlanIdFor, type PaypalClient } from '../../logics/paypal.js';
import { PLAN_VALUES, type Plan } from '../../logics/plans.js';

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
	paypalClient?: PaypalClient;
}

const PROVIDER = 'paypal';
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
type ReviseDto = { approvalUrl?: string };
type InvoiceDto = {
	id: number;
	number: string;
	periodStart: string;
	periodEnd: string;
	amountCents: number;
	taxNote: string;
};

const serializeInvoice = (invoice: Invoice): InvoiceDto => ({
	id: invoice.id,
	number: invoice.number,
	periodStart: invoice.periodStart.toISOString(),
	periodEnd: invoice.periodEnd.toISOString(),
	amountCents: invoice.amountCents,
	taxNote: invoice.taxNote,
});

export const createBillingSubscriptionsRouter = (deps: BillingSubscriptionsDeps = {}): Router => {
	const router = Router();
	const client: PaypalClient = deps.paypalClient ?? createPaypalClient();

	// POST /billing/subscriptions — legt ein Abo an und liefert die Zustimmungs-URL (AK1). Ein
	// laufendes oder ausstehendes Abo desselben Nutzers blockt einen zweiten Anlauf (AK2).
	router.post('/billing/subscriptions', async (req: Request, res: Response<ApprovalDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		if (rejectStoreChannel(req, res)) return;
		const body = req.body as { plan?: unknown; period?: unknown } | undefined;
		if (!isPaidPlan(body?.plan) || !isPeriod(body?.period)) {
			sendError(res, 400, 'plan muss pro, max oder ultimate sein, period monthly, quarterly oder yearly.');
			return;
		}
		const existing = await Subscription.findOne({ where: { userId, status: OPEN_SUBSCRIPTION_STATUSES } });
		if (existing) {
			sendError(res, 409, 'Es besteht bereits ein laufendes oder ausstehendes Abo.');
			return;
		}
		try {
			const planId = paypalPlanIdFor(body.plan, body.period);
			const { approvalUrl, externalSubscriptionId } = await client.createSubscription(planId);
			await Subscription.create({
				userId,
				provider: PROVIDER,
				externalSubscriptionId,
				plan: body.plan,
				period: body.period,
				status: 'approval_pending',
				currentPeriodEnd: new Date(Date.now() + PERIOD_MS[body.period]),
			});
			res.status(201).json({ approvalUrl });
		} catch {
			sendError(res, 502, 'PayPal war nicht erreichbar.');
		}
	});

	// POST /billing/subscriptions/cancel — löst die Kündigung bei PayPal aus (AK3). `plan` bleibt
	// unverändert; wirksam wird die Kündigung erst über `BILLING.SUBSCRIPTION.CANCELLED`.
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
			});
			if (!subscription) {
				sendError(res, 404, 'Kein Abo gefunden.');
				return;
			}
			try {
				await client.cancel(subscription.get('externalSubscriptionId') as string);
				res.status(200).json({});
			} catch {
				sendError(res, 502, 'PayPal war nicht erreichbar.');
			}
		},
	);

	// POST /billing/subscriptions/change — löst den Paketwechsel bei PayPal aus (AK4). `plan`
	// bleibt unverändert; wirksam wird der Wechsel erst über das Webhook-Ereignis.
	router.post('/billing/subscriptions/change', async (req: Request, res: Response<ReviseDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		if (rejectStoreChannel(req, res)) return;
		const body = req.body as { plan?: unknown; period?: unknown } | undefined;
		if (!isPaidPlan(body?.plan) || !isPeriod(body?.period)) {
			sendError(res, 400, 'plan muss pro, max oder ultimate sein, period monthly, quarterly oder yearly.');
			return;
		}
		const subscription = await Subscription.findOne({
			where: { userId, status: OPEN_SUBSCRIPTION_STATUSES },
		});
		if (!subscription) {
			sendError(res, 404, 'Kein Abo gefunden.');
			return;
		}
		try {
			const targetPlanId = paypalPlanIdFor(body.plan, body.period);
			const { approvalUrl } = await client.revise(subscription.get('externalSubscriptionId') as string, targetPlanId);
			res.status(200).json(approvalUrl ? { approvalUrl } : {});
		} catch {
			sendError(res, 502, 'PayPal war nicht erreichbar.');
		}
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

	return router;
};
