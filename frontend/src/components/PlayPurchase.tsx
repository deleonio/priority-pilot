import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { checkAuth } from '../lib/auth';
import { planLabel, type Period, type Plan } from '../lib/planOffers';
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

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

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
	const [error, setError] = useState<string | null>(null);
	const [scheduledChange, setScheduledChange] = useState<string | null>(null);
	const [restoring, setRestoring] = useState(false);
	const [restored, setRestored] = useState<'done' | 'none' | 'failed' | null>(null);
	const { t } = useTranslation('messages');
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
				setError('Der Kauf ist bei Google eingegangen, konnte aber noch nicht freigeschaltet werden.');
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
				setError('Der Kauf über Google Play ist fehlgeschlagen.');
			} else if (!result && running && change?.replacementMode === 'DEFERRED') {
				setScheduledChange(`Wechsel zu ${planLabel(plan)} ab ${formatDate(running.currentPeriodEnd)}.`);
			}
		} catch {
			setError('Der Kauf über Google Play ist fehlgeschlagen.');
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
			// Ein abgelehnter Token hält die übrigen nicht auf; neu geladen wird trotzdem.
			let failed = false;
			for (const token of tokens) {
				await api.submitGooglePurchase(token).catch(() => (failed = true));
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
			return { text: 'Aktuelles Paket', node: <span>Aktuelles Paket</span> };
		}
		const offer = store ? playOfferFor(store, plan, period) : undefined;
		if (!offer) {
			return { text: '', node: null };
		}
		const changing = subscription !== null && subscription.plan !== 'free';
		const label = changing ? 'Wechseln' : 'Buchen';
		return {
			text: label,
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
					<KolAlert _type="warning" _label="Google Play nicht erreichbar">
						Die Pakete lassen sich gerade nicht laden. Bitte später erneut versuchen.
					</KolAlert>
				)}
				{error !== null && (
					<KolAlert _type="error" _label="Kauf fehlgeschlagen">
						{error}
					</KolAlert>
				)}
				{scheduledChange !== null && (
					<KolAlert _type="success" _label="Paketwechsel vorgemerkt">
						{scheduledChange}
					</KolAlert>
				)}
				{restored !== null && (
					<KolAlert
						_type={restored === 'done' ? 'success' : restored === 'none' ? 'info' : 'error'}
						_label={t('billing.restore.action')}
					>
						{t(`billing.restore.${restored}`)}
					</KolAlert>
				)}
				{store !== null && (
					<KolButton
						data-testid="restore-purchases"
						_label={restoring ? t('billing.restore.busy') : t('billing.restore.action')}
						_variant="secondary"
						_disabled={restoring}
						_on={{ onClick: () => void restore() }}
					/>
				)}
			</>
		),
	};
};
