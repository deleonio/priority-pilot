import type Subscription from '../models/subscription.js';
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

/** Kulanzfrist nach dem ersten fehlgeschlagenen Einzug, in Tagen (AK7). */
const GRACE_PERIOD_DAYS = 14;

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

/** Ereignis-Ausschnitt, den die Planänderung braucht (PayPal-Webhook-Body). */
export interface PaypalWebhookEvent {
	id?: string;
	event_type?: string;
	resource?: { id?: string; plan_id?: string };
}

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
	return true;
};

/**
 * Ob die Kulanzfrist nach dem ersten fehlgeschlagenen Einzug abgelaufen ist (AK7). Tag 14 ist noch
 * innerhalb der Frist, ab Tag 15 ist sie abgelaufen — der Zugang wird erst dann eingeschränkt.
 */
export const isGracePeriodExpired = (firstFailureAt: Date, now: Date): boolean =>
	now.getTime() - firstFailureAt.getTime() > GRACE_PERIOD_DAYS * DAY_MS;
