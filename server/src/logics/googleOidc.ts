import { createPublicKey, createVerify, type webcrypto } from 'node:crypto';

/** Öffentlicher Schlüssel im JWK-Format, wie Google ihn ausliefert (`kid` identifiziert ihn). */
type GoogleKey = webcrypto.JsonWebKey & { kid?: string };

/**
 * Prüft von Google signierte Tokens (Signatur mit Googles öffentlichen Schlüsseln, Aussteller,
 * Zielgruppe, Ablauf): das OIDC-Token, das Pub/Sub einer Push-Nachricht mitgibt (Real-time Developer
 * Notifications von Google Play, ADR 0017; Zielgruppe `GOOGLE_RTDN_AUDIENCE`, falls gesetzt zusätzlich
 * das Dienstkonto `GOOGLE_RTDN_SERVICE_ACCOUNT`), und das ID-Token der Android-App (ADR 0023).
 */

const KEYS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Liefert Googles aktuelle Signaturschlüssel als JWK; Tests reichen eigene Schlüssel herein. */
export type GoogleKeysSource = () => Promise<GoogleKey[]>;

const fetchGoogleKeys: GoogleKeysSource = async () => {
	const res = await fetch(KEYS_URL);
	if (!res.ok) {
		throw new Error(`Google-Schlüssel nicht abrufbar (${res.status})`);
	}
	return ((await res.json()) as { keys: GoogleKey[] }).keys;
};

const decodePart = (part: string): Record<string, unknown> | null => {
	try {
		return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
	} catch {
		return null;
	}
};

/**
 * Prüft ein von Google signiertes JWT: Signatur mit Googles öffentlichen Schlüsseln, Aussteller,
 * Zielgruppe und Ablauf. Liefert die Claims; `unreachable`, wenn Googles Schlüssel nicht abrufbar sind.
 */
const verifyGoogleJwt = async (
	token: string,
	audience: string,
	keys: GoogleKeysSource,
	now: number,
): Promise<Record<string, unknown> | 'invalid' | 'unreachable'> => {
	const [headerPart, claimsPart, signature] = token.split('.');
	const header = headerPart ? decodePart(headerPart) : null;
	const claims = claimsPart ? decodePart(claimsPart) : null;
	if (!header || !claims || !signature || header.alg !== 'RS256') {
		return 'invalid';
	}

	let jwk: GoogleKey | undefined;
	try {
		jwk = (await keys()).find((key) => key.kid === header.kid);
	} catch {
		return 'unreachable';
	}
	if (!jwk) {
		return 'invalid';
	}
	const signed = createVerify('RSA-SHA256')
		.update(`${headerPart}.${claimsPart}`)
		.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url'));

	const valid =
		signed &&
		ISSUERS.includes(String(claims.iss)) &&
		claims.aud === audience &&
		typeof claims.exp === 'number' &&
		claims.exp * 1000 > now;
	return valid ? claims : 'invalid';
};

/**
 * `verified`, wenn das Bearer-Token aus `authorization` gültig ist; `unreachable`, wenn Googles
 * Schlüssel nicht abrufbar sind (die Nachricht kommt dann erneut); sonst `invalid`.
 */
export const verifyPubSubToken = async (
	authorization: string | undefined,
	keys: GoogleKeysSource = fetchGoogleKeys,
	now: number = Date.now(),
): Promise<'verified' | 'invalid' | 'unreachable'> => {
	const audience = process.env.GOOGLE_RTDN_AUDIENCE?.trim();
	const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
	if (!audience) {
		return 'invalid';
	}
	const claims = await verifyGoogleJwt(token, audience, keys, now);
	if (typeof claims === 'string') {
		return claims;
	}
	const serviceAccount = process.env.GOOGLE_RTDN_SERVICE_ACCOUNT?.trim();
	return !serviceAccount || (claims.email === serviceAccount && claims.email_verified === true)
		? 'verified'
		: 'invalid';
};

/** Von Google bestätigte Identität aus einem ID-Token. */
export type GoogleIdentity = { email: string; name?: string; picture?: string };

/**
 * Prüft das ID-Token, das die Android-App über den Credential Manager von Google bekommt (ADR 0023):
 * Zielgruppe ist der Web-Client (`GOOGLE_CLIENT_ID`), die E-Mail muss von Google bestätigt sein.
 */
export const verifyGoogleIdToken = async (
	idToken: string,
	keys: GoogleKeysSource = fetchGoogleKeys,
	now: number = Date.now(),
): Promise<GoogleIdentity | 'invalid' | 'unreachable'> => {
	const audience = process.env.GOOGLE_CLIENT_ID?.trim();
	if (!audience) {
		return 'invalid';
	}
	const claims = await verifyGoogleJwt(idToken, audience, keys, now);
	if (typeof claims === 'string') {
		return claims;
	}
	if (claims.email_verified !== true || typeof claims.email !== 'string') {
		return 'invalid';
	}
	return {
		email: claims.email.trim().toLowerCase(),
		name: typeof claims.name === 'string' ? claims.name : undefined,
		picture: typeof claims.picture === 'string' ? claims.picture : undefined,
	};
};
