import { Op } from 'sequelize';
import Subscription from '../models/subscription.js';
import Invoice from '../models/invoice.js';
import { rankOf, syncUserPlan, applyDuePendingPlan } from './billing/lifecycle.js';
import { PAYPAL_PLAN_IDS, type Plan } from './plans.js';

export { applyDuePendingPlan, isGracePeriodExpired } from './billing/lifecycle.js';

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
	createSubscription(
		planId: string,
		override?: CreateSubscriptionOverride,
	): Promise<{ approvalUrl: string; externalSubscriptionId: string }>;
	cancel(externalSubscriptionId: string): Promise<void>;
	revise(externalSubscriptionId: string, targetPlanId: string): Promise<{ approvalUrl?: string }>;
}

/**
 * Start-Override eines neuen Abos (#1912/#2049). Der Plan-Override von PayPal kann keinen
 * zusätzlichen Zyklus einfügen — deshalb wird beim Upgrade der erste Zyklus als Einrichtungsgebühr
 * sofort eingezogen (`firstCycleCents`) und die reguläre Abrechnung beginnt erst eine Periode später
 * (`startTime`). Ohne `firstCycleCents` verschiebt `startTime` die erste Abbuchung auf den
 * Zeitpunkt (Weiterführen/Downgrade nach Kündigung).
 */
interface CreateSubscriptionOverride {
	firstCycleCents?: number;
	startTime: Date;
}

/**
 * HTTP-Fehler eines PayPal-Aufrufs. `status` trennt Ablehnung (4xx — z. B. Kündigung eines nie
 * zugestimmten Abos) von Nichterreichbarkeit (5xx/Netzfehler): nur zweitere ist ein 502-Fall.
 */
export class PaypalHttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

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
 * Paket×Zeitraum zu einer PayPal-Plan-ID. Zur Laufzeit trägt die Umgebungsvariable die echte
 * Plan-ID (`PAYPAL_PLAN_IDS[plan][period].envVar`, #1494). Ist sie nicht gesetzt (Test-/
 * Entwicklungslauf ohne PayPal-Zugang), gilt zusätzlich der Variablenname selbst als Kennung —
 * so bleibt die Zuordnung ohne Zugangsdaten deterministisch prüfbar.
 */
const planPeriodFromPaypalPlanId = (
	planId: string,
): { plan: Exclude<Plan, 'free'>; period: BillingPeriod } | undefined => {
	for (const [plan, periods] of Object.entries(PAYPAL_PLAN_IDS)) {
		for (const [period, entry] of Object.entries(periods)) {
			if (planId === process.env[entry.envVar]?.trim() || planId === entry.envVar) {
				return { plan: plan as Exclude<Plan, 'free'>, period: period as BillingPeriod };
			}
		}
	}
	return undefined;
};

/**
 * Umkehrung von {@link planPeriodFromPaypalPlanId} (#1505 AK1/AK4): PayPal-Plan-ID zu
 * Paket×Zeitraum, für den Aufruf von `PaypalClient.createSubscription`/`revise`. Fällt wie dort
 * ohne gesetzte Umgebungsvariable auf den Variablennamen selbst zurück.
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
	async createSubscription(planId, override) {
		const token = await getAccessToken(fetchImpl);
		const returnUrl = process.env.PAYPAL_RETURN_URL?.trim() || 'https://app.example/settings?billing=returned';
		const cancelUrl = process.env.PAYPAL_CANCEL_URL?.trim() || returnUrl;
		const res = await fetchImpl(`${apiBase()}/v1/billing/subscriptions`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				plan_id: planId,
				application_context: { return_url: returnUrl, cancel_url: cancelUrl },
				...(override && {
					start_time: override.startTime.toISOString(),
					// `firstCycleCents` ist beim reinen Start-Aufschub (#2049) nicht gesetzt — ohne
					// diese Auswahl stünde `undefined/100` als „NaN" im Betrag.
					...(override.firstCycleCents !== undefined && {
						plan: {
							payment_preferences: {
								setup_fee: { currency_code: 'EUR', value: (override.firstCycleCents / 100).toFixed(2) },
							},
						},
					}),
				}),
			}),
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
			throw new PaypalHttpError('PayPal-Abo konnte nicht gekündigt werden.', res.status);
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
		// PayPal hat den Wechsel bestätigt (res.ok), nur der Body ist unlesbar → kontrolliert mit
		// {}-Fallback weiterlaufen lassen, den Parse-Fehler aber sichtbar protokollieren (#1471 AK1).
		const body = (await res.json().catch((error: unknown) => {
			console.warn('PayPal revise(): Antwort konnte nicht als JSON gelesen werden', error);
			return {};
		})) as { links?: { rel?: string; href?: string }[] };
		const approvalUrl = approveLinkOf(body);
		return approvalUrl ? { approvalUrl } : {};
	},
});

/** Ereignis-Ausschnitt, den die Planänderung braucht (PayPal-Webhook-Body). */
export interface PaypalWebhookEvent {
	id?: string;
	event_type?: string;
	/** `billing_agreement_id` trägt die Abo-Referenz bei Zahlungsereignissen (#1506), `sale_id` die Sale-Referenz des Erstattungs-Vorgangs (#2086). */
	resource?: { id?: string; plan_id?: string; billing_agreement_id?: string; sale_id?: string };
}

