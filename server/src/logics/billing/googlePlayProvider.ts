import { verifyPubSubToken, type GoogleKeysSource } from '../googleOidc.js';
import { createGooglePlayClient, type GooglePlayClient } from '../googlePlay.js';
import type { BillingProvider } from './provider.js';

/** Injizierbare Teile; ohne Angabe gelten die echten Google-Aufrufe. */
interface GooglePlayProviderDeps {
	client?: GooglePlayClient;
	keys?: GoogleKeysSource;
}

/** Pub/Sub-Push: die RTDN liegt Base64-kodiert in `message.data`. */
interface PubSubPush {
	message?: { messageId?: string; data?: string };
}

interface DeveloperNotification {
	subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
	testNotification?: unknown;
}

/**
 * Google Play als Abo-Anbieter (ADR 0017): Ereignisse kommen als Real-time Developer Notification
 * über Pub/Sub. Sie tragen nur Art und Kauf-Token; den Stand des Abos holt der Server danach selbst
 * über die Play Developer API. Gekauft wird in der App, nicht im Web.
 */
export const createGooglePlayProvider = (deps: GooglePlayProviderDeps = {}): BillingProvider => {
	const client = deps.client ?? createGooglePlayClient();
	return {
		id: 'google_play',
		invalidEventStatus: 401,
		verifyEvent: (_rawBody, headers) => verifyPubSubToken(headers.authorization, deps.keys),
		parseEvent: (rawBody) => {
			let push: PubSubPush;
			let notification: DeveloperNotification;
			try {
				push = JSON.parse(rawBody.toString('utf8')) as PubSubPush;
				notification = JSON.parse(
					Buffer.from(push.message?.data ?? '', 'base64').toString('utf8'),
				) as DeveloperNotification;
			} catch {
				return null;
			}
			const subscription = notification.subscriptionNotification;
			return {
				id: push.message?.messageId ?? '',
				type: subscription
					? `SUBSCRIPTION_${subscription.notificationType ?? 0}`
					: notification.testNotification
						? 'TEST'
						: 'OTHER',
				externalSubscriptionId: subscription?.purchaseToken ?? '',
				payload: notification,
			};
		},
		// Die Auswirkung auf Paket, Kulanz und Downgrade folgt im Lebenszyklus; hier nur der aktuelle Stand.
		applyEvent: async (subscription, event) => {
			const purchase = await client.getSubscription(event.externalSubscriptionId);
			await subscription.update({ currentPeriodEnd: purchase.expiresAt });
		},
	};
};
