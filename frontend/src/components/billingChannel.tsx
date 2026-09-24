import { KolAlert } from '@public-ui/react-v19';
import type { ReactNode } from 'react';
import type { Subscription } from '../lib/auth';
import type { Period, Plan } from '../lib/planOffers';
import type { Channel } from '../lib/platform';
import { usePlan } from '../lib/usePlan';
import { ManagedBy } from './ManagedBy';
import { usePaypalPurchase } from './PaypalPurchase';
import { usePlayPurchase } from './PlayPurchase';

/** Was die Paketansicht vom Kaufweg eines Kanals braucht. Sie kennt keinen Anbieter direkt. */
export interface PurchaseUi {
	/** Buchen-Zelle je Paket und Zeitraum (`text` ist der Sortier-/Filterwert); ohne Kaufweg keine Buchen-Zeilen. */
	actionCell?: (plan: Exclude<Plan, 'free'>, period: Period) => { text: string; node: ReactNode };
	/** Preis aus dem Store statt aus dem Katalog; ohne Angabe gilt der Katalogpreis. */
	price?: (plan: Exclude<Plan, 'free'>, period: Period) => string | undefined;
	/** Hinweise über der Paket-Matrix. */
	notice: ReactNode;
	/** Dialoge unter der Paket-Matrix. */
	dialog?: ReactNode;
}

/** App Store bis zum Kauf über StoreKit: Pakete ohne Kauf, kein Verweis auf den Web-Kauf (ADR 0016). */
const useNoInAppPurchase = (): PurchaseUi => ({
	notice: (
		<KolAlert _type="info" _label="Kauf in der App folgt" data-testid="store-purchase-notice">
			Die Pakete lassen sich bald direkt in der App buchen.
		</KolAlert>
	),
});

type Provider = Subscription['provider'];

/** Anbieter, über den ein Kanal kauft; im App Store gibt es noch keinen (ADR 0016). */
export const CHANNEL_PROVIDER: Record<Channel, Provider | undefined> = {
	web: 'paypal',
	play: 'google_play',
	appstore: undefined,
};

const CHANNEL_HOOKS: Record<Channel, () => PurchaseUi> = {
	web: usePaypalPurchase,
	play: usePlayPurchase,
	appstore: useNoInAppPurchase,
};

/**
 * Genau ein Kaufweg je Kanal (ADR 0016); PayPal gibt es nur im Kanal `web`. Läuft das Abo über
 * einen anderen Anbieter, bietet der Kanal nichts zum Kauf an, sondern zeigt, wo es verwaltet wird.
 */
export const purchaseHookFor = (channel: Channel): (() => PurchaseUi) => {
	const useChannelPurchase = CHANNEL_HOOKS[channel];
	return () => {
		const purchase = useChannelPurchase();
		const { subscription } = usePlan();
		if (!subscription || subscription.provider === CHANNEL_PROVIDER[channel]) {
			return purchase;
		}
		return { price: purchase.price, notice: <ManagedBy provider={subscription.provider} /> };
	};
};