/** Monate je Abrechnungszeitraum — Muster `invoices.ts` `PERIOD_MONTHS` (#1506 AK1). */
export const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/**
 * Wendet ein verifiziertes Ereignis auf das Abo an (AK4/AK6):
 *
 * - Kündigung (`BILLING.SUBSCRIPTION.CANCELLED`) → Status `cancelled`, das bezahlte Paket läuft bis
 *   `currentPeriodEnd` weiter, der Fall auf `free` steht in `pendingPlan` (Muster Google Play `CANCELED`, #1896).
 * - Ablauf (`BILLING.SUBSCRIPTION.EXPIRED`) → Paket sofort zurück auf `free`, Status `cancelled`.
 * - Höheres Paket oder gleichrangiges mit anderem Zeitraum → löst eine Abbuchung aus und wirkt erst
 *   mit deren Bestätigung (#2140): Paket und Zeitraum stehen in `pendingPlan`/`pendingPeriod`,
 *   `pendingPlanEffectiveAt` bleibt `null` (zahlungsgebunden), angewendet von {@link applyPaymentEvent}.
 * - Niedrigeres Paket → wirkt erst ab `currentPeriodEnd`; bis dahin bleibt das bezahlte Paket
 *   aktiv und Paket und Zeitraum stehen in `pendingPlan`/`pendingPeriod`/`pendingPlanEffectiveAt`.
 * - Gleiches Paket, gleicher Zeitraum → keine Abbuchung, eine ältere Vormerkung entfällt.
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

	// Durch ein Upgrade abgelöstes Abo (#1912): bereits gekündigt und auf `free` gesetzt, das Paket am
	// Nutzer trägt das Nachfolge-Abo und darf durch den späten Webhook nicht auf `free` fallen.
	if (
		(eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') &&
		subscription.get('status') === 'cancelled' &&
		subscription.get('plan') === 'free'
	) {
		return;
	}

	if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
		const currentPeriodEnd = subscription.get('currentPeriodEnd') as Date;
		// #1959: eine Admin-/Selbstkündigung nimmt das bezahlte Paket dem Nutzer NICHT weg — der
		// Abgleich hält die Durchsetzung (User.plan, alle Guards lesen sie) in Sync mit dem
		// Abo-Stand. Gesperrte Abos (Admin-Sperre, `locked`) bleiben gesperrt: die Sperre wirkt
		// über `User.plan = free` und wird durch das Webhook-Ereignis nicht aufgehoben.
		const wasLocked = subscription.get('status') === 'locked';
		await subscription.update({
			status: 'cancelled',
			pendingPlan: 'free',
			pendingPeriod: null,
			pendingPlanEffectiveAt: currentPeriodEnd > now ? currentPeriodEnd : now,
		});
		if (!wasLocked) {
			await syncUserPlan(subscription, subscription.get('plan') as Plan);
		}
		return;
	}

	if (eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
		await subscription.update({
			plan: 'free',
			status: 'cancelled',
			pendingPlan: null,
			pendingPeriod: null,
			pendingPlanEffectiveAt: null,
		});
		await syncUserPlan(subscription, 'free');
		return;
	}

	// Plan-Änderungen allein aus UPDATED/ACTIVATED: Der Webhook kann im PayPal-Dashboard auf
	// beliebige Ereignisse abonniert sein („alle Events"), und weitere Typen wie CREATED tragen
	// ebenfalls eine `plan_id` — sie beweisen aber keine Zustimmung und dürfen nichts freischalten.
	if (eventType !== 'BILLING.SUBSCRIPTION.UPDATED' && eventType !== 'BILLING.SUBSCRIPTION.ACTIVATED') {
		return;
	}

	const target = planPeriodFromPaypalPlanId(event.resource?.plan_id ?? '');
	if (!target) {
		return;
	}

	// Eine gekündigte Zeile wird durch kein Planwechsel-Ereignis wiederbelebt — Spätereignisse für
	// ein abgelöstes Abo (#1912) trügen sonst ein höheres plan_id zurück in die Zeile.
	if (subscription.get('status') === 'cancelled') {
		return;
	}

	const currentPeriodEnd = subscription.get('currentPeriodEnd') as Date;
	const current = String(subscription.get('plan'));
	if (rankOf(target.plan) < rankOf(current)) {
		// Downgrade: Paket bleibt bis zum Periodenende unverändert, Paket und Zeitraum werden nur
		// vorgemerkt — die Anzeige („Aktuelles Paket") schlägt bis dahin auf die alte Kombination.
		await subscription.update({
			pendingPlan: target.plan,
			pendingPeriod: target.period,
			pendingPlanEffectiveAt: currentPeriodEnd > now ? currentPeriodEnd : now,
		});
		return;
	}
	// Der Wechsel ist eine erneute Entscheidung — eine ältere Downgrade-Vormerkung ist damit hinfällig
	// (Review #1998), sonst fiele der Nutzer zum Periodenende still zurück. Upgrade und Zeitraumwechsel
	// warten auf den Zahlungseingang (#2140), ohne Zeitpunkt wendet `applyDuePendingPlan` sie nie an.
	const unchanged = target.plan === current && target.period === subscription.get('period');
	await subscription.update({
		pendingPlan: unchanged ? null : target.plan,
		pendingPeriod: unchanged ? null : target.period,
		pendingPlanEffectiveAt: null,
	});
};

/**
 * Löst nach Bestätigung eines neuen Abos das bisherige ab (#1912/#2049, Bestätigung siehe `paypalProvider.ts`): jedes andere aktive PayPal-Abo
 * desselben Nutzers wird bei PayPal gekündigt und lokal beendet, das neue Paket gilt sofort. Ein
 * gekündigtes Abo mit Restlaufzeit (#2049) ist bei PayPal bereits beendet — dort entfällt nur der
 * geplante Fall auf `free`, damit `applyDuePendingPlan` den Nutzer nicht neben dem Nachfolge-Abo
 * zurückstuft. Ein zweites laufendes Abo entsteht nur über den Upgrade-Weg (`POST
 * /billing/subscriptions` blockt es mit 409) — ohne Vorgänger ein No-op.
 */
