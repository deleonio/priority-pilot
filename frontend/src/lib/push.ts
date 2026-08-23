import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Web-Push-Opt-in der PWA (Issue #355).
 *
 * Bewusst — analog zu `theme.ts`/`voiceAutostart.ts` — getrennt in **reine, testbare Funktionen**
 * (Support-Erkennung, Berechtigung + Subscription-Flow) und einen schlanken React-Hook
 * (`usePushSubscription`) für den Toggle in der Einstellungen-Seite. Die eigentlichen HTTP-Aufrufe
 * laufen über die typsichere `api`-Fassade (`../api`); der Versand selbst passiert server-intern.
 */

/** Ob der Browser Web-Push unterstützt (Service Worker + PushManager + Notification-API vorhanden). */
export const isPushSupported = (): boolean =>
	typeof navigator !== 'undefined' &&
	'serviceWorker' in navigator &&
	typeof window !== 'undefined' &&
	'PushManager' in window &&
	'Notification' in window;

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

/** Ob aktuell eine aktive Push-Subscription im Browser besteht. */
export const hasActiveSubscription = async (): Promise<boolean> => {
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
 * wird oder der Nutzer die Berechtigung nicht erteilt.
 */
export const enablePush = async (): Promise<boolean> => {
	if (!isPushSupported()) {
		return false;
	}
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		return false;
	}

	const publicKey = await api.getVapidPublicKey();
	const registration = await navigator.serviceWorker.ready;
	// Bereits vorhandene Subscription wiederverwenden (idempotent), sonst neu erstellen.
	// Bekannte Einschränkung: der applicationServerKey der bestehenden Subscription wird nicht
	// gegen den aktuellen publicKey geprüft. Bei VAPID-Key-Rotation müsste man vergleichen und
	// ggf. neu subscriben — für das MVP ohne Key-Rotation vertretbar.
	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey),
		}));

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
 * gleicht async mit der tatsächlichen Subscription ab und korrigiert Zustand wie Spiegel, falls die
 * Subscription extern entfernt wurde. `toggle` fragt beim Aktivieren die Berechtigung an und meldet
 * an/ab.
 */
export const usePushSubscription = (): UsePushSubscriptionResult => {
	const supported = isPushSupported();
	const [enabled, setEnabled] = useState<boolean>(readPushPreference);
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!supported) {
			return;
		}
		let active = true;
		void hasActiveSubscription().then((has) => {
			if (active) {
				setEnabled(has);
				storePushPreference(has);
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
