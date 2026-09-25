import { Router } from 'express';
import type { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { Subscription } from '../../models/index.js';
import { OPEN_SUBSCRIPTION_STATUSES } from '../../models/subscription.js';
import { syncUserPlan } from '../../logics/billing/lifecycle.js';
import {
	acknowledgeIfPending,
	createGooglePlayClient,
	GooglePlayError,
	playAccountIdFor,
	type GooglePlayClient,
} from '../../logics/googlePlay.js';
import { planForPlayProduct } from '../../logics/plans.js';
import { getUserId } from '../requireAuth.js';
import { sendError, type ErrorDto } from '../http-error.js';

/**
 * Kauf in der Android-App (#1687, ADR 0017): Die App schickt den Kauf-Token, der Server liest den Kauf
 * bei Google, ordnet ihn über `obfuscatedAccountId` dem angemeldeten Nutzer zu, bestätigt ihn und
 * schaltet das Paket frei. Hinter Session und CSRF. Einen fremden Kauf bestätigt er nicht, Google
 * erstattet ihn dann nach drei Tagen.
 */

export interface BillingGoogleDeps {
	/** Injizierbarer Play-Client — Tests injizieren einen Fake (Muster `paypalClient`). */
	googlePlayClient?: GooglePlayClient;
}

const PROVIDER = 'google_play';

/** Abo-Zustände bei Google, in denen das gekaufte Paket gilt. */
const ACTIVE_STATES = ['ACTIVE', 'IN_GRACE_PERIOD'];

const STATUS_FOR_ERROR: Record<GooglePlayError['kind'], number> = {
	invalid: 400,
	unavailable: 503,
	not_configured: 503,
};

export const createBillingGoogleRouter = (deps: BillingGoogleDeps = {}): Router => {
	const router = Router();
	const client = deps.googlePlayClient ?? createGooglePlayClient();

	router.post('/billing/google/purchase', async (req: Request, res: Response<ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		if (req.get('X-Client-Channel') !== 'play') {
			sendError(res, 409, 'Käufe über Google Play gibt es nur in der Android-App.');
			return;
		}
		const purchaseToken = (req.body as { purchaseToken?: unknown } | undefined)?.purchaseToken;
		if (typeof purchaseToken !== 'string' || purchaseToken === '') {
			sendError(res, 400, 'purchaseToken fehlt.');
			return;
		}

		// Höchstens ein laufendes Abo über alle Anbieter (#1690, ADR 0016): der Kauf wird dann nicht bestätigt.
		const running = await Subscription.findOne({ where: { userId, status: OPEN_SUBSCRIPTION_STATUSES } });
		if (running && running.get('provider') !== PROVIDER) {
			sendError(res, 409, 'Es läuft bereits ein Abo über einen anderen Anbieter.');
			return;
		}

		// Derselbe Kauf ein zweites Mal (Wiederholung, „Käufe wiederherstellen“): kein zweites Abo.
		const answerKnown = async (): Promise<boolean> => {
			const known = await Subscription.findOne({
				where: { provider: PROVIDER, externalSubscriptionId: purchaseToken },
			});
			if (!known) return false;
			if (known.get('userId') !== userId) {
				sendError(res, 403, 'Der Kauf gehört zu einem anderen Konto.');
			} else {
				res.status(204).end();
			}
			return true;
		};
		if (await answerKnown()) {
			return;
		}

		try {
			const purchase = await client.getSubscription(purchaseToken);
			if (purchase.obfuscatedAccountId !== playAccountIdFor(userId)) {
				sendError(res, 403, 'Der Kauf gehört zu einem anderen Konto.');
				return;
			}
			const target = planForPlayProduct(purchase.productId, purchase.basePlanId);
			if (!target) {
				sendError(res, 400, 'Unbekanntes Abo-Produkt.');
				return;
			}
			if (!ACTIVE_STATES.includes(purchase.state)) {
				sendError(res, 409, 'Der Kauf ist nicht aktiv.');
				return;
			}
			await acknowledgeIfPending(client, purchase, purchaseToken);
			const subscription = await Subscription.create({
				userId,
				provider: PROVIDER,
				externalSubscriptionId: purchaseToken,
				plan: target.plan,
				period: target.period,
				status: 'active',
				currentPeriodEnd: purchase.expiresAt,
			});
			await syncUserPlan(subscription, target.plan);
			res.status(204).end();
		} catch (error) {
			if (error instanceof GooglePlayError) {
				sendError(res, STATUS_FOR_ERROR[error.kind], error.message);
				return;
			}
			// Derselbe Token gleichzeitig eingereicht: der zweite Aufruf trifft den Unique-Index.
			if (error instanceof UniqueConstraintError && (await answerKnown())) {
				return;
			}
			throw error;
		}
	});

	return router;
};
