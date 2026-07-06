import webpush from 'web-push';
import type { PushSubscription as WebPushSubscription, SendResult } from 'web-push';
import { PushSubscription } from '../models/index.js';
import { ownerScope } from '../express/requireAuth.js';

/**
 * Web-Push-Versand (Issue #355). Dieser Helfer ist **server-intern**: es gibt bewusst keinen
 * client-aufrufbaren „an alle senden"-Endpunkt (Sicherheit — sonst könnte jeder Nutzer alle
 * benachrichtigen). Fachliche Trigger (fällige Aufgaben, „vernachlässigte Säule" #337) rufen später
 * {@link sendPushToUser} auf; diese PR liefert die Opt-in-Infrastruktur ohne automatischen Trigger.
 */

/** Fallback-Subject, falls `VAPID_SUBJECT` nicht gesetzt ist (VAPID verlangt mailto:/https:). */
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@example.com';

/** Nutzlast einer Push-Nachricht — der Service Worker (`push-sw.js`) liest genau diese Felder. */
interface PushPayload {
	title: string;
	body?: string;
	/** Ziel-URL für den `notificationclick`-Handler (Default: App-Wurzel). */
	url?: string;
}

/**
 * Signatur des eigentlichen Versands — injizierbar, damit Tests den Netzwerk-Aufruf ohne echte
 * VAPID-Schlüssel/Push-Dienste ersetzen können (Vorbild: injizierte Mistral-Clients in `AppDeps`).
 */
export type PushSender = (subscription: WebPushSubscription, payload: string) => Promise<SendResult>;

/** Der öffentliche VAPID-Schlüssel (für `GET /push/vapid-public-key`), oder `undefined` wenn unkonfiguriert. */
export const getVapidPublicKey = (): string | undefined => process.env.VAPID_PUBLIC_KEY?.trim() || undefined;

/** Ob Web-Push konfiguriert ist (beide VAPID-Schlüssel gesetzt). Steuert das 503-Gate der Endpunkte. */
export const isPushConfigured = (): boolean =>
	!!(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());

/**
 * Standard-Versand über web-push. Setzt vor jedem Versand die VAPID-Details (idempotent bei web-push)
 * und verschickt die verschlüsselte Payload. Wird nur erreicht, wenn kein Test-Sender injiziert ist;
 * die aufrufenden Endpunkte haben Web-Push zuvor über {@link isPushConfigured} abgesichert.
 */
const defaultSender: PushSender = (subscription, payload) => {
	const subject = process.env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
	webpush.setVapidDetails(subject, getVapidPublicKey() ?? '', process.env.VAPID_PRIVATE_KEY?.trim() ?? '');
	return webpush.sendNotification(subscription, payload);
};

/**
 * Verschickt eine Push-Nachricht an **alle Subscriptions eines Nutzers** (Datenisolation #207 über
 * {@link ownerScope}). Abgelaufene Subscriptions (Push-Dienst antwortet mit `404`/`410 Gone`) werden
 * dabei aus der Datenbank entfernt (Selbstheilung). Andere Fehler (Netzwerk, 5xx) werden protokolliert,
 * lassen die Subscription aber bestehen. Gibt die Zahl der zugestellten und entfernten Subscriptions zurück.
 *
 * @param send  injizierbarer Versand (Default: web-push); Tests reichen einen Mock herein.
 */
export const sendPushToUser = async (
	userId: number | undefined,
	payload: PushPayload,
	send: PushSender = defaultSender,
): Promise<{ sent: number; removed: number }> => {
	const rows = await PushSubscription.findAll({ where: ownerScope(userId) });
	const body = JSON.stringify(payload);
	let sent = 0;
	let removed = 0;
	for (const row of rows) {
		const subscription: WebPushSubscription = {
			endpoint: row.endpoint,
			keys: { p256dh: row.p256dh, auth: row.auth },
		};
		try {
			await send(subscription, body);
			sent++;
		} catch (error) {
			const statusCode = (error as { statusCode?: number })?.statusCode;
			if (statusCode === 404 || statusCode === 410) {
				// Subscription ist beim Push-Dienst abgelaufen/abbestellt → aufräumen.
				await row.destroy();
				removed++;
			} else {
				console.warn(`Push-Versand an Subscription ${row.id} fehlgeschlagen:`, statusCode ?? error);
			}
		}
	}
	return { sent, removed };
};
