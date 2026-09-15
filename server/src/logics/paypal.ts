import type Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { PAYPAL_PLAN_IDS, PLAN_VALUES, type Plan } from './plans.js';

/**
 * PayPal-Anbindung (Issue #1495, T6b; Zahlungsweg laut ADR 0013). Enthält die Signaturprüfung
 * eingehender Webhooks, die Übersetzung eines Ereignisses in eine Planänderung und die
 * Kulanzfrist bei Zahlungsausfall. Es werden **keine** Zahlungsdaten verarbeitet oder
 * gespeichert — der Nutzerbezug entsteht ausschließlich über die externe Abo-ID.
 */

/** Ergebnis der Signaturprüfung. `unreachable` ≠ `invalid`: ein Netzfehler verwirft kein Ereignis. */
export type PaypalVerificationResult = 'verified' | 'invalid' | 'unreachable';

/** Signatur des injizierbaren Verifiers (Vorbild `MailSender`) — Tests reichen einen Fake herein. */
export type PaypalVerifier = (rawBody: Buffer, headers: Record<string, string>) => Promise<PaypalVerificationResult>;

/** Abrechnungszeitraum eines Abos, wie ihn `PAYPAL_PLAN_IDS` als Schlüssel führt. */
type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

/**
 * Signatur des injizierbaren Abo-Clients (Issue #1505, T6d; Muster `PaypalVerifier`). Tests
 * reichen einen Fake herein (`AppDeps.paypalClient`), Produktion nutzt {@link createPaypalClient}.
 * Wirksam wird eine Anlage/ein Wechsel ausschließlich über das verifizierte Webhook-Ereignis
 * (ADR 0013) — dieser Client löst nur den PayPal-Aufruf aus.
 */
export interface PaypalClient {
	createSubscription(planId: string): Promise<{ approvalUrl: string; externalSubscriptionId: string }>;
	cancel(externalSubscriptionId: string): Promise<void>;
	revise(externalSubscriptionId: string, targetPlanId: string): Promise<{ approvalUrl?: string }>;
}

/** Kulanzfrist nach dem ersten fehlgeschlagenen Einzug, in Tagen (AK7). */
export const GRACE_PERIOD_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

const apiBase = (): string => process.env.PAYPAL_API_BASE?.trim() || 'https://api-m.paypal.com';

/** Die fünf Header, die PayPal zur Signaturprüfung erwartet (Groß-/Kleinschreibung egal). */
const signatureHeaders = (headers: Record<string, string>) => ({
	auth_algo: headers['paypal-auth-algo'] ?? '',
	cert_url: headers['paypal-cert-url'] ?? '',
	transmission_id: headers['paypal-transmission-id'] ?? '',
	transmission_sig: headers['paypal-transmission-sig'] ?? '',
	transmission_time: headers['paypal-transmission-time'] ?? '',
});

/**
 * Prüft die Signatur eines Webhook-Ereignisses bei PayPal (`POST
 * /v1/notifications/verify-webhook-signature`). Bewusst ein Netzaufruf und kein lokaler
 * HMAC-Vergleich: nur PayPal kennt das Zertifikat zur Übertragung.
 *
 * `rawBody` MUSS der unveränderte Rohbody sein — jedes Re-Serialisieren (`JSON.stringify` nach
 * `express.json()`) ändert Bytes und damit das Prüfergebnis (AK1).
 *
 * Jeder Fehler auf dem Weg (DNS, Timeout, HTTP-Fehlerstatus) ergibt `unreachable`, nicht `invalid`:
 * ein nicht prüfbares Ereignis darf weder wirksam werden noch verloren gehen (AK2).
 */
export const verifyWebhookSignature = async (
	rawBody: Buffer,
	headers: Record<string, string>,
	fetchImpl: typeof fetch = fetch,
): Promise<PaypalVerificationResult> => {
	const clientId = process.env.PAYPAL_CLIENT_ID?.trim() ?? '';
	const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() ?? '';
	const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() ?? '';
	const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

	try {
		const tokenRes = await fetchImpl(`${apiBase()}/v1/oauth2/token`, {
			method: 'POST',
			headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=client_credentials',
		});
		if (!tokenRes.ok) {
			return 'unreachable';
		}
		const token = ((await tokenRes.json()) as { access_token?: string }).access_token ?? '';

		const res = await fetchImpl(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...signatureHeaders(headers),
				webhook_id: webhookId,
				// Der Vergleichsbody muss inhaltlich der gesendete sein; PayPal serialisiert ihn neu.
				webhook_event: JSON.parse(rawBody.toString('utf8')),
			}),
		});
		if (!res.ok) {
			return 'unreachable';
		}
		const body = (await res.json()) as { verification_status?: string };
		return body.verification_status === 'SUCCESS' ? 'verified' : 'invalid';
	} catch {
		// Bewusst ohne Fehlerdetails im Log (können Header/Zugangsdaten enthalten) — Muster `mail.ts`.
		console.warn('PayPal-Signaturprüfung nicht erreichbar.');
		return 'unreachable';
	}
};

