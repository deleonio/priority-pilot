import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import i18next from '../i18n/config';
import { toApiError } from '../lib/apiError';
import { periodLabel, planLabel, type Period, type Plan } from '../lib/planOffers';
import { usePlan } from '../lib/usePlan';
import type { PurchaseUi } from './billingChannel';
import { CheckoutDialog } from './CheckoutDialog';
import { BillingReturnWait, ChangeDialog } from './PaypalDialogs';

/** Zeitpunkte im Weiterführen-Label als „TT.MM.JJJJ“ (Muster `SubscriptionSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(i18next.language);

/**
 * Kaufweg im Kanal `web`: Bestellen und Wechseln über die PayPal-Abo-Routen (#1505/#1506). Der
 * angezeigte Plan ändert sich erst, wenn `/auth/me` ihn liefert (#1496 AK3/AK4). Der Bestell-Knopf
 * öffnet erst den Checkout-Dialog (#2661): Rechnungsadresse und Widerrufs-Zustimmung werden dort
 * gesammelt, bevor es zum Zahlungsanbieter geht.
 */
export const usePaypalPurchase = (): PurchaseUi => {
	const { t } = useTranslation(['billing', 'messages']);
	const { plan, subscription, refresh } = usePlan();
	const [bookingKey, setBookingKey] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [orderTarget, setOrderTarget] = useState<{ plan: Exclude<Plan, 'free'>; period: Period } | null>(null);
	const [changeTarget, setChangeTarget] = useState<{ plan: Exclude<Plan, 'free'>; period: Period } | null>(null);
	// Nach dem Wechsel ohne `approvalUrl`: Upgrade → auf Plan-Bestätigung pollen; sonst Hinweis auf
	// die Wirkung zum Periodenende — ein Plan-Poll liefe bei Downgrade/Zeitraumwechsel in den Timeout.
	const [pendingWait, setPendingWait] = useState<{ kind: 'poll'; expectedPlan: Plan } | { kind: 'deferred' } | null>(
		null,
	);

	// Gekündigt mit Restlaufzeit (#2049): die Zeile des eigenen Pakets führt das Abo ab dem
	// Periodenende fort — der einzige Einstieg für „Abo weiterführen“, das Startdatum steht im Label.
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
			const { approvalUrl } = await api.createBillingSubscription({
				plan: targetPlan,
				period,
				withdrawalConsent: true,
			});
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
		// `undefined` heißt „Abo-Status noch nicht geladen“ (usePlanState hat /auth/me noch nicht
		// beantwortet) — bis dahin lieber keine Aktion zeigen als fälschlich „Bestellen“ (kein Abo)
		// oder „Wechseln“ (Abo vorhanden) zu behaupten.
		if (subscription === undefined) {
			return { text: '', node: null };
		}
		// Ein offener Checkout ist kein Paket (#2235): es gilt das bezahlte bzw. „Bestellen“.
		const paid = subscription?.status === 'approval_pending' ? null : subscription;
		if (paid !== null && paid.plan === targetPlan && paid.period === period) {
			if (resumable) {
				const key = `${targetPlan}-${period}`;
				return {
					text: t('paypal.resume'),
					node: (
						<KolButton
							data-testid={`resume-${targetPlan}-${period}`}
							_label={
								bookingKey === key
									? t('paypal.resumeBusy')
									: t('paypal.resumeLabel', {
											plan: planLabel(targetPlan),
											date: formatDate(subscription.currentPeriodEnd),
										})
							}
							_variant="secondary"
							_disabled={bookingKey === key}
							_on={{ onClick: () => void handleBook(targetPlan, period) }}
						/>
					),
				};
			}
			return { text: t('purchase.currentPlan'), node: <span>{t('purchase.currentPlan')}</span> };
		}
		if (paid === null) {
			return {
				// #2661: der Paket-Knopf heißt schlicht „Bestellen“ und öffnet den Checkout-Dialog.
				text: t('purchase.order'),
				node: (
					<KolButton
						data-testid={`book-${targetPlan}-${period}`}
						_label={t('purchase.order')}
						_variant="primary"
						_on={{ onClick: () => setOrderTarget({ plan: targetPlan, period }) }}
					/>
				),
			};
		}
		return {
			text: t('purchase.change'),
			node: (
				<KolButton
					data-testid={`change-plan-${targetPlan}-${period}`}
					_label={t('purchase.changeLabel', { plan: planLabel(targetPlan), period: periodLabel(period) })}
					_variant="secondary"
					_on={{ onClick: () => setChangeTarget({ plan: targetPlan, period }) }}
				/>
			),
		};
	};

	const notice = (
		<>
			{actionError !== null && (
				<KolAlert _type="error" _label={t('paypal.bookingFailed')}>
					{actionError}
				</KolAlert>
			)}
			{pendingWait?.kind === 'deferred' && (
				<KolAlert _type="info" _alert _label={t('paypal.deferredLabel')}>
					{t('paypal.deferredText')}
				</KolAlert>
			)}
			{pendingWait?.kind === 'poll' && refresh !== undefined && (
				<BillingReturnWait refresh={refresh} expectedPlan={pendingWait.expectedPlan} currentPlan={plan} />
			)}
		</>
	);

	// Bestell-Dialog (#2661): Rechnungsadresse + Widerruf vor dem Zahlungsanbieter.
	const dialog = (
		<>
			{orderTarget !== null && (
				<CheckoutDialog
					targetPlan={orderTarget.plan}
					targetPeriod={orderTarget.period}
					onClose={() => setOrderTarget(null)}
					onOrder={() => handleBook(orderTarget.plan, orderTarget.period)}
				/>
			)}
			{changeTarget !== null && (
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
			)}
		</>
	);

	return { actionCell, notice, dialog };
};
