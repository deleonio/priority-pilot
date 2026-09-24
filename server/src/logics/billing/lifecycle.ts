import type Subscription from '../../models/subscription.js';
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
 * Schreibzugriff.
 */
export const syncUserPlan = async (subscription: Subscription, plan: Plan): Promise<void> => {
	const userId = subscription.get('userId') as number | null | undefined;
	if (!userId) {
		return;
	}
	await User.update({ plan }, { where: { id: userId } });
};

/**
 * Wendet einen fälligen, vorgemerkten Paketwechsel an (AK4): ist `pendingPlanEffectiveAt` erreicht,
 * wird `pendingPlan` zum aktiven Paket und die Vormerkung gelöscht.
 *
 * Bewusst beim Lesen des Abos aufgerufen (statt über einen eigenen wiederkehrenden Lauf): der
 * Wechsel wirkt genau dann, wenn der Zustand gebraucht wird, und hängt nicht daran, dass der Anbieter
 * zufällig ein weiteres Ereignis schickt. Ohne fällige Vormerkung ist der Aufruf ein No-Op.
 */
export const applyDuePendingPlan = async (subscription: Subscription, now: Date): Promise<boolean> => {
	const pendingPlan = subscription.get('pendingPlan') as string | null | undefined;
	const effectiveAt = subscription.get('pendingPlanEffectiveAt') as Date | string | null | undefined;
	if (!pendingPlan || !effectiveAt || new Date(effectiveAt).getTime() > now.getTime()) {
		return false;
	}
	await subscription.update({ plan: pendingPlan, pendingPlan: null, pendingPlanEffectiveAt: null });
	await syncUserPlan(subscription, pendingPlan as Plan);
	return true;
};

/**
 * Ob die Kulanzfrist nach dem ersten fehlgeschlagenen Einzug abgelaufen ist (AK7). Tag 15 ist noch
 * innerhalb der Frist, ab Tag 16 ist sie abgelaufen — der Zugang wird erst dann eingeschränkt.
 */
export const isGracePeriodExpired = (firstFailureAt: Date, now: Date): boolean =>
	now.getTime() - firstFailureAt.getTime() > GRACE_PERIOD_DAYS * DAY_MS;

/**
 * Wendet eine fällige Kulanzfrist an (AK6, T6e/#1506): ist `firstFailureAt` gesetzt und
 * {@link isGracePeriodExpired}, wird `status: 'grace_expired'` gesetzt und `firstFailureAt`
 * zurückgesetzt — `plan` bleibt unverändert (der Downgrade selbst ist T7, #1462).
 *
 * Bewusst beim Lesen des Abos aufgerufen (Muster `applyDuePendingPlan`). Ohne fällige Frist ein
 * No-Op.
 */
export const applyDueGracePeriod = async (subscription: Subscription, now: Date): Promise<boolean> => {
	const firstFailureAt = subscription.get('firstFailureAt') as Date | string | null | undefined;
	if (!firstFailureAt || !isGracePeriodExpired(new Date(firstFailureAt), now)) {
		return false;
	}
	await subscription.update({ status: 'grace_expired', firstFailureAt: null });
	return true;
};
