import type Subscription from '../../models/subscription.js';
import { verifyPubSubToken, type GoogleKeysSource } from '../googleOidc.js';
import { createGooglePlayClient, type GooglePlayClient, type PlaySubscription } from '../googlePlay.js';
import { planForPlayProduct, type Plan } from '../plans.js';
import { syncUserPlan } from './lifecycle.js';
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

/** `notificationType` einer RTDN, bei der Google das Abo zurückgebucht hat (Erstattung). */
const SUBSCRIPTION_REVOKED = 12;

/**
 * Paket, Zeitraum und ein zum Periodenende vorgemerkter Wechsel (#1696), wie Google sie meldet.
 * `undefined` für ein unbekanntes Produkt.
 */
export const playPlanFields = (
	purchase: Pick<PlaySubscription, 'productId' | 'basePlanId' | 'expiresAt' | 'deferred'>,
) => {
	const target = planForPlayProduct(purchase.productId, purchase.basePlanId);
	if (!target) {
		return undefined;
	}
	const pending = purchase.deferred && planForPlayProduct(purchase.deferred.productId, purchase.deferred.basePlanId);
	return {
		plan: target.plan,
		period: target.period,
		currentPeriodEnd: purchase.expiresAt,
		pendingPlan: pending ? pending.plan : null,
		pendingPlanEffectiveAt: pending ? purchase.expiresAt : null,
	};
};

/**
 * Wie der Stand eines Play-Abos aufs Abo wirkt (ADR 0017), über den vorhandenen Lebenszyklus:
 *
 * - `ACTIVE` (verlängert oder wieder aufgenommen): Paket und Periodenende wie bei Google, Kulanz und
 *   eine Kündigung zum Periodenende entfallen; ein Wechsel zum Periodenende bleibt vorgemerkt.
 * - `IN_GRACE_PERIOD`/`ON_HOLD`: Zahlung fehlgeschlagen, die Kulanz startet (`firstFailureAt`); nach
 *   ihrem Ablauf greift `applyDueGracePeriod`.
 * - `CANCELED`: gekündigt, aber bis zum Ablauf bezahlt; der Downgrade ist zum Periodenende vorgemerkt.
 * - `EXPIRED` oder zurückgebucht (`revoked`): sofort zurück auf `free`.
 *
 * Andere Stände (`PENDING`, `PAUSED`) ändern nichts.
 */
export const applyPlayState = async (
	subscription: Subscription,
	purchase: Pick<PlaySubscription, 'state' | 'productId' | 'basePlanId' | 'expiresAt' | 'deferred'>,
	revoked: boolean,
	now: Date,
): Promise<void> => {
	if (revoked || purchase.state === 'EXPIRED') {
		await subscription.update({
			plan: 'free',
			status: 'cancelled',
			currentPeriodEnd: revoked ? now : purchase.expiresAt,
			pendingPlan: null,
			pendingPlanEffectiveAt: null,
			firstFailureAt: null,
		});
		await syncUserPlan(subscription, 'free');
		return;
	}
	switch (purchase.state) {
		case 'ACTIVE':
			await subscription.update({
				status: 'active',
				firstFailureAt: null,
				currentPeriodEnd: purchase.expiresAt,
				pendingPlan: null,
				pendingPlanEffectiveAt: null,
				...playPlanFields(purchase),
			});
			await syncUserPlan(subscription, subscription.get('plan') as Plan);
			return;
		case 'IN_GRACE_PERIOD':
		case 'ON_HOLD':
			await subscription.update({
				status: purchase.state === 'ON_HOLD' ? 'suspended' : 'past_due',
				firstFailureAt: (subscription.get('firstFailureAt') as Date | null) ?? now,
			});
			return;
		case 'CANCELED':
			await subscription.update({
				status: 'cancelled',
				currentPeriodEnd: purchase.expiresAt,
				pendingPlan: 'free',
				pendingPlanEffectiveAt: purchase.expiresAt,
				firstFailureAt: null,
			});
	}
};

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
		applyEvent: async (subscription, event, now) => {
			const purchase = await client.getSubscription(event.externalSubscriptionId);
			const type = (event.payload as DeveloperNotification).subscriptionNotification?.notificationType;
			await applyPlayState(subscription, purchase, type === SUBSCRIPTION_REVOKED, now);
		},
	};
};
