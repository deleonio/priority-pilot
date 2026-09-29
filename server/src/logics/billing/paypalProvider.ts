import type { MailSender } from '../mail.js';
import { issueInvoiceForPeriod } from '../invoices.js';
import {
	applyPaymentEvent,
	applyPlanChange,
	createPaypalClient,
	paypalPlanIdFor,
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
			await applyPaymentEvent(subscription, paypalEvent, now, {
				issueInvoice: (s, n) => issueInvoiceForPeriod(s, n, deps.mailSender),
			});
		},
		checkout: {
			create: (plan, period) => client.createSubscription(paypalPlanIdFor(plan, period)),
			cancel: (externalSubscriptionId) => client.cancel(externalSubscriptionId),
			change: (externalSubscriptionId, plan, period) =>
				client.revise(externalSubscriptionId, paypalPlanIdFor(plan, period)),
		},
	};
};
