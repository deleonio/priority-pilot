import type Subscription from '../../models/subscription.js';
import type { Plan } from '../plans.js';

/** Abrechnungszeitraum eines Abos. */
type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

/** Ergebnis der Echtheitsprüfung. `unreachable` ≠ `invalid`: ein Netzfehler verwirft kein Ereignis. */
type EventVerification = 'verified' | 'invalid' | 'unreachable';

/** Ein eingegangenes Anbieter-Ereignis, soweit Ablage, Dedup und Zuordnung zum Abo es brauchen. */
interface ProviderEvent {
	id: string;
	type: string;
	externalSubscriptionId: string;
	/** Anbieterspezifischer Inhalt; nur der Anbieter selbst liest ihn in `applyEvent`. */
	payload: unknown;
}

/** Kauf im Web: Abo anlegen, kündigen und wechseln laufen über den Anbieter (ADR 0013). */
export interface WebCheckout {
	create(
		plan: Exclude<Plan, 'free'>,
		period: BillingPeriod,
	): Promise<{ approvalUrl: string; externalSubscriptionId: string }>;
	cancel(externalSubscriptionId: string): Promise<void>;
	change(
		externalSubscriptionId: string,
		plan: Exclude<Plan, 'free'>,
		period: BillingPeriod,
	): Promise<{ approvalUrl?: string }>;
}

/**
 * Was ein Abo-Anbieter können muss. Die Routen sprechen Anbieter nur über diese Schnittstelle an.
 * Jeder Anbieter meldet Ereignisse (PayPal per Webhook, Google Play per RTDN, ADR 0017), die geprüft,
 * abgelegt und erst danach aufs Abo angewendet werden. Einen Kauf im Web bietet nur PayPal an;
 * Google Play kauft in der App.
 */
export interface BillingProvider {
	/** Kennung in `subscriptions.provider` und `webhook_events.provider`. */
	readonly id: string;
	/** HTTP-Status für ein Ereignis, das die Echtheitsprüfung nicht besteht; ohne Angabe 400. */
	readonly invalidEventStatus?: number;
	verifyEvent(rawBody: Buffer, headers: Record<string, string>): Promise<EventVerification>;
	/** `null`, wenn der Rohbody kein lesbares Ereignis ist. */
	parseEvent(rawBody: Buffer): ProviderEvent | null;
	applyEvent(subscription: Subscription, event: ProviderEvent, now: Date): Promise<void>;
	checkout?: WebCheckout;
}
