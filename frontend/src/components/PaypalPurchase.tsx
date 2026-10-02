import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { PERIOD_LABELS, planLabel, type Period, type Plan } from '../lib/planOffers';
import { usePlan } from '../lib/usePlan';
import type { PurchaseUi } from './billingChannel';
import { BillingReturnWait, ChangeDialog } from './PaypalDialogs';

/** Zeitpunkte im Weiterführen-Label als „TT.MM.JJJJ" (Muster `SubscriptionSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

/**
 * Kaufweg im Kanal `web`: Buchen und Wechseln über die PayPal-Abo-Routen (#1505/#1506). Der
 * angezeigte Plan ändert sich erst, wenn `/auth/me` ihn liefert (#1496 AK3/AK4).
 */
export const usePaypalPurchase = (): PurchaseUi => {
	const { plan, subscription, refresh } = usePlan();
	const [bookingKey, setBookingKey] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [changeTarget, setChangeTarget] = useState<{ plan: Exclude<Plan, 'free'>; period: Period } | null>(null);
	// Nach dem Wechsel ohne `approvalUrl`: Upgrade → auf Plan-Bestätigung pollen; sonst Hinweis auf
	// die Wirkung zum Periodenende — ein Plan-Poll liefe bei Downgrade/Zeitraumwechsel in den Timeout.
	const [pendingWait, setPendingWait] = useState<{ kind: 'poll'; expectedPlan: Plan } | { kind: 'deferred' } | null>(
		null,
	);

	// Gekündigt mit Restlaufzeit (#2049): die Zeile des eigenen Pakets führt das Abo ab dem
	// Periodenende fort — der einzige Einstieg für „Abo weiterführen", das Startdatum steht im Label.
	const resumable =
		subscription !== null &&
		subscription !== undefined &&
		subscription.status === 'cancelled' &&
		new Date(subscription.currentPeriodEnd).getTime() > Date.now();

	const handleBook = async (targetPlan: Exclude<Plan, 'free'>, period: Period): Promise<void> => {
		const key = `${targetPlan}-${period}`;
		setActionError(null);
		setBookingKey(key);
		try {
			const { approvalUrl } = await api.createBillingSubscription({ plan: targetPlan, period });
			if (approvalUrl !== undefined) {
				window.location.href = approvalUrl;
				return;
			}
		} catch (reason) {
			setActionError((await toApiError(reason)).message);
		} finally {
			setBookingKey(null);
		}
	};

	const actionCell = (targetPlan: Exclude<Plan, 'free'>, period: Period) => {
		// `undefined` heißt „Abo-Status noch nicht geladen" (usePlanState hat /auth/me noch nicht
		// beantwortet) — bis dahin lieber keine Aktion zeigen als fälschlich „Buchen" (kein Abo) oder
		// „Wechseln" (Abo vorhanden) zu behaupten.
		if (subscription === undefined) {
			return { text: '', node: null };
		}
		if (subscription !== null && subscription.plan === targetPlan && subscription.period === period) {
			if (resumable) {
				const key = `${targetPlan}-${period}`;
				return {
					text: 'Weiterführen',
					node: (
						<KolButton
							data-testid={`resume-${targetPlan}-${period}`}
							_label={
								bookingKey === key
									? 'Wird weitergeführt…'
									: `${planLabel(targetPlan)} weiterführen ab ${formatDate(subscription.currentPeriodEnd)}`
							}
							_variant="secondary"
							_disabled={bookingKey === key}
							_on={{ onClick: () => void handleBook(targetPlan, period) }}
						/>
					),
				};
			}
			return { text: 'Aktuelles Paket', node: <span>Aktuelles Paket</span> };
		}
		if (subscription === null) {
			return {
				text: 'Buchen',
				node: (
					<KolButton
						data-testid={`book-${targetPlan}-${period}`}
						_label={`${planLabel(targetPlan)} buchen (${PERIOD_LABELS[period]})`}
						_variant="primary"
						_disabled={bookingKey === `${targetPlan}-${period}`}
						_on={{ onClick: () => void handleBook(targetPlan, period) }}
					/>
				),
			};
		}
		return {
			text: 'Wechseln',
			node: (
				<KolButton
					data-testid={`change-plan-${targetPlan}-${period}`}
					_label={`${planLabel(targetPlan)} wechseln (${PERIOD_LABELS[period]})`}
					_variant="secondary"
					_on={{ onClick: () => setChangeTarget({ plan: targetPlan, period }) }}
				/>
			),
		};
	};

	const notice = (
		<>
			{actionError !== null && (
				<KolAlert _type="error" _label="Buchung fehlgeschlagen">
					{actionError}
				</KolAlert>
			)}
			{pendingWait?.kind === 'deferred' && (
				<KolAlert _type="info" _alert _label="Wechsel vorgemerkt">
					Wechsel bei PayPal eingereicht — er wird mit der nächsten Abrechnung wirksam.
				</KolAlert>
			)}
			{pendingWait?.kind === 'poll' && refresh !== undefined && (
				<BillingReturnWait refresh={refresh} expectedPlan={pendingWait.expectedPlan} currentPlan={plan} />
			)}
		</>
	);

	const dialog = changeTarget !== null && (
		<ChangeDialog
			targetPlan={changeTarget.plan}
			targetPeriod={changeTarget.period}
			onClose={() => setChangeTarget(null)}
			onChanged={(approvalUrl, immediate) => {
				const target = changeTarget;
				setChangeTarget(null);
				if (approvalUrl !== undefined) {
					window.location.href = approvalUrl;
					return;
				}
				setPendingWait(immediate ? { kind: 'poll', expectedPlan: target.plan } : { kind: 'deferred' });
				// Ein Refresh holt den serverseitig sofort wirksamen Zeitraumwechsel in die Anzeige
				// (Review #1998) — ohne ihn stünde die alte Periode bis zum nächsten Fokus-Refresh.
				if (!immediate) void refresh?.();
			}}
		/>
	);

	return { actionCell, notice, dialog };
};