/**
 * Paket zu einer PayPal-Plan-ID. Zur Laufzeit trägt die Umgebungsvariable die echte Plan-ID
 * (`PAYPAL_PLAN_IDS[plan][period].envVar`, #1494). Ist sie nicht gesetzt (Test-/Entwicklungslauf
 * ohne PayPal-Zugang), gilt zusätzlich der Variablenname selbst als Kennung — so bleibt die
 * Zuordnung ohne Zugangsdaten deterministisch prüfbar.
 */
const planFromPaypalPlanId = (planId: string): Plan | undefined => {
	for (const [plan, periods] of Object.entries(PAYPAL_PLAN_IDS)) {
		for (const entry of Object.values(periods)) {
			if (planId === process.env[entry.envVar]?.trim() || planId === entry.envVar) {
				return plan as Plan;
			}
		}
	}
	return undefined;
};

/** Rang eines Pakets in der Paketreihenfolge (`PLAN_VALUES`) — Grundlage für „Upgrade oder Downgrade?". */
const rankOf = (plan: string): number => PLAN_VALUES.indexOf(plan as Plan);

/**
 * Gleicht das für die Durchsetzung maßgebliche Paket am Nutzer ab (#1462, T7 AK3). Alle Guards
 * lesen `User.plan` (`express/planGuard.ts`, `express/apiTokenAuth.ts`, `routes/auth.ts`), nicht
 * `Subscription.plan` — ohne diesen Abgleich bliebe eine Kündigung für die Durchsetzung wirkungslos.
 * Bewusst nur ein Spaltenwechsel: es wird kein Datensatz gelöscht, gesperrt wird allein der
 * Schreibzugriff.
 */
const syncUserPlan = async (subscription: Subscription, plan: Plan): Promise<void> => {
	const userId = subscription.get('userId') as number | null | undefined;
	if (!userId) {
		return;
	}
	await User.update({ plan }, { where: { id: userId } });
};

/**
 * Umkehrung von {@link planFromPaypalPlanId} (#1505 AK1/AK4): PayPal-Plan-ID zu Paket×Zeitraum,
 * für den Aufruf von `PaypalClient.createSubscription`/`revise`. Fällt wie dort ohne gesetzte
 * Umgebungsvariable auf den Variablennamen selbst zurück.
 */
export const paypalPlanIdFor = (plan: Exclude<Plan, 'free'>, period: BillingPeriod): string => {
	const entry = PAYPAL_PLAN_IDS[plan][period];
	return process.env[entry.envVar]?.trim() || entry.envVar;
};

/** Holt ein OAuth-Zugangstoken bei PayPal (Client-Credentials) — Vorbild `verifyWebhookSignature`. */
const getAccessToken = async (fetchImpl: typeof fetch): Promise<string> => {
	const clientId = process.env.PAYPAL_CLIENT_ID?.trim() ?? '';
	const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() ?? '';
	const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const res = await fetchImpl(`${apiBase()}/v1/oauth2/token`, {
		method: 'POST',
		headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'grant_type=client_credentials',
	});
	if (!res.ok) {
		throw new Error('PayPal-Zugangstoken konnte nicht geholt werden.');
	}
	return ((await res.json()) as { access_token?: string }).access_token ?? '';
};

/** Genehmigungslink aus der PayPal-Antwort (`links[].rel === 'approve'`). */
const approveLinkOf = (body: { links?: { rel?: string; href?: string }[] }): string | undefined =>
	body.links?.find((link) => link.rel === 'approve')?.href;

/**
 * Produktiver Abo-Client (#1505, T6d): Anlegen, Kündigen und Wechseln über die PayPal-
 * Subscriptions-API. Tests injizieren stattdessen einen Fake (`AppDeps.paypalClient`) — Muster
 * `verifyWebhookSignature`/`paypalVerifier`. `returnUrl`/`cancelUrl` zeigen auf eine
 * Frontend-Route der Einstellungen (T6c, #1496), nicht auf `GET /billing/return`.
 */
