import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { isNativeChannel } from './platform';

/**
 * Web-Push-Opt-in der PWA (Issue #355).
 *
 * Bewusst — analog zu `theme.ts`/`voiceAutostart.ts` — getrennt in **reine, testbare Funktionen**
 * (Support-Erkennung, Berechtigung + Subscription-Flow) und einen schlanken React-Hook
 * (`usePushSubscription`) für den Toggle in der Einstellungen-Seite. Die eigentlichen HTTP-Aufrufe
 * laufen über die typsichere `api`-Fassade (`../api`); der Versand selbst passiert server-intern.
 */

/**
 * Push in der Android-App (#1679): Web Push fehlt im WebView, stattdessen liefert das Plugin ein
 * FCM-Token, das der Server kennt. Es liegt im localStorage, damit das Abmelden es wiederfindet.
 * Das Plugin wird erst hier nachgeladen, im Web-Bundle steckt es nicht.
 */
const FCM_TOKEN_KEY = 'pp-fcm-token';

// Nur das Modul liefern, nie den Plugin-Proxy selbst: Der Proxy beantwortet auch `then`, ein `await` auf
// ihn riefe eine Plugin-Methode „then“ auf.
const loadPushPlugin = () => import('@capacitor/push-notifications');

/** Fragt die Android-Berechtigung (ab Android 13) ab, holt das FCM-Token und meldet es beim Server an. */
const enableNativePush = async (shouldAbort?: () => boolean): Promise<boolean> => {
	const { PushNotifications: plugin } = await loadPushPlugin();
	let { receive } = await plugin.checkPermissions();
	if (receive !== 'granted' && receive !== 'denied') {
		({ receive } = await plugin.requestPermissions());
	}
	if (receive !== 'granted' || shouldAbort?.()) {
		return false;
	}
	let settle: { resolve: (token: string) => void; reject: (error: Error) => void } | undefined;
	const tokenReceived = new Promise<string>((resolve, reject) => {
		settle = { resolve, reject };
	});
	const handles = await Promise.all([
		plugin.addListener('registration', ({ value }) => settle?.resolve(value)),
		plugin.addListener('registrationError', ({ error }) => settle?.reject(new Error(error))),
	]);
	let token: string;
	try {
		await plugin.register();
		token = await tokenReceived;
	} finally {
		await Promise.all(handles.map((handle) => handle.remove()));
	}
	if (shouldAbort?.()) {
		return false;
	}
	await api.registerFcmToken(token);
	localStorage.setItem(FCM_TOKEN_KEY, token);
	return true;
};

const disableNativePush = async (): Promise<void> => {
	const token = localStorage.getItem(FCM_TOKEN_KEY);
	if (token !== null) {
		await api.unregisterFcmToken(token);
		localStorage.removeItem(FCM_TOKEN_KEY);
	}
	const { PushNotifications } = await loadPushPlugin();
	await PushNotifications.unregister();
};

/**
 * Ein Tipp auf eine Benachrichtigung öffnet ihr Ziel in der App, wie `notificationclick` in
 * `push-sw.js`: App-Pfade (`/`, `/tasks/42`) gelten ab der App-Wurzel.
 */
export const listenForNativePushTaps = async (): Promise<void> => {
	const { PushNotifications } = await loadPushPlugin();
	await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
		const url = String((notification.data as { url?: unknown } | undefined)?.url ?? '/');
		window.location.assign(
			new URL(url.replace(/^\//, ''), `${window.location.origin}${import.meta.env.BASE_URL}`).href,
		);
	});
};

/** Ob der Browser Web-Push unterstützt (Service Worker + PushManager + Notification-API vorhanden). */
export const isPushSupported = (): boolean =>
	isNativeChannel() ||
	(typeof navigator !== 'undefined' &&
		'serviceWorker' in navigator &&
		typeof window !== 'undefined' &&
		'PushManager' in window &&
		'Notification' in window);

