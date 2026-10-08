import { KolAlert, KolButton } from '@public-ui/react-v19';
import { ResponseError } from 'client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import i18next from '../i18n/config';
import { checkAuth } from '../lib/auth';
import { periodLabel, planLabel, type Period, type Plan } from '../lib/planOffers';
import {
	initPlayStore,
	PAYMENT_CANCELLED,
	playChangeFor,
	playOfferFor,
	restorePlayPurchases,
	type PlayTransaction,
} from '../lib/playStore';
import { usePlan } from '../lib/usePlan';
import type { PurchaseUi } from './billingChannel';

type Store = NonNullable<Awaited<ReturnType<typeof initPlayStore>>>;

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(i18next.language);

/**
 * Kaufweg im Kanal `play` (#1692, ADR 0017): Preise und Kauf kommen aus Google Play. Nach dem Kauf
 * geht der Token an `POST /billing/google/purchase`; der Server prüft und bestätigt ihn, danach
 * werden die Entitlements neu geladen. Schließt der Nutzer den Store-Dialog, bleibt alles, wie es war.
 * „Käufe wiederherstellen" (#1695) meldet die vorhandenen Käufe des Google-Kontos erneut an den Server.
 * Mit laufendem Abo ersetzt ein Kauf das bisherige (#1696).
 */
export const usePlayPurchase = (): PurchaseUi => {
	const { subscription, refresh } = usePlan();
	const [store, setStore] = useState<Store | null>(null);
	const [unavailable, setUnavailable] = useState(false);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	// Schlüssel im Namespace `billing`, übersetzt erst beim Rendern.
	const [error, setError] = useState<string | null>(null);
	const [scheduledChange, setScheduledChange] = useState<{ plan: string; date: string } | null>(null);
	const [restoring, setRestoring] = useState(false);
	const [restored, setRestored] = useState<'done' | 'none' | 'failed' | null>(null);
	const { t } = useTranslation(['billing', 'messages']);
	const refreshRef = useRef(refresh);
	refreshRef.current = refresh;

	useEffect(() => {
		const onApproved = async (transaction: PlayTransaction): Promise<void> => {
			const token = transaction.parentReceipt.purchaseToken;
			if (!token) {
				return;
			}
			try {
				await api.submitGooglePurchase(token);
				await refreshRef.current?.();
				await transaction.finish();
			} catch {
				setError('play.unlockFailed');
			}
		};
		let active = true;
		void checkAuth()
			.then((user) => (user?.playAccountId ? initPlayStore(user.playAccountId, onApproved) : undefined))
			.then((ready) => {
				if (!active) return;
				if (ready) setStore(ready);
				else setUnavailable(true);
			})
			.catch(() => active && setUnavailable(true));
		return () => {
			active = false;
		};
	}, []);

	const buy = async (plan: Exclude<Plan, 'free'>, period: Period): Promise<void> => {
		const offer = store ? playOfferFor(store, plan, period) : undefined;
		if (!store || !offer) return;
		setError(null);
		setScheduledChange(null);
		setBusyKey(`${plan}-${period}`);
		const running = subscription && subscription.plan !== 'free' ? subscription : null;
		const change = running ? playChangeFor(store, running.plan, plan) : undefined;
		try {
			const result = await offer.order(change && { googlePlay: change });
			if (result && result.code !== PAYMENT_CANCELLED) {
				setError('play.purchaseFailed');
			} else if (!result && running && change?.replacementMode === 'DEFERRED') {
				setScheduledChange({ plan: planLabel(plan), date: formatDate(running.currentPeriodEnd) });
			}
		} catch {
			setError('play.purchaseFailed');
		} finally {
			setBusyKey(null);
		}
	};

	const restore = async (): Promise<void> => {
		if (!store) return;
		setRestored(null);
		setRestoring(true);
		try {
			const tokens = await restorePlayPurchases(store);
			// Ein abgelehnter Token hält die übrigen nicht auf; neu geladen wird trotzdem. 409 ist kein
			// Fehlschlag: Der Server lehnt genau diesen Kauf bewusst ab, etwa den alten Token, der nach
			// einem Wechsel zum Periodenende bis dahin noch bei Google aktiv ist (#1696).
			let failed = false;
			for (const token of tokens) {
				await api.submitGooglePurchase(token).catch((reason: unknown) => {
					if (!(reason instanceof ResponseError && reason.response.status === 409)) failed = true;
				});
			}
			if (tokens.length > 0) {
				await refresh?.();
			}
			setRestored(failed ? 'failed' : tokens.length > 0 ? 'done' : 'none');
		} catch {
			setRestored('failed');
		} finally {
			setRestoring(false);
		}
	};

	const actionCell = (plan: Exclude<Plan, 'free'>, period: Period) => {
		if (subscription === undefined) {
			return { text: '', node: null };
		}
		if (subscription !== null && subscription.plan === plan && subscription.period === period) {
			return { text: t('purchase.currentPlan'), node: <span>{t('purchase.currentPlan')}</span> };
		}
		const offer = store ? playOfferFor(store, plan, period) : undefined;
		if (!offer) {
			return { text: '', node: null };
		}
		const changing = subscription !== null && subscription.plan !== 'free';
		const text = changing ? t('purchase.change') : t('purchase.book');
		const label = t(changing ? 'purchase.changeLabel' : 'purchase.bookLabel', {
			plan: planLabel(plan),
			period: periodLabel(period),
		});
		return {
			text,
			node: (
				<KolButton
					data-testid={`${changing ? 'change-plan' : 'book'}-${plan}-${period}`}
					_label={label}
					_variant={changing ? 'secondary' : 'primary'}
					_disabled={busyKey === `${plan}-${period}`}
					_on={{ onClick: () => void buy(plan, period) }}
				/>
			),
		};
	};

	return {
		actionCell,
		price: (plan, period) => (store ? playOfferFor(store, plan, period)?.pricingPhases[0]?.price : undefined),
		notice: (
			<>
				{unavailable && (
					<KolAlert _type="warning" _label={t('play.unavailableLabel')}>
						{t('play.unavailableText')}
					</KolAlert>
				)}
				{error !== null && (
					<KolAlert _type="error" _label={t('play.errorLabel')}>
						{t(error)}
					</KolAlert>
				)}
				{scheduledChange !== null && (
					<KolAlert _type="success" _label={t('play.scheduledLabel')}>
						{t('play.scheduledChange', scheduledChange)}
					</KolAlert>
				)}
				{restored !== null && (
					<KolAlert
						_type={restored === 'done' ? 'success' : restored === 'none' ? 'info' : 'error'}
						_label={t('messages:billing.restore.action')}
					>
						{t(`messages:billing.restore.${restored}`)}
					</KolAlert>
				)}
				{store !== null && (
					<KolButton
						data-testid="restore-purchases"
						_label={restoring ? t('messages:billing.restore.busy') : t('messages:billing.restore.action')}
						_variant="secondary"
						_disabled={restoring}
						_on={{ onClick: () => void restore() }}
					/>
				)}
			</>
		),
	};
};