export const createPaypalClient = (fetchImpl: typeof fetch = fetch): PaypalClient => ({
	async createSubscription(planId) {
		const token = await getAccessToken(fetchImpl);
		const returnUrl = process.env.PAYPAL_RETURN_URL?.trim() || 'https://app.example/settings?billing=returned';
		const cancelUrl = process.env.PAYPAL_CANCEL_URL?.trim() || returnUrl;
		const res = await fetchImpl(`${apiBase()}/v1/billing/subscriptions`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ plan_id: planId, application_context: { return_url: returnUrl, cancel_url: cancelUrl } }),
		});
		if (!res.ok) {
			throw new Error('PayPal-Abo konnte nicht angelegt werden.');
		}
		const body = (await res.json()) as { id?: string; links?: { rel?: string; href?: string }[] };
		return { approvalUrl: approveLinkOf(body) ?? '', externalSubscriptionId: body.id ?? '' };
	},
	async cancel(externalSubscriptionId) {
		const token = await getAccessToken(fetchImpl);
		const res = await fetchImpl(`${apiBase()}/v1/billing/subscriptions/${externalSubscriptionId}/cancel`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ reason: 'Vom Nutzer gekündigt.' }),
		});
		if (!res.ok) {
			throw new Error('PayPal-Abo konnte nicht gekündigt werden.');
		}
	},
	async revise(externalSubscriptionId, targetPlanId) {
		const token = await getAccessToken(fetchImpl);
		const res = await fetchImpl(`${apiBase()}/v1/billing/subscriptions/${externalSubscriptionId}/revise`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ plan_id: targetPlanId }),
		});
		if (!res.ok) {
			throw new Error('PayPal-Abo konnte nicht gewechselt werden.');
		}
		const body = (await res.json().catch(() => ({}))) as { links?: { rel?: string; href?: string }[] };
		const approvalUrl = approveLinkOf(body);
		return approvalUrl ? { approvalUrl } : {};
	},
});

/** Ereignis-Ausschnitt, den die Planänderung braucht (PayPal-Webhook-Body). */
export interface PaypalWebhookEvent {
	id?: string;
	event_type?: string;
	/** `billing_agreement_id` trägt die Abo-Referenz bei Zahlungsereignissen (#1506). */
	resource?: { id?: string; plan_id?: string; billing_agreement_id?: string };
}

/** Monate je Abrechnungszeitraum — Muster `invoices.ts` `PERIOD_MONTHS` (#1506 AK1). */
const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/**
 * Wendet ein verifiziertes Ereignis auf das Abo an (AK4/AK6):
 *
 * - Kündigung (`BILLING.SUBSCRIPTION.CANCELLED`/`EXPIRED`) → Paket zurück auf `free`, Status `cancelled`.
 * - Höheres Paket → wirkt **sofort**, damit der Nutzer das Bezahlte umgehend nutzen kann.
 * - Niedrigeres Paket → wirkt erst ab `currentPeriodEnd`; bis dahin bleibt das bezahlte Paket
 *   aktiv und der Wechsel steht in `pendingPlan`/`pendingPlanEffectiveAt`.
 *
 * Wie PayPal den Restzeitraum abrechnet, ist für diese Entscheidung ohne Belang — maßgeblich ist
 * allein die eigene Freischaltung.
 */
export const applyPlanChange = async (
	subscription: Subscription,
	event: PaypalWebhookEvent,
	now: Date,
): Promise<void> => {
	const eventType = event.event_type ?? '';

	if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
		await subscription.update({ plan: 'free', status: 'cancelled', pendingPlan: null, pendingPlanEffectiveAt: null });
		await syncUserPlan(subscription, 'free');
		return;
	}

	const target = planFromPaypalPlanId(event.resource?.plan_id ?? '');
	if (!target) {
		return;
	}

	const currentPeriodEnd = subscription.get('currentPeriodEnd') as Date;
	const current = String(subscription.get('plan'));
	if (rankOf(target) > rankOf(current)) {
		await subscription.update({ plan: target, status: 'active', pendingPlan: null, pendingPlanEffectiveAt: null });
		await syncUserPlan(subscription, target);
		return;
	}
	if (rankOf(target) < rankOf(current)) {
		// Downgrade: Paket bleibt bis zum Periodenende unverändert, der Wechsel wird nur vorgemerkt.
		await subscription.update({
			pendingPlan: target,
			pendingPlanEffectiveAt: currentPeriodEnd > now ? currentPeriodEnd : now,
		});
	}
};

/**
 * Wendet einen fälligen, vorgemerkten Paketwechsel an (AK4): ist `pendingPlanEffectiveAt` erreicht,
 * wird `pendingPlan` zum aktiven Paket und die Vormerkung gelöscht.
 *
 * Bewusst beim Lesen des Abos aufgerufen (statt über einen eigenen wiederkehrenden Lauf): der
 * Wechsel wirkt genau dann, wenn der Zustand gebraucht wird, und hängt nicht daran, dass PayPal
 * zufällig ein weiteres Ereignis schickt. Ohne fällige Vormerkung ist der Aufruf ein No-Op.
 */
