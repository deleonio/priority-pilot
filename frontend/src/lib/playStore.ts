/**
 * Zugriff auf Google Play Billing über `cordova-plugin-purchase` (ADR 0017). Das Plugin spielt
 * Capacitor in der App als globales `CdvPurchase` ein, auch im Remote-Modus; im Web fehlt es. Die
 * Typen hier sind der Ausschnitt, den die App nutzt.
 */

export interface PlayOffer {
	/** `<Produkt-ID>@<Base-Plan-ID>`, z. B. `pro@monthly`. */
	id: string;
	/** Lokalisierter Preis aus dem Store je Phase; die erste Phase ist der reguläre Preis. */
	pricingPhases: { price: string }[];
	order(data?: {
		googlePlay: { oldPurchaseToken: string; replacementMode: ReplacementMode };
	}): Promise<{ code: number; message: string } | undefined>;
}

export interface PlayTransaction {
	parentReceipt: { purchaseToken?: string };
	finish(): Promise<void>;
}

interface PlayStore {
	applicationUsername?: string;
	obfuscator?: 'disabled';
	register(products: { id: string; type: string; platform: string }[]): void;
	when(): { approved(callback: (transaction: PlayTransaction) => void): unknown };
	initialize(platforms: string[]): Promise<unknown>;
	get(productId: string, platform: string): { offers: PlayOffer[] } | undefined;
	restorePurchases(): Promise<{ code: number; message: string } | undefined>;
	localReceipts: { platform: string; purchaseToken?: string }[];
}

const PLATFORM = 'android-playstore';
const SUBSCRIPTION = 'paid subscription';

/** Fehlercode des Plugins, wenn der Nutzer den Store-Dialog schließt: kein Fehler für die Anzeige. */
export const PAYMENT_CANCELLED = 6777006;

/** Die Abo-Produkte in der Play Console, je Paket eines, aufsteigend (ADR 0017, `PLAY_PRODUCTS` im Server). */
const PRODUCT_IDS: readonly string[] = ['pro', 'max', 'ultimate'];

/** Replacement-Modes beim Paketwechsel, benannt wie im Plugin (`CdvPurchase.GooglePlay.ReplacementMode`). */
type ReplacementMode = 'IMMEDIATE_WITH_TIME_PRORATION' | 'DEFERRED';

const storeOf = (): PlayStore | undefined => (globalThis as { CdvPurchase?: { store?: PlayStore } }).CdvPurchase?.store;

/**
 * Richtet den Store einmal ein: Kontokennung (`obfuscatedAccountId`, bereits gehasht vom Server),
 * Produkte und der Rückweg für bestätigte Käufe. `undefined`, wenn das Plugin fehlt.
 */
export const initPlayStore = async (
	accountId: string,
	onApproved: (transaction: PlayTransaction) => void,
): Promise<PlayStore | undefined> => {
	const store = storeOf();
	if (!store) {
		return undefined;
	}
	store.applicationUsername = accountId;
	store.obfuscator = 'disabled';
	store.register(PRODUCT_IDS.map((id) => ({ id, type: SUBSCRIPTION, platform: PLATFORM })));
	store.when().approved(onApproved);
	await store.initialize([PLATFORM]);
	return store;
};

/** Das Store-Angebot zu Paket und Zeitraum, sofern der Store es kennt. */
export const playOfferFor = (store: PlayStore, plan: string, period: string): PlayOffer | undefined =>
	store.get(plan, PLATFORM)?.offers.find((offer) => offer.id === `${plan}@${period}`);

/** Liest die Käufe des Google-Kontos neu aus Google Play und liefert ihre Kauf-Tokens. */
export const restorePlayPurchases = async (store: PlayStore): Promise<string[]> => {
	const error = await store.restorePurchases();
	if (error) {
		throw new Error(error.message);
	}
	return store.localReceipts.flatMap((receipt) =>
		receipt.platform === PLATFORM && receipt.purchaseToken ? [receipt.purchaseToken] : [],
	);
};

/**
 * Wechsel des laufenden Play-Abos (#1696, ADR 0017): Ein größeres Paket gilt sofort und wird anteilig
 * verrechnet, alles andere ab der nächsten Verlängerung. `undefined`, wenn Google Play auf diesem
 * Gerät kein Abo kennt, das sich ersetzen ließe.
 */
export const playChangeFor = (
	store: PlayStore,
	currentPlan: string,
	targetPlan: string,
): { oldPurchaseToken: string; replacementMode: ReplacementMode } | undefined => {
	const oldPurchaseToken = store.localReceipts.find(
		(receipt) => receipt.platform === PLATFORM && receipt.purchaseToken,
	)?.purchaseToken;
	if (!oldPurchaseToken) {
		return undefined;
	}
	const upgrade = PRODUCT_IDS.indexOf(targetPlan) > PRODUCT_IDS.indexOf(currentPlan);
	return { oldPurchaseToken, replacementMode: upgrade ? 'IMMEDIATE_WITH_TIME_PRORATION' : 'DEFERRED' };
};