/**
 * Wandelt einen URL-safe-Base64-VAPID-Schlüssel in ein `Uint8Array` um, wie es
 * `PushManager.subscribe({ applicationServerKey })` erwartet.
 */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	// Explizit über einen ArrayBuffer erzeugen, damit der Typ `Uint8Array<ArrayBuffer>` ist —
	// `PushManager.subscribe({ applicationServerKey })` verlangt einen ArrayBuffer-gestützten View.
	const output = new Uint8Array(new ArrayBuffer(rawData.length));
	for (let i = 0; i < rawData.length; i++) {
		output[i] = rawData.charCodeAt(i);
	}
	return output;
};

/** Ob die Subscription mit einem anderen als dem aktuellen VAPID-Schlüssel erstellt wurde. */
const hasOtherServerKey = (subscription: PushSubscription, key: Uint8Array): boolean => {
	const current = subscription.options?.applicationServerKey;
	if (!current) {
		// Konservativ „gleicher Schlüssel": manche Browser exponieren den Key nicht — dann keinen
		// Resubscribe-Churn riskieren, die bestehende Subscription bleibt unverändert in Gebrauch.
		return false;
	}
	const bytes = new Uint8Array(current);
	return bytes.length !== key.length || bytes.some((byte, i) => byte !== key[i]);
};

/** Ob aktuell eine aktive Push-Subscription im Browser besteht. */
export const hasActiveSubscription = async (): Promise<boolean> => {
	if (isNativeChannel()) {
		const { PushNotifications } = await loadPushPlugin();
		const { receive } = await PushNotifications.checkPermissions();
		return receive === 'granted' && localStorage.getItem(FCM_TOKEN_KEY) !== null;
	}
	if (!isPushSupported()) {
		return false;
	}
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	return subscription !== null;
};

/**
 * Fragt die Berechtigung an, erstellt eine Subscription (mit dem VAPID-Public-Key vom Server) und
 * meldet sie am Backend an. Gibt `true` bei Erfolg zurück; `false`, wenn Web-Push nicht unterstützt
 * wird, der Nutzer die Berechtigung nicht erteilt oder `shouldAbort` zwischendurch `true` liefert
 * (Race-Schutz des Mount-Resyncs gegen `toggle(false)`).
 */
export const enablePush = async (options?: { shouldAbort?: () => boolean }): Promise<boolean> => {
	if (isNativeChannel()) {
		return enableNativePush(options?.shouldAbort);
	}
	if (!isPushSupported()) {
		return false;
	}
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		return false;
	}

	const applicationServerKey = urlBase64ToUint8Array(await api.getVapidPublicKey());
	const registration = await navigator.serviceWorker.ready;
	// Bestehende Subscription wiederverwenden (idempotent) — außer sie stammt von einem anderen
	// VAPID-Schlüssel: die lehnt der Push-Dienst ab, der Test-Push käme nie an. Dann neu erstellen.
	let subscription = await registration.pushManager.getSubscription();
	if (subscription && hasOtherServerKey(subscription, applicationServerKey)) {
		await api.unsubscribePush({ endpoint: subscription.endpoint });
		await subscription.unsubscribe();
		subscription = null;
	}
	// Race-Schutz (#1704): Abbruch zwischen den awaits prüfen — ein Mount-Resync, der vom
	// Nutzer-`toggle(false)` überholt wurde, darf keine neue Subscription mehr erstellen.
	if (options?.shouldAbort?.()) {
		return false;
	}
	subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });

	if (options?.shouldAbort?.()) {
		return false;
	}
	const json = subscription.toJSON();
	const keys = json.keys ?? {};
	await api.subscribePush({
		subscription: {
			endpoint: subscription.endpoint,
			expirationTime: subscription.expirationTime ?? null,
			keys: { p256dh: keys.p256dh ?? '', auth: keys.auth ?? '' },
		},
	});
	return true;
};

/** Meldet die Subscription am Backend ab und kündigt sie im Browser. No-op ohne aktive Subscription. */
export const disablePush = async (): Promise<void> => {
	if (isNativeChannel()) {
		await disableNativePush();
		return;
	}
	if (!isPushSupported()) {
		return;
	}
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) {
		return;
	}
	await api.unsubscribePush({ endpoint: subscription.endpoint });
	await subscription.unsubscribe();
};

