import type { MailSender } from '../mail.js';
import { issueCreditNote, issueInvoiceForPeriod } from '../invoices.js';
import { refundRemainingTerm } from '../cancellationRefund.js';
import {
	applyPaymentEvent,
	applyPlanChange,
	coversFirstCycle,
	createPaypalClient,
	paypalPlanIdFor,
	PERIOD_MONTHS,
	replacePredecessors,
	verifyWebhookSignature,
	type PaypalClient,
	type PaypalVerifier,
	type PaypalWebhookEvent,
} from '../paypal.js';
import type { BillingProvider, WebCheckout } from './provider.js';

/** Injizierbare Teile; ohne Angabe gelten die echten PayPal-Aufrufe. */
export interface PaypalProviderDeps {
	client?: PaypalClient;
	verifier?: PaypalVerifier;
	/** Rechnungsversand nach erfolgreicher Abbuchung (#1506). */
	mailSender?: MailSender;
}

/** PayPal als Abo-Anbieter (ADR 0013): Webhook-Ereignisse und Kauf im Web. */
export const createPaypalProvider = (deps: PaypalProviderDeps = {}): BillingProvider & { checkout: WebCheckout } => {
	const client = deps.client ?? createPaypalClient();
	return {
		id: 'paypal',
		verifyEvent: deps.verifier ?? ((rawBody, headers) => verifyWebhookSignature(rawBody, headers)),
		parseEvent: (rawBody) => {
			let event: PaypalWebhookEvent;
			try {
				event = JSON.parse(rawBody.toString('utf8')) as PaypalWebhookEvent;
			} catch {
				return null;
			}
			return {
				id: event.id ?? '',
				type: event.event_type ?? '',
				externalSubscriptionId: event.resource?.billing_agreement_id ?? event.resource?.id ?? '',
				payload: event,
			};
		},
		applyEvent: async (subscription, event, now) => {
			const paypalEvent = event.payload as PaypalWebhookEvent;
			await applyPlanChange(subscription, paypalEvent, now);
			// Das alte Abo erst mit der Bestätigung des neuen kündigen, sonst entsteht eine Lücke (#1912).
			// Ersetzt wird nur gegen eine Zahlung: die erste Abbuchung (#2140) oder ganz deckendes Guthaben
			// (#2230) — ein Upgrade mit Restschuld (#2238) und ein Startaufschub ohne Guthaben (#2049) warten
			// auf ihre erste Abbuchung (#2239).
			const type = paypalEvent.event_type;
			// Eine späte Abbuchung auf einer beendeten Zeile (#2243) löst keinen Nachfolger ab — sonst
			// würde das aktuelle Abo des Nutzers gekündigt.
			if (
				(type === 'PAYMENT.SALE.COMPLETED' && subscription.get('status') !== 'cancelled') ||
				(type === 'BILLING.SUBSCRIPTION.ACTIVATED' && coversFirstCycle(subscription))
			) {
				await replacePredecessors(subscription, client);
			}
			// #2745: Kündigung ab der zweiten Laufzeit → anteilige Restlaufzeit-Erstattung (Sale-Refund
			// plus Gutschrift). Ein Fehlschlag kassiert das Vertragsende nicht — er wird geloggt und im
			// Kulanz-Sweep wiederholt (#2606-Muster, `refundRetryAttempts`).
			if (type === 'BILLING.SUBSCRIPTION.CANCELLED' && client.refund) {
				try {
					await refundRemainingTerm({ subscription, now, refund: client.refund });
				} catch (error) {
					console.warn(
						`PayPal-Erstattung für ${String(subscription.get('externalSubscriptionId'))} fehlgeschlagen — Wiederholung im Sweep.`,
						error,
					);
					const attempts = (subscription.get('refundRetryAttempts') as number | null) ?? 0;
					await subscription.update({ refundRetryAttempts: attempts + 1 });
				}
			}
			await applyPaymentEvent(subscription, paypalEvent, now, {
				issueInvoice: (s, n, saleId, charged, transaction, periodStart) =>
					issueInvoiceForPeriod(s, n, deps.mailSender, saleId, charged, transaction, undefined, periodStart),
				issueCreditNote: (original, n, transaction) => issueCreditNote(original, n, transaction, deps.mailSender),
				// Paketentzug (#2237) kündigt auch das PayPal-Abo — der Client ist hier im Scope.
				cancelPaypal: () => client.cancel(subscription.get('externalSubscriptionId') as string),
				mailSend: deps.mailSender,
			});
		},
		checkout: {
			create: (plan, period, firstCycleCents, startTime) => {
				// Aufgeschobener Start (#2049): Weiterführen/Downgrade nach Kündigung buchen erst ab
				// `startTime` ab — ohne Einrichtungsgebühr (`firstCycleCents` bleibt ungesetzt).
				// Guthaben-Übertrag (#2241): Gebühr und Start kommen gemeinsam, eine Gebühr von 0 entfällt.
				if (startTime !== undefined) {
					return client.createSubscription(paypalPlanIdFor(plan, period), {
						...(firstCycleCents && { firstCycleCents }),
						startTime,
					});
				}
				if (firstCycleCents === undefined) {
					return client.createSubscription(paypalPlanIdFor(plan, period));
				}
				const firstCycleStart = new Date();
				firstCycleStart.setUTCMonth(firstCycleStart.getUTCMonth() + PERIOD_MONTHS[period]);
				return client.createSubscription(paypalPlanIdFor(plan, period), {
					firstCycleCents,
					startTime: firstCycleStart,
				});
			},
			cancel: (externalSubscriptionId) => client.cancel(externalSubscriptionId),
			change: (externalSubscriptionId, plan, period) =>
				client.revise(externalSubscriptionId, paypalPlanIdFor(plan, period)),
		},
	};
};
