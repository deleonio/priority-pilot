import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import passport from 'passport';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { createNativeLoginCode } from '../logics/magicLink.js';

/**
 * Login der nativen App (#1669, ADR 0016): `/auth/google?client=app` endet mit einem Einmal-Code
 * auf dem App Link, `POST /auth/native/exchange` löst ihn im WebView gegen die Session ein.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'app@example.com';
applyTestAuthEnv('native-login');

const EMAIL = 'app@example.com';

let server: TestServer;

const exchange = (code: unknown) =>
	server.json('/auth/native/exchange', { method: 'POST', body: JSON.stringify({ code }) });

const cookieOf = (res: Response): string => {
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Antwort setzt einen Session-Cookie');
	return setCookie.split(';')[0];
};

/** Stub für die 'google'-Strategie: meldet den Nutzer ohne echten Google-Aufruf an (Muster auth.test.ts). */
class StubGoogleStrategy implements passport.Strategy {
	name = 'google';
	authenticate(this: passport.StrategyCreated<StubGoogleStrategy>): void {
		this.success({ id: 1, email: EMAIL, displayName: 'App', avatarUrl: null, role: 'member', plan: 'free' });
	}
}

describe('Login der nativen App mit Einmal-Code (#1669)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('Google-Login mit client=app leitet mit Einmal-Code auf den App Link, ohne client=app wie bisher', async () => {
		const start = await fetch(`${server.baseUrl}/auth/google?client=app`, { redirect: 'manual' });
		const cookie = cookieOf(start);
		const original = (passport as unknown as { _strategy(name: string): passport.Strategy })._strategy('google');
		passport.use(new StubGoogleStrategy());
		try {
			const app = await fetch(`${server.baseUrl}/auth/google/callback?code=x`, {
				redirect: 'manual',
				headers: { Cookie: cookie },
			});
			assert.equal(app.status, 302);
			assert.match(app.headers.get('location') ?? '', /^\/app\/auth\/native\?code=[\w-]+$/);

			const web = await fetch(`${server.baseUrl}/auth/google/callback?code=x`, { redirect: 'manual' });
			assert.equal(web.headers.get('location'), '/app/');
		} finally {
			passport.use(original);
		}
	});

	it('ein gültiger Code setzt die Session, danach liefert /auth/me den Nutzer', async () => {
		const res = await exchange(await createNativeLoginCode(EMAIL));
		assert.equal(res.status, 204);
		const me = await server.json('/auth/me', { headers: { cookie: cookieOf(res) } });
		assert.equal(me.status, 200);
		assert.equal(((await me.json()) as { email: string }).email, EMAIL);
	});

	it('lehnt abgelaufene, doppelt eingelöste und unbekannte Codes ab', async () => {
		const expired = await createNativeLoginCode(EMAIL, new Date(Date.now() - 61_000));
		assert.equal((await exchange(expired)).status, 400);

		const code = await createNativeLoginCode(EMAIL);
		assert.equal((await exchange(code)).status, 204);
		assert.equal((await exchange(code)).status, 400);

		assert.equal((await exchange('manipuliert')).status, 400);
		assert.equal((await exchange(undefined)).status, 400);
	});
});
