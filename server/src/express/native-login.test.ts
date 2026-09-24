import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import passport from 'passport';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { createNativeLoginCode } from '../logics/magicLink.js';

/**
 * Login der nativen App (#1669, ADR 0016): `/auth/google?client=app&state=…` endet mit einem an
 * `state` gebundenen Einmal-Code auf dem App Link, `POST /auth/native/exchange` löst ihn im WebView
 * gegen die Session ein.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'app@example.com';
applyTestAuthEnv('native-login');

const EMAIL = 'app@example.com';
const STATE = 'app-state-0123456789';

let server: TestServer;

const exchange = (code: unknown, state: unknown = STATE) =>
	server.json('/auth/native/exchange', { method: 'POST', body: JSON.stringify({ code, state }) });

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

/** Callback mit Stub-Strategie im Kontext der Session `cookie`; liefert das Redirect-Ziel. */
const callbackLocation = async (cookie?: string): Promise<string | null> => {
	const original = (passport as unknown as { _strategy(name: string): passport.Strategy })._strategy('google');
	passport.use(new StubGoogleStrategy());
	try {
		const res = await fetch(`${server.baseUrl}/auth/google/callback?code=x`, {
			redirect: 'manual',
			headers: cookie ? { Cookie: cookie } : {},
		});
		assert.equal(res.status, 302);
		return res.headers.get('location');
	} finally {
		passport.use(original);
	}
};

const start = (path: string) => fetch(`${server.baseUrl}${path}`, { redirect: 'manual' });

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

	it('client=app leitet mit Einmal-Code auf den App Link, ohne client=app wie bisher auf /app/', async () => {
		const cookie = cookieOf(await start(`/auth/google?client=app&state=${STATE}`));
		assert.match((await callbackLocation(cookie)) ?? '', /^\/app\/auth\/native\?code=[\w-]+$/);
		assert.equal(await callbackLocation(), '/app/');
	});

	it('client=app ohne gültigen state wird abgelehnt', async () => {
		assert.equal((await start('/auth/google?client=app')).status, 400);
		assert.equal((await start('/auth/google?client=app&state=kurz')).status, 400);
	});

	it('ein abgebrochener App-Login lenkt einen späteren stillen Web-Login nicht auf den App Link um', async () => {
		const cookie = cookieOf(await start(`/auth/google?client=app&state=${STATE}`));
		await fetch(`${server.baseUrl}/auth/google/silent`, { redirect: 'manual', headers: { Cookie: cookie } });
		assert.equal(await callbackLocation(cookie), '/app/');
	});

	it('der Code aus dem Callback lässt sich mit dem state einlösen, danach liefert /auth/me den Nutzer', async () => {
		const cookie = cookieOf(await start(`/auth/google?client=app&state=${STATE}`));
		const code = new URL((await callbackLocation(cookie)) ?? '', server.baseUrl).searchParams.get('code');
		const res = await exchange(code);
		assert.equal(res.status, 204);
		const me = await server.json('/auth/me', { headers: { cookie: cookieOf(res) } });
		assert.equal(me.status, 200);
		assert.equal(((await me.json()) as { email: string }).email, EMAIL);
	});

	it('lehnt abgelaufene, doppelt eingelöste, unbekannte und fremd gebundene Codes ab', async () => {
		const expired = await createNativeLoginCode(EMAIL, STATE, new Date(Date.now() - 61_000));
		assert.equal((await exchange(expired)).status, 400);

		const code = await createNativeLoginCode(EMAIL, STATE);
		assert.equal((await exchange(code, 'anderer-state-0123456789')).status, 400, 'Code aus fremdem Login');
		assert.equal((await exchange(code, null)).status, 400, 'ohne state');
		assert.equal((await exchange(code)).status, 204);
		assert.equal((await exchange(code)).status, 400);

		assert.equal((await exchange('manipuliert')).status, 400);
		assert.equal((await exchange(undefined)).status, 400);
	});
});
