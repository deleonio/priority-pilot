import { KolAlert } from '@public-ui/react-v19';
import type { ReactNode } from 'react';
import type { Period, Plan } from '../lib/planOffers';
import type { Channel } from '../lib/platform';
import { usePaypalPurchase } from './PaypalPurchase';

/** Was die Paketansicht vom Kaufweg eines Kanals braucht. Sie kennt keinen Anbieter direkt. */
export interface PurchaseUi {
	/** Buchen-Zelle je Paket und Zeitraum (`text` ist der Sortier-/Filterwert); ohne Kaufweg keine Buchen-Zeilen. */
	actionCell?: (plan: Exclude<Plan, 'free'>, period: Period) => { text: string; node: ReactNode };
	/** Hinweise über der Paket-Matrix. */
	notice: ReactNode;
	/** Dialoge unter der Paket-Matrix. */
	dialog?: ReactNode;
}

/** Store-Kanäle bis zum Kauf über Google Play (Stufe 2): Pakete ohne Kauf, kein Verweis auf den Web-Kauf (ADR 0016). */
const useNoInAppPurchase = (): PurchaseUi => ({
	notice: (
		<KolAlert _type="info" _label="Kauf in der App folgt" data-testid="store-purchase-notice">
			Die Pakete lassen sich bald direkt in der App buchen.
		</KolAlert>
	),
});

/** Genau ein Kaufweg je Kanal (ADR 0016); PayPal gibt es nur im Kanal `web`. */
export const purchaseHookFor = (channel: Channel): (() => PurchaseUi) => {
	switch (channel) {
		case 'web':
			return usePaypalPurchase;
		case 'play':
		case 'appstore':
			return useNoInAppPurchase;
	}
};
