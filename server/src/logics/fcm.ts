import { createAccessTokenSource, httpError, readServiceAccount, type ServiceAccount } from './googleAuth.js';

/**
 * Versand über Firebase Cloud Messaging (HTTP v1) an die Android-App (ADR 0016). Der Server meldet
 * sich mit einem Service-Account an: `FCM_SERVICE_ACCOUNT_FILE` zeigt auf die JSON-Schlüsseldatei aus
 * der Firebase-Konsole (`googleAuth.ts`).
 */

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Inhalt einer FCM-Nachricht; `url` reist als Datenfeld mit und ist das Ziel beim Antippen. */
interface FcmMessage {
	title: string;
	body?: string;
	url?: string;
}

/**
 * Versand an ein Gerätetoken. Wirft bei HTTP-Fehlern einen Fehler mit `statusCode` und, falls FCM ihn
 * nennt, `errorCode`; `UNREGISTERED` heißt: das Token gilt nicht mehr (App deinstalliert, Token erneuert).
 */
type FcmSender = (token: string, message: FcmMessage) => Promise<void>;

/** Ob FCM konfiguriert ist. Ohne Service-Account bleibt es beim Web-Push. */
export const isFcmConfigured = (): boolean => !!process.env.FCM_SERVICE_ACCOUNT_FILE?.trim();

/** `errorCode` aus einer FCM-Fehlerantwort (`error.details[].errorCode`), sonst `undefined`. */
const fcmErrorCode = async (res: Response): Promise<string | undefined> => {
	const body = (await res.json().catch(() => undefined)) as
		{ error?: { details?: { errorCode?: string }[] } } | undefined;
	return body?.error?.details?.find((detail) => detail.errorCode)?.errorCode;
};

const createFcmSender = (account: ServiceAccount): FcmSender => {
	const accessToken = createAccessTokenSource(account, SCOPE);
	return async (token, { title, body, url }) => {
		const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: { token, notification: { title, body }, ...(url ? { data: { url } } : {}) } }),
		});
		if (!res.ok) {
			throw Object.assign(httpError(`FCM-Versand fehlgeschlagen (${res.status})`, res.status), {
				errorCode: await fcmErrorCode(res),
			});
		}
	};
};

let cached: { file: string; send: FcmSender } | undefined;

/** Sender aus `FCM_SERVICE_ACCOUNT_FILE`; `undefined`, wenn FCM nicht konfiguriert oder die Datei unlesbar ist. */
export const getFcmSender = (): FcmSender | undefined => {
	const file = process.env.FCM_SERVICE_ACCOUNT_FILE?.trim();
	if (!file) {
		return undefined;
	}
	if (cached?.file !== file) {
		try {
			cached = { file, send: createFcmSender(readServiceAccount(file)) };
		} catch (error) {
			console.warn(`FCM-Service-Account ${file} nicht lesbar:`, error);
			return undefined;
		}
	}
	return cached.send;
};
