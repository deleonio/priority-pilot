import { Op, type Transaction } from 'sequelize';
import Subscription, { OPEN_SUBSCRIPTION_STATUSES } from '../../models/subscription.js';
import User from '../../models/user.js';
import { PLAN_VALUES, type Plan } from '../plans.js';

/**
 * Anbieterneutraler Lebenszyklus eines Abos: vorgemerkter Paketwechsel, Kulanzfrist nach einem
 * fehlgeschlagenen Einzug und der Abgleich des Pakets am Nutzer. Die Anbieter (PayPal, ADR 0013;
 * Google Play, ADR 0017) übersetzen ihre Ereignisse hierauf.
 */

/** Kulanzfrist nach dem ersten fehlgeschlagenen Einzug, in Tagen (AK7). */
export const GRACE_PERIOD_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rang eines Pakets in der Paketreihenfolge (`PLAN_VALUES`) — Grundlage für „Upgrade oder Downgrade?". */
export const rankOf = (plan: string): number => PLAN_VALUES.indexOf(plan as Plan);

/**
 * Gleicht das für die Durchsetzung maßgebliche Paket am Nutzer ab (#1462, T7 AK3). Alle Guards
 * lesen `User.plan` (`express/planGuard.ts`, `express/apiTokenAuth.ts`, `routes/auth.ts`), nicht
 * `Subscription.plan` — ohne diesen Abgleich bliebe eine Kündigung für die Durchsetzung wirkungslos.
 * Bewusst nur ein Spaltenwechsel: es wird kein Datensatz gelöscht, gesperrt wird allein der
 * Schreibzugriff. Ein Downgrade auf `free` unterbleibt, solange ein bezahltes offenes Abo eines
 * anderen Anbieters besteht (#2240).
 */
export const syncUserPlan = async (
	subscription: Subscription,
	plan: Plan,
	transaction?: Transaction,
): Promise<void> => {
	const userId = subscription.get('userId') as number | null | undefined;
	if (!userId) {
		return;
	}
	if (
		plan === 'free' &&
		(await Subscription.count({
			where: {
				userId,
				provider: { [Op.ne]: subscription.get('provider') },
				status: OPEN_SUBSCRIPTION_STATUSES.filter((status) => status !== 'approval_pending'),
			},
			transaction,
		}))
	) {
		return;
	}
	await User.update({ plan }, { where: { id: userId }, transaction });
};

/**
 * Wendet einen fälligen, vorgemerkten Paketwechsel an (AK4): ist `pendingPlanEffectiveAt` erreicht,
 * wird `pendingPlan` zum aktiven Paket, ein vorgemerkter Zeitraum (`pendingPeriod`) gleichzeitig
 * mit übernommen und die Vormerkung gelöscht.
 *
 * Bewusst beim Lesen des Abos aufgerufen (statt über einen eigenen wiederkehrenden Lauf): der
 * Wechsel wirkt genau dann, wenn der Zustand gebraucht wird, und hängt nicht daran, dass der Anbieter
 * zufällig ein weiteres Ereignis schickt. Ohne fällige Vormerkung ist der Aufruf ein No-Op.
 */
export const applyDuePendingPlan = async (
	subscription: Subscription,
	now: Date,
	transaction?: Transaction,
): Promise<boolean> => {
	const pendingPlan = subscription.get('pendingPlan') as string | null | undefined;
	const pendingPeriod = subscription.get('pendingPeriod') as string | null | undefined;
	const effectiveAt = subscription.get('pendingPlanEffectiveAt') as Date | string | null | undefined;
	if (!pendingPlan || !effectiveAt || new Date(effectiveAt).getTime() > now.getTime()) {
		return false;
	}
	await subscription.update(
		{
			plan: pendingPlan,
			...(pendingPeriod ? { period: pendingPeriod } : {}),
			pendingPlan: null,
			pendingPeriod: null,
			pendingPlanEffectiveAt: null,
		},
		{ transaction },
	);
	await syncUserPlan(subscription, pendingPlan as Plan, transaction);
	return true;
};

/**
 * Ob die Kulanzfrist nach dem ersten fehlgeschlagenen Einzug abgelaufen ist (AK7). Tag 15 ist noch
 * innerhalb der Frist, ab Tag 16 ist sie abgelaufen — der Zugang wird erst dann eingeschränkt.
 */
export const isGracePeriodExpired = (firstFailureAt: Date, now: Date): boolean =>
	now.getTime() - firstFailureAt.getTime() > GRACE_PERIOD_DAYS * DAY_MS;

/** Abhängigkeiten der Kulanzfrist: Kündigung beim Anbieter (nur PayPal), in Tests ein Fake. */
export interface GracePeriodDeps {
	cancel?: (externalSubscriptionId: string) => Promise<void>;
}

/**
 * Wendet eine fällige Kulanzfrist an (AK6, T6e/#1506; Entzug #2234): ist `firstFailureAt` gesetzt und
 * {@link isGracePeriodExpired}, wird ein PayPal-Abo gekündigt (damit keine späte Abbuchung kommt),
 * `User.plan` und `Subscription.plan` fallen auf `free`, `status: 'grace_expired'` gesetzt und `firstFailureAt` zurückgesetzt.
 * Ein fehlschlagender Kündigungsaufruf verhindert den Entzug nicht (Warnung im Log). Nutzerdaten
 * bleiben unangetastet (siehe {@link syncUserPlan}).
 *
 * Beim Lesen des Abos (Muster `applyDuePendingPlan`) und im täglichen Sweep
 * ({@link applyDueGracePeriods}). Ohne fällige Frist ein No-Op.
 */
export const applyDueGracePeriod = async (
	subscription: Subscription,
	now: Date,
	deps: GracePeriodDeps = {},
): Promise<boolean> => {
	const firstFailureAt = subscription.get('firstFailureAt') as Date | string | null | undefined;
	if (!firstFailureAt || !isGracePeriodExpired(new Date(firstFailureAt), now)) {
		return false;
	}
	if (subscription.get('provider') === 'paypal' && deps.cancel) {
		try {
			await deps.cancel(subscription.get('externalSubscriptionId') as string);
		} catch (error) {
			console.warn('PayPal-Abo konnte nach Ablauf der Kulanzfrist nicht gekündigt werden.', error);
		}
	}
	await subscription.update({ plan: 'free', status: 'grace_expired', firstFailureAt: null });
	await syncUserPlan(subscription, 'free');
	return true;
};

/** Täglicher Sweep (#2234): wendet {@link applyDueGracePeriod} auf alle Abos mit gesetztem `firstFailureAt` an. */
export const applyDueGracePeriods = async (now: Date, deps: GracePeriodDeps = {}): Promise<number> => {
	const subscriptions = await Subscription.findAll({ where: { firstFailureAt: { [Op.ne]: null } } });
	let applied = 0;
	for (const subscription of subscriptions) {
		if (await applyDueGracePeriod(subscription, now, deps)) {
			applied += 1;
		}
	}
	return applied;
};