export const replacePredecessors = async (
	subscription: Subscription,
	client: Pick<PaypalClient, 'cancel'>,
): Promise<void> => {
	const where = {
		userId: subscription.get('userId') as number,
		provider: 'paypal',
		id: { [Op.ne]: subscription.get('id') as number },
	};
	const predecessors = await Subscription.findAll({ where: { ...where, status: 'active' } });
	const cancelled = await Subscription.findAll({
		// Gekündigt mit Restlaufzeit: bei PayPal schon beendet, kein erneuter Kündigungsaufruf (4xx).
		where: { ...where, status: 'cancelled', currentPeriodEnd: { [Op.gt]: new Date() } },
	});
	if (predecessors.length === 0 && cancelled.length === 0) {
		return;
	}
	for (const predecessor of predecessors) {
		await client.cancel(predecessor.get('externalSubscriptionId') as string);
		await predecessor.update({ plan: 'free', status: 'cancelled', pendingPlan: null, pendingPlanEffectiveAt: null });
	}
	for (const predecessor of cancelled) {
		await predecessor.update({ pendingPlan: null, pendingPeriod: null, pendingPlanEffectiveAt: null });
	}
	await syncUserPlan(subscription, subscription.get('plan') as Plan);
};

/** Injizierbare Abhängigkeiten von {@link applyPaymentEvent} (Muster `deps` in `billing.ts`). */
export interface ApplyPaymentEventDeps {
	/** `saleId`: Sale-Referenz der Abbuchung (`resource.id`, #2086). */
	issueInvoice?: (subscription: Subscription, now: Date, saleId?: string | null) => Promise<unknown>;
}

