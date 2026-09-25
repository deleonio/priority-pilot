import webpush from 'web-push';
import type { PushSubscription as WebPushSubscription, SendResult } from 'web-push';
import { FcmToken, PushSubscription } from '../models/index.js';
import { getFcmSender } from './fcm.js';
import { ownerScope } from './ownerScope.js';

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

type SendError = { statusCode?: number; errorCode?: string };

/**
 * Stellt an jedes Ziel zu. Erkennt `isGone` am Fehler ein erloschenes Ziel, wird es gelöscht
 * (Selbstheilung). Andere Fehler (Netzwerk, 5xx) werden protokolliert, das Ziel bleibt.
 */
const deliver = async <Row extends { id: number; destroy: () => Promise<void> }>(
	rows: Row[],
	sendOne: (row: Row) => Promise<unknown>,
	isGone: (error: SendError) => boolean,
	channel: string,
): Promise<{ sent: number; removed: number }> => {
	let sent = 0;
	let removed = 0;
	for (const row of rows) {
		try {
			await sendOne(row);
			sent++;
		} catch (error) {
			const failure = (error ?? {}) as SendError;
			if (isGone(failure)) {
				await row.destroy();
				removed++;
			} else {
				console.warn(`${channel}-Versand an ${row.id} fehlgeschlagen:`, failure.statusCode ?? error);
			}
		}
	}
	return { sent, removed };
};

/**
 * Verschickt eine Push-Nachricht an **alle Web-Push-Subscriptions und FCM-Token eines Nutzers**
 * (Datenisolation #207 über {@link ownerScope}). FCM läuft nur, wenn ein Service-Account konfiguriert
 * ist. Erloschene Ziele werden entfernt: Web-Push meldet sie mit `404`/`410 Gone`, FCM mit dem
 * Fehlercode `UNREGISTERED`. Ein anderer 404 von FCM, etwa bei falscher `project_id`, löscht nichts. Gibt die Zahl der Zustellungen und entfernten Ziele über beide Kanäle zurück.
 *
 * @param send  injizierbarer Web-Push-Versand (Default: web-push); Tests reichen einen Mock herein.
 */
export const sendPushToUser = async (
	userId: number | undefined,
	payload: PushPayload,
	send: PushSender = defaultSender,
): Promise<{ sent: number; removed: number }> => {
	const body = JSON.stringify(payload);
	const web = await deliver(
		await PushSubscription.findAll({ where: ownerScope(userId) }),
		(row) => send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body),
		({ statusCode }) => statusCode === 404 || statusCode === 410,
		'Web-Push',
	);
	const fcm = getFcmSender();
	if (!fcm) {
		return web;
	}
	const app = await deliver(
		await FcmToken.findAll({ where: ownerScope(userId) }),
		(row) => fcm(row.token, payload),
		({ errorCode }) => errorCode === 'UNREGISTERED',
		'FCM',
	);
	return { sent: web.sent + app.sent, removed: web.removed + app.removed };
};