/** `localStorage`-Schlüssel der gespeicherten Wahl (Spiegel des Subscription-Zustands). */
const STORAGE_KEY = 'pp-push-enabled';

/**
 * Liest die gespeicherte Wahl als **synchronen** Anfangszustand — genau wie `voiceAutostart.ts` und
 * `useGeolocation.ts`. Die tatsächliche Subscription ist nur async ermittelbar (`serviceWorker.ready`);
 * ohne diesen Spiegel rendert der Schalter beim Seitenwechsel erst „aus" und kippt dann auf „an".
 * Fehlt der Eintrag oder ist `localStorage` gesperrt, gilt der Default **aus** (`false`).
 */
const readPushPreference = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
const storePushPreference = (enabled: boolean): void => {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// Best-Effort; der async Abgleich korrigiert beim nächsten Mount.
	}
};

interface UsePushSubscriptionResult {
	/** Ob der Browser Web-Push überhaupt unterstützt. */
	supported: boolean;
	/** Ob Push aktuell aktiviert ist (aktive Subscription vorhanden). */
	enabled: boolean;
	/** Ob gerade ein An-/Abmelde-Vorgang läuft (Toggle sperren). */
	pending: boolean;
	/** Ob das Aktivieren fehlschlug (z. B. Berechtigung verweigert) — für einen Hinweis. */
	failed: boolean;
	/** Push aktivieren (`true`) oder deaktivieren (`false`). */
	toggle: (next: boolean) => Promise<void>;
}

/**
 * React-Hook für den Push-Toggle in der Einstellungen-Seite. Anfangszustand synchron aus dem
 * `localStorage`-Spiegel (`readPushPreference`, kein Flackern beim Seitenwechsel); ein `useEffect`
 * gleicht async mit der tatsächlichen Subscription ab, korrigiert Zustand wie Spiegel, falls die
 * Subscription extern entfernt wurde, und meldet eine bestehende Subscription erneut am Server an. `toggle` fragt beim Aktivieren die Berechtigung an und meldet
 * an/ab.
 */
export const usePushSubscription = (): UsePushSubscriptionResult => {
	const supported = isPushSupported();
	const [enabled, setEnabled] = useState<boolean>(readPushPreference);
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	// Race-Schutz (#1704): `toggle(false)` setzt das Flag, bevor `disablePush` läuft — ein noch
	// laufender Mount-Resync bricht damit vor subscribe/subscribePush ab, statt Push „wieder anzustellen".
	const resyncAborted = useRef(false);

	useEffect(() => {
		if (!supported) {
			return;
		}
		resyncAborted.current = false;
		let active = true;
		void hasActiveSubscription().then((has) => {
			if (!active) {
				return;
			}
			setEnabled(has);
			storePushPreference(has);
			// Server-Stand nachziehen (idempotent): kennt der Server die Subscription nicht (mehr),
			// meldet der Test-Push „gesendet", erreicht aber kein Gerät.
			// `hasActiveSubscription` prüft in der App die Berechtigung schon mit; dort gibt es kein `Notification`.
			if (has && (isNativeChannel() || Notification.permission === 'granted')) {
				void enablePush({ shouldAbort: () => resyncAborted.current }).catch(() => undefined);
			}
		});
		return () => {
			active = false;
		};
	}, [supported]);

	const toggle = useCallback(
		async (next: boolean): Promise<void> => {
			if (pending) {
				return;
			}
			setPending(true);
			setFailed(false);
			try {
				if (next) {
					const ok = await enablePush();
					setEnabled(ok);
					storePushPreference(ok);
					setFailed(!ok);
				} else {
					resyncAborted.current = true;
					await disablePush();
					setEnabled(false);
					storePushPreference(false);
				}
			} catch {
				// Netzwerk-/API-Fehler beim An-/Abmelden → Zustand nicht als aktiv ausweisen, Hinweis zeigen.
				setEnabled(false);
				storePushPreference(false);
				setFailed(true);
			} finally {
				setPending(false);
			}
		},
		[pending],
	);

	return { supported, enabled, pending, failed, toggle };
};