/**
 * Wendet ein verifiziertes Zahlungsereignis auf das Abo an (AK1/AK3/AK4, T6e/#1506):
 *
 * - Erfolgreiche Abbuchung (`PAYMENT.SALE.COMPLETED`) → zunächst eine fällige Downgrade-Vormerkung
 *   und die zahlungsgebundene Vormerkung (#2140) anwenden (Paket und Zeitraum des NEUEN Zyklus), dann
 *   Periode um einen Zeitraum verschieben — die erste Abbuchung ab `max(currentPeriodEnd, now)`
 *   (#2230) —, `status: 'active'`, `firstFailureAt` löschen, danach `deps.issueInvoice` aufrufen.
 * - Aktivierung (`BILLING.SUBSCRIPTION.ACTIVATED`) ist keine Abbuchung → nur `status: 'active'`,
 *   weder Verlängerung noch Rechnung (#2230).
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

	if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
		// Die Zustimmung bucht nichts ab: die erste Periode beginnt erst mit der ersten Abbuchung (#2230).
		await subscription.update({ status: 'active' });
		return;
	}

	if (eventType === 'PAYMENT.SALE.COMPLETED') {
		// Eine fällige Downgrade-Vormerkung (Paket+Zeitraum) wird VOR der Verlängerung angewendet:
		// Die Abbuchung startet den neuen Zyklus, Verlängerung und Rechnung müssen daher mit dem
		// neuen Paket×Zeitraum rechnen — das `applyDuePendingPlan` beim nächsten `/auth/me` käme
		// zu spät (Verlängerung um die alte Periode, Rechnung zum alten Preis).
		await applyDuePendingPlan(subscription, now);
		// Zahlungsgebundene Vormerkung (#2140): erst die Abbuchung schaltet Upgrade bzw. Zeitraumwechsel
		// frei — ebenfalls VOR der Verlängerung.
		const pendingPlan = subscription.get('pendingPlan') as Plan | null;
		if (pendingPlan && !subscription.get('pendingPlanEffectiveAt')) {
			await subscription.update({
				plan: pendingPlan,
				period: subscription.get('pendingPeriod') ?? subscription.get('period'),
				pendingPlan: null,
				pendingPeriod: null,
			});
			await syncUserPlan(subscription, pendingPlan);
		}
		const months = PERIOD_MONTHS[String(subscription.get('period'))] ?? 1;
		const currentPeriodEnd = new Date(subscription.get('currentPeriodEnd') as Date);
		const nextPeriodEnd = new Date(currentPeriodEnd);
		nextPeriodEnd.setUTCMonth(nextPeriodEnd.getUTCMonth() + months);
		// Die Zustimmung kann Stunden nach dem Checkout liegen: die erste Abbuchung (noch keine Rechnung, Start
		// innerhalb der letzten Periode) rechnet ab jetzt; Folgeabbuchungen ab dem Periodenende — kein Drift
		// gegen PayPals Abrechnungsplan bei verspätetem Einzug (#2230).
		if (
			currentPeriodEnd < now &&
			now < nextPeriodEnd &&
			(await Invoice.count({ where: { subscriptionId: subscription.get('id') as number } })) === 0
		) {
			currentPeriodEnd.setTime(now.getTime());
		}
		currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + months);
		await subscription.update({ currentPeriodEnd, status: 'active', firstFailureAt: null });
		await deps.issueInvoice?.(subscription, now, event.resource?.id ?? null);
		return;
	}

	if (eventType === 'PAYMENT.SALE.REFUNDED') {
		// Erstattung (#2086): die Rechnung mit passender Sale-Referenz wird `refunded`; trägt keine
		// Rechnung die Referenz (Altrechnung vor der Spalte), trifft der Fallback die neueste
		// Rechnung des Abos — eine Erstattung darf nie still verloren gehen.
		const subscriptionId = subscription.get('id') as number;
		const saleId = event.resource?.sale_id ?? null;
		const invoice =
			(saleId ? await Invoice.findOne({ where: { subscriptionId, saleId } }) : null) ??
			(await Invoice.findOne({ where: { subscriptionId }, order: [['periodEnd', 'DESC']] }));
		if (invoice) {
			await invoice.update({ paymentStatus: 'refunded' });
		}
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
