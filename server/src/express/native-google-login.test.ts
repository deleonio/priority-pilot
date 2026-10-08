import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Native Google-Anmeldung der App (ADR 0023): `POST /auth/native/google` löst ein ID-Token aus dem
 * Credential Manager ein. Das Token wird mit einem Test-Schlüsselpaar signiert, dessen öffentlicher
 * Teil als `googleKeys` hereingereicht wird (Muster billing-google-rtdn.test.ts).
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'app@example.com';
applyTestAuthEnv('native-google');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const googleKeys = async () => [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1' }];
/** Signiert unter derselben `kid`, gehört aber nicht zu Google. */
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

const base64url = (value: string) => Buffer.from(value).toString('base64url');
const idToken = (claims: Record<string, unknown>, signingKey = privateKey): string => {
	const head = `${base64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`;
	return `${head}.${createSign('RSA-SHA256').update(head).sign(signingKey).toString('base64url')}`;
};
const nowSeconds = () => Math.floor(Date.now() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => ({
	iss: 'https://accounts.google.com',
	aud: CLIENT_ID,
	exp: nowSeconds() + 3600,
	email: 'App@Example.com',
	email_verified: true,
	name: 'App Nutzer',
	...overrides,
});

let server: TestServer;
const login = (token: string) =>
	server.json('/auth/native/google', {
		method: 'POST',
		headers: { 'X-Client-Channel': 'play' },
		body: JSON.stringify({ idToken: token }),
	});

describe('Native Google-Anmeldung der App (ADR 0023)', () => {
	before(async () => {
		server = await startTestServer({ googleKeys });
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('ein gültiges ID-Token liefert ein App-Token für /auth/me', async () => {
		const res = await login(idToken(claims()));
		assert.equal(res.status, 200);
		const { token } = (await res.json()) as { token: string };
		const me = await server.json('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
		assert.equal(me.status, 200);
		assert.equal(((await me.json()) as { email: string }).email, 'app@example.com');
	});

	it('lehnt fremde Zielgruppe, Ablauf, unbestätigte E-Mail und fremden Schlüssel ab', async () => {
		const cases: Array<[string, string]> = [
			['fremde Zielgruppe', idToken(claims({ aud: 'anderer-client' }))],
			['abgelaufen', idToken(claims({ exp: nowSeconds() - 10 }))],
			['unbestätigte E-Mail', idToken(claims({ email_verified: false }))],
			['fremder Schlüssel', idToken(claims(), otherKey)],
			['kein JWT', 'manipuliert'],
		];
		for (const [label, token] of cases) {
			assert.equal((await login(token)).status, 400, label);
		}
	});

	it('eine nicht freigegebene Adresse wird abgelehnt', async () => {
		assert.equal((await login(idToken(claims({ email: 'fremd@example.com' })))).status, 403);
	});
});
