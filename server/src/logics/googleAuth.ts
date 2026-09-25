import { createPrivateKey, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Anmeldung eines Google-Service-Accounts per signiertem JWT (OAuth 2.0 JWT-Bearer), ohne Google-SDK.
 * Genutzt für FCM (`fcm.ts`) und die Play Developer API (`googlePlay.ts`).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Die Felder der JSON-Schlüsseldatei, die die Anmeldung braucht. */
export interface ServiceAccount {
	project_id: string;
	client_email: string;
	private_key: string;
}

/**
 * Liest die JSON-Schlüsseldatei; wirft, wenn sie fehlt, kein JSON ist oder der Schlüssel unbrauchbar
 * ist. Ein kaputter Schlüssel ist eine Fehlkonfiguration und soll nicht erst beim Signieren als
 * vorübergehender Fehler auffallen.
 */
export const readServiceAccount = (file: string): ServiceAccount => {
	const account = JSON.parse(readFileSync(file, 'utf8')) as ServiceAccount;
	createPrivateKey(account.private_key);
	return account;
};

/** Fehler mit HTTP-Status der Google-Antwort. */
export const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

const signJwt = (account: ServiceAccount, scope: string, nowSeconds: number): string => {
	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = base64url(
		JSON.stringify({ iss: account.client_email, scope, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
	);
	const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key);
	return `${header}.${claims}.${base64url(signature)}`;
};

/** Liefert Zugriffstokens für `scope`; zwischengespeichert und eine Minute vor Ablauf erneuert. */
export const createAccessTokenSource = (account: ServiceAccount, scope: string): (() => Promise<string>) => {
	let accessToken: { value: string; expiresAt: number } | undefined;
	return async () => {
		const now = Date.now();
		if (accessToken && accessToken.expiresAt > now) {
			return accessToken.value;
		}
		const res = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: signJwt(account, scope, Math.floor(now / 1000)),
			}),
		});
		if (!res.ok) {
			throw httpError(`Google-Anmeldung fehlgeschlagen (${res.status})`, res.status);
		}
		const data = (await res.json()) as { access_token: string; expires_in: number };
		accessToken = { value: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
		return accessToken.value;
	};
};
