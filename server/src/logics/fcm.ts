import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Versand über Firebase Cloud Messaging (HTTP v1) an die Android-App (ADR 0016). Der Server meldet
 * sich mit einem Service-Account an: `FCM_SERVICE_ACCOUNT_FILE` zeigt auf die JSON-Schlüsseldatei aus
 * der Firebase-Konsole, daraus entsteht ein signiertes JWT für den OAuth-Token von Google.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

interface ServiceAccount {
	project_id: string;
	client_email: string;
	private_key: string;
}

/** Inhalt einer FCM-Nachricht; `url` reist als Datenfeld mit und ist das Ziel beim Antippen. */
interface FcmMessage {
	title: string;
	body?: string;
	url?: string;
}

/** Versand an ein Gerätetoken. Wirft bei HTTP-Fehlern einen Fehler mit `statusCode`; 404 heißt: Token unbekannt. */
type FcmSender = (token: string, message: FcmMessage) => Promise<void>;

/** Ob FCM konfiguriert ist. Ohne Service-Account bleibt es beim Web-Push. */
export const isFcmConfigured = (): boolean => !!process.env.FCM_SERVICE_ACCOUNT_FILE?.trim();

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

const signJwt = (account: ServiceAccount, nowSeconds: number): string => {
	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = base64url(
		JSON.stringify({
			iss: account.client_email,
			scope: SCOPE,
			aud: TOKEN_URL,
			iat: nowSeconds,
			exp: nowSeconds + 3600,
		}),
	);
	const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key);
	return `${header}.${claims}.${base64url(signature)}`;
};

/** Sender mit zwischengespeichertem Zugriffstoken, das eine Minute vor Ablauf erneuert wird. */
const createFcmSender = (account: ServiceAccount): FcmSender => {
	let accessToken: { value: string; expiresAt: number } | undefined;

	const getAccessToken = async (): Promise<string> => {
		const now = Date.now();
		if (accessToken && accessToken.expiresAt > now) {
			return accessToken.value;
		}
		const res = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: signJwt(account, Math.floor(now / 1000)),
			}),
		});
		if (!res.ok) {
			throw httpError(`FCM-Anmeldung fehlgeschlagen (${res.status})`, res.status);
		}
		const data = (await res.json()) as { access_token: string; expires_in: number };
		accessToken = { value: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
		return accessToken.value;
	};

	return async (token, { title, body, url }) => {
		const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: { token, notification: { title, body }, ...(url ? { data: { url } } : {}) } }),
		});
		if (!res.ok) {
			throw httpError(`FCM-Versand fehlgeschlagen (${res.status})`, res.status);
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
			cached = { file, send: createFcmSender(JSON.parse(readFileSync(file, 'utf8')) as ServiceAccount) };
		} catch (error) {
			console.warn(`FCM-Service-Account ${file} nicht lesbar:`, error);
			return undefined;
		}
	}
	return cached.send;
};
