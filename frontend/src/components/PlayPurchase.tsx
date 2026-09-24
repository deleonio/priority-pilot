import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { checkAuth } from '../lib/auth';
import type { Period, Plan } from '../lib/planOffers';
import { initPlayStore, PAYMENT_CANCELLED, playOfferFor, type PlayTransaction } from '../lib/playStore';
import { usePlan } from '../lib/usePlan';
import type { PurchaseUi } from './billingChannel';

type Store = NonNullable<Awaited<ReturnType<typeof initPlayStore>>>;

/**
 * Kaufweg im Kanal `play` (#1692, ADR 0017): Preise und Kauf kommen aus Google Play. Nach dem Kauf
 * geht der Token an `POST /billing/google/purchase`; der Server prüft und bestätigt ihn, danach
 * werden die Entitlements neu geladen. Schließt der Nutzer den Store-Dialog, bleibt alles, wie es war.
 */
export const usePlayPurchase = (): PurchaseUi => {
	const { subscription, refresh } = usePlan();
	const [store, setStore] = useState<Store | null>(null);
	const [unavailable, setUnavailable] = useState(false);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
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
		if (!offer) return;
		setError(null);
		setBusyKey(`${plan}-${period}`);
		try {
			const result = await offer.order();
			if (result && result.code !== PAYMENT_CANCELLED) {
				setError('Der Kauf über Google Play ist fehlgeschlagen.');
			}
		} catch {
			setError('Der Kauf über Google Play ist fehlgeschlagen.');
		} finally {
			setBusyKey(null);
		}
	};

	const actionCell = (plan: Exclude<Plan, 'free'>, period: Period) => {
		if (subscription === undefined) {
			return { text: '', node: null };
		}
		if (subscription !== null && subscription.plan === plan && subscription.period === period) {
			return { text: 'Aktuelles Paket', node: <span>Aktuelles Paket</span> };
		}
		const offer = store && subscription === null ? playOfferFor(store, plan, period) : undefined;
		if (!offer) {
			return { text: '', node: null };
		}
		return {
			text: 'Buchen',
			node: (
				<KolButton
					data-testid={`book-${plan}-${period}`}
					_label="Buchen"
					_variant="primary"
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
			</>
		),
	};
};
