import type { MailSender } from '../mail.js';
import { issueCreditNote, issueInvoiceForPeriod } from '../invoices.js';
import { getPlansCatalog, type Plan } from '../plans.js';
import {
	applyPaymentEvent,
	applyPlanChange,
	createPaypalClient,
	paypalPlanIdFor,
	PERIOD_MONTHS,
	replacePredecessors,
	verifyWebhookSignature,
	type PaypalClient,
	type PaypalVerifier,
	type PaypalWebhookEvent,
} from '../paypal.js';
import type Subscription from '../../models/subscription.js';
import type { BillingProvider, WebCheckout } from './provider.js';

/** Ob die Bestätigung des Abos sofort abbucht: nur ein Upgrade-Abo (#1912), dessen Guthaben den ersten Zyklus nicht deckt. */
const chargesOnActivation = (subscription: Subscription): boolean => {
	const creditCents = subscription.get('creditCents') as number;
	const price = getPlansCatalog().prices[subscription.get('plan') as Plan];
	return creditCents > 0 && price[subscription.get('period') as keyof typeof price] > creditCents;
};

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
			// Bucht die Bestätigung ab, zählt erst der Zahlungseingang (#2140); ohne Abbuchung (Startaufschub
			// #2049, Guthaben deckt den ersten Zyklus) gilt schon ACTIVATED.
			const type = paypalEvent.event_type;
			if (
				type === 'PAYMENT.SALE.COMPLETED' ||
				(type === 'BILLING.SUBSCRIPTION.ACTIVATED' && !chargesOnActivation(subscription))
			) {
				await replacePredecessors(subscription, client);
			}
			await applyPaymentEvent(subscription, paypalEvent, now, {
				issueInvoice: (s, n, saleId, charged, transaction) =>
					issueInvoiceForPeriod(s, n, deps.mailSender, saleId, charged, transaction),
				issueCreditNote: (original, n, transaction) => issueCreditNote(original, n, transaction),
				// Paketentzug (#2237) kündigt auch das PayPal-Abo — der Client ist hier im Scope.
				cancelPaypal: () => client.cancel(subscription.get('externalSubscriptionId') as string),
			});
		},
		checkout: {
			create: (plan, period, firstCycleCents, startTime) => {
				// Aufgeschobener Start (#2049): Weiterführen/Downgrade nach Kündigung buchen erst ab
				// `startTime` ab — ohne Einrichtungsgebühr (`firstCycleCents` bleibt ungesetzt).
				if (startTime !== undefined) {
					return client.createSubscription(paypalPlanIdFor(plan, period), { startTime });
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
