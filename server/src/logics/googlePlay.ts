import { createAccessTokenSource, readServiceAccount } from './googleAuth.js';

/**
 * Play Developer API für Abo-Käufe aus der Android-App (ADR 0017): Kauf lesen
 * (`purchases.subscriptionsv2.get`) und bestätigen (`acknowledge`). `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE`
 * zeigt auf die JSON-Schlüsseldatei eines Service-Accounts, der in der Play Console Zugriff auf die
 * App hat. Ohne Konfiguration startet der Server normal; erst ein Aufruf meldet `not_configured`.
 */

const PACKAGE_NAME = 'de.balamentum.app';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases`;

/** Der Beleg taugt nicht (`invalid`), Google ist gerade nicht erreichbar (`unavailable`) oder der Server ist nicht eingerichtet (`not_configured`). */
type PlayErrorKind = 'invalid' | 'unavailable' | 'not_configured';

export class GooglePlayError extends Error {
	constructor(
		readonly kind: PlayErrorKind,
		message: string,
	) {
		super(message);
		this.name = 'GooglePlayError';
	}
}

/** Das Abo hinter einem Kauf-Token, soweit Zuordnung und Freischaltung es brauchen. */
interface PlaySubscription {
	productId: string;
	basePlanId: string;
	expiresAt: Date;
	/** `SUBSCRIPTION_STATE_*` der API, z. B. `ACTIVE`, `IN_GRACE_PERIOD`, `ON_HOLD`, `CANCELED`, `EXPIRED`. */
	state: string;
	acknowledged: boolean;
	/** Beim Kauf gesetzte Kontokennung, darüber wird der Kauf dem Nutzer zugeordnet. */
	obfuscatedAccountId?: string;
}

interface SubscriptionPurchaseV2 {
	subscriptionState?: string;
	acknowledgementState?: string;
	externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
	lineItems?: { productId?: string; expiryTime?: string; offerDetails?: { basePlanId?: string } }[];
}

export interface GooglePlayClient {
	getSubscription(purchaseToken: string): Promise<PlaySubscription>;
	acknowledge(productId: string, purchaseToken: string): Promise<void>;
}

/** 5xx und Drosselung sind vorübergehend, 401/403 heißen fehlende Rechte des Service-Accounts. */
const kindForStatus = (status: number): PlayErrorKind => {
	if (status >= 500 || status === 429) return 'unavailable';
	if (status === 401 || status === 403) return 'not_configured';
	return 'invalid';
};

const toSubscription = (purchase: SubscriptionPurchaseV2): PlaySubscription => {
	const item = purchase.lineItems?.[0];
	if (!item?.productId || !item.offerDetails?.basePlanId || !item.expiryTime) {
		throw new GooglePlayError('invalid', 'Der Kauf enthält kein Abo-Produkt.');
	}
	return {
		productId: item.productId,
		basePlanId: item.offerDetails.basePlanId,
		expiresAt: new Date(item.expiryTime),
		state: (purchase.subscriptionState ?? '').replace('SUBSCRIPTION_STATE_', ''),
		acknowledged: purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
		obfuscatedAccountId: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId,
	};
};

export const createGooglePlayClient = (): GooglePlayClient => {
	let tokenSource: { file: string; next: () => Promise<string> } | undefined;

	const accessToken = async (): Promise<string> => {
		const file = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE?.trim();
		if (!file) {
			throw new GooglePlayError('not_configured', 'GOOGLE_PLAY_SERVICE_ACCOUNT_FILE ist nicht gesetzt.');
		}
		if (tokenSource?.file !== file) {
			try {
				tokenSource = { file, next: createAccessTokenSource(readServiceAccount(file), SCOPE) };
			} catch {
				throw new GooglePlayError('not_configured', `Service-Account ${file} ist nicht lesbar.`);
			}
		}
		try {
			return await tokenSource.next();
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode;
			throw new GooglePlayError(
				status === undefined || status >= 500 ? 'unavailable' : 'not_configured',
				'Anmeldung bei Google fehlgeschlagen.',
			);
		}
	};

	const call = async (url: string, init: RequestInit = {}): Promise<Response> => {
		const authorization = `Bearer ${await accessToken()}`;
		let res: Response;
		try {
			res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: authorization } });
		} catch {
			throw new GooglePlayError('unavailable', 'Play Developer API nicht erreichbar.');
		}
		if (!res.ok) {
			throw new GooglePlayError(kindForStatus(res.status), `Play Developer API antwortete mit ${res.status}.`);
		}
		return res;
	};

	return {
		async getSubscription(purchaseToken) {
			const res = await call(`${API}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
			return toSubscription((await res.json()) as SubscriptionPurchaseV2);
		},
		async acknowledge(productId, purchaseToken) {
			await call(
				`${API}/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
				{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
			);
		},
	};
};

/**
 * Bestätigt einen noch offenen Kauf genau einmal. Google erstattet unbestätigte Käufe nach drei Tagen;
 * aufrufen erst, wenn der Kauf dem Nutzer zugeordnet ist (ADR 0017).
 */
export const acknowledgeIfPending = async (
	client: GooglePlayClient,
	subscription: PlaySubscription,
	purchaseToken: string,
): Promise<void> => {
	if (!subscription.acknowledged) {
		await client.acknowledge(subscription.productId, purchaseToken);
	}
};
