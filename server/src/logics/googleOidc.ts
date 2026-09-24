import { createPublicKey, createVerify, type webcrypto } from 'node:crypto';

/** Öffentlicher Schlüssel im JWK-Format, wie Google ihn ausliefert (`kid` identifiziert ihn). */
type GoogleKey = webcrypto.JsonWebKey & { kid?: string };

/**
 * Prüft das OIDC-Token, das Pub/Sub einer Push-Nachricht mitgibt (Real-time Developer Notifications
 * von Google Play, ADR 0017): Signatur mit Googles öffentlichen Schlüsseln, Aussteller, Zielgruppe
 * (`GOOGLE_RTDN_AUDIENCE`, die in der Push-Subscription eingetragene Adresse), Ablauf und, falls
 * gesetzt, das Dienstkonto der Subscription (`GOOGLE_RTDN_SERVICE_ACCOUNT`).
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
	const [headerPart, claimsPart, signature] = token.split('.');
	const header = headerPart ? decodePart(headerPart) : null;
	const claims = claimsPart ? decodePart(claimsPart) : null;
	if (!audience || !header || !claims || !signature || header.alg !== 'RS256') {
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

	const serviceAccount = process.env.GOOGLE_RTDN_SERVICE_ACCOUNT?.trim();
	const valid =
		signed &&
		ISSUERS.includes(String(claims.iss)) &&
		claims.aud === audience &&
		typeof claims.exp === 'number' &&
		claims.exp * 1000 > now &&
		(!serviceAccount || (claims.email === serviceAccount && claims.email_verified === true));
	return valid ? 'verified' : 'invalid';
};
