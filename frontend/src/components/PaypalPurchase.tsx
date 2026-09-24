import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import type { Period, Plan } from '../lib/planOffers';
import { usePlan } from '../lib/usePlan';
import type { PurchaseUi } from './billingChannel';
import { BillingReturnWait, ChangeDialog } from './PaypalDialogs';

/**
 * Kaufweg im Kanal `web`: Buchen und Wechseln über die PayPal-Abo-Routen (#1505/#1506). Der
 * angezeigte Plan ändert sich erst, wenn `/auth/me` ihn liefert (#1496 AK3/AK4).
 */
export const usePaypalPurchase = (): PurchaseUi => {
	const { plan, subscription, refresh } = usePlan();
	const [bookingKey, setBookingKey] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [changeTarget, setChangeTarget] = useState<{ plan: Exclude<Plan, 'free'>; period: Period } | null>(null);
	const [pendingWait, setPendingWait] = useState<{ expectedPlan: Plan } | null>(null);

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
			return { text: 'Aktuelles Paket', node: <span>Aktuelles Paket</span> };
		}
		if (subscription === null) {
			return {
				text: 'Buchen',
				node: (
					<KolButton
						data-testid={`book-${targetPlan}-${period}`}
						_label="Buchen"
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
					_label="Wechseln"
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
			{pendingWait !== null && refresh !== undefined && (
				<BillingReturnWait refresh={refresh} expectedPlan={pendingWait.expectedPlan} currentPlan={plan} />
			)}
		</>
	);

	const dialog = changeTarget !== null && (
		<ChangeDialog
			targetPlan={changeTarget.plan}
			targetPeriod={changeTarget.period}
			onClose={() => setChangeTarget(null)}
			onChanged={(approvalUrl) => {
				const target = changeTarget;
				setChangeTarget(null);
				if (approvalUrl !== undefined) {
					window.location.href = approvalUrl;
					return;
				}
				setPendingWait({ expectedPlan: target.plan });
			}}
		/>
	);

	return { actionCell, notice, dialog };
};