export const applyDuePendingPlan = async (subscription: Subscription, now: Date): Promise<boolean> => {
	const pendingPlan = subscription.get('pendingPlan') as string | null | undefined;
	const effectiveAt = subscription.get('pendingPlanEffectiveAt') as Date | string | null | undefined;
	if (!pendingPlan || !effectiveAt || new Date(effectiveAt).getTime() > now.getTime()) {
		return false;
	}
	await subscription.update({ plan: pendingPlan, pendingPlan: null, pendingPlanEffectiveAt: null });
	await syncUserPlan(subscription, pendingPlan as Plan);
	return true;
};

/**
 * Ob die Kulanzfrist nach dem ersten fehlgeschlagenen Einzug abgelaufen ist (AK7). Tag 15 ist noch
 * innerhalb der Frist, ab Tag 16 ist sie abgelaufen — der Zugang wird erst dann eingeschränkt.
 */
export const isGracePeriodExpired = (firstFailureAt: Date, now: Date): boolean =>
	now.getTime() - firstFailureAt.getTime() > GRACE_PERIOD_DAYS * DAY_MS;

/** Injizierbare Abhängigkeiten von {@link applyPaymentEvent} (Muster `deps` in `billing.ts`). */
export interface ApplyPaymentEventDeps {
	issueInvoice?: (subscription: Subscription, now: Date) => Promise<unknown>;
}

/**
 * Wendet ein verifiziertes Zahlungsereignis auf das Abo an (AK1/AK3/AK4, T6e/#1506):
 *
 * - Erfolgreiche Abbuchung (`PAYMENT.SALE.COMPLETED`, ersatzweise
 *   `BILLING.SUBSCRIPTION.ACTIVATED`) → Periode um einen Zeitraum verschieben, `status: 'active'`,
 *   `firstFailureAt` löschen, danach `deps.issueInvoice` aufrufen.
 * - Fehlgeschlagener Einzug (`BILLING.SUBSCRIPTION.PAYMENT.FAILED`) → nur beim ersten Mal
 *   `firstFailureAt` setzen und `status: 'past_due'`; ein weiterer Fehlschlag verlängert die
 *   bereits laufende Frist nicht.
 * - `BILLING.SUBSCRIPTION.SUSPENDED` → `status: 'suspended'`, `firstFailureAt` unverändert — die
 *   Frist läuft unabhängig vom PayPal-eigenen Status weiter.
 * - Unbekannter Ereignistyp → No-Op.
 */
export const applyPaymentEvent = async (
	subscription: Subscription,
	event: PaypalWebhookEvent,
	now: Date,
	deps: ApplyPaymentEventDeps = {},
): Promise<void> => {
	const eventType = event.event_type ?? '';

	if (eventType === 'PAYMENT.SALE.COMPLETED' || eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
		const period = String(subscription.get('period'));
		const currentPeriodEnd = new Date(subscription.get('currentPeriodEnd') as Date);
		currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + (PERIOD_MONTHS[period] ?? 1));
		await subscription.update({ currentPeriodEnd, status: 'active', firstFailureAt: null });
		await deps.issueInvoice?.(subscription, now);
		return;
	}

	if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
		if (!subscription.get('firstFailureAt')) {
			await subscription.update({ firstFailureAt: now, status: 'past_due' });
		}
		return;
	}

	if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
		await subscription.update({ status: 'suspended' });
	}
};

/**
 * Wendet eine fällige Kulanzfrist an (AK6, T6e/#1506): ist `firstFailureAt` gesetzt und
 * {@link isGracePeriodExpired}, wird `status: 'grace_expired'` gesetzt und `firstFailureAt`
 * zurückgesetzt — `plan` bleibt unverändert (der Downgrade selbst ist T7, #1462).
 *
 * Bewusst beim Lesen des Abos aufgerufen (Muster `applyDuePendingPlan`). Ohne fällige Frist ein
 * No-Op.
 */
export const applyDueGracePeriod = async (subscription: Subscription, now: Date): Promise<boolean> => {
	const firstFailureAt = subscription.get('firstFailureAt') as Date | string | null | undefined;
	if (!firstFailureAt || !isGracePeriodExpired(new Date(firstFailureAt), now)) {
		return false;
	}
	await subscription.update({ status: 'grace_expired', firstFailureAt: null });
	return true;
};
