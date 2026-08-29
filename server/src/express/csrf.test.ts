import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import { startTestServer, resetDb, closeDb, type TestServer } from '../test/helpers.js';

/**
 * CSRF-Schutz im Produktionsmodus (server/src/express/csrf.ts, CodeQL js/missing-token-validation).
 *
 * Der Schutz ist nur außerhalb von NODE_ENV=test aktiv — deshalb fährt dieser Suite eine App mit
 * NODE_ENV=production hoch (inkl. der Produktions-Gates SESSION_SECRET + E-Mail-Allowlist und
 * injiziertem MemoryStore, da SESSION_STORE in Produktion Pflicht wäre) und prüft:
 * Token-Ausstellung, 403 ohne Token, Durchlass mit gültigem Cookie+Header-Paar.
 */
describe('CSRF-Schutz (Produktionsmodus)', () => {
	let server: TestServer;
	const previous: Record<string, string | undefined> = {};

	before(async () => {
		// createApp liest die Env beim Aufruf — vor dem Start setzen, danach wiederherstellen.
		for (const key of ['NODE_ENV', 'SESSION_SECRET', 'GOOGLE_ALLOWED_EMAIL']) {
			previous[key] = process.env[key];
		}
		process.env.NODE_ENV = 'production';
		process.env.SESSION_SECRET = 'csrf-test-secret';
		process.env.GOOGLE_ALLOWED_EMAIL = 'test@example.com';
		await resetDb();
		server = await startTestServer({ sessionStore: new session.MemoryStore() });
	});

	after(async () => {
		await server.close();
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
		await closeDb();
	});

	// Holt Token + Cookie als Double-Submit-Paar (node:fetch hat keinen Cookie-Jar → Header manuell).
	const fetchCsrfPair = async (): Promise<{ cookie: string; csrfToken: string }> => {
		const res = await fetch(`${server.baseUrl}/auth/csrf`);
		assert.equal(res.status, 200);
		const setCookie = res.headers.get('set-cookie');
		assert.ok(setCookie?.includes('__Host-csrf='), `__Host-csrf-Cookie erwartet, war: ${setCookie}`);
		const body = (await res.json()) as { csrfToken: string };
		assert.ok(body.csrfToken.length > 0, 'CSRF-Token sollte nicht leer sein');
		return { cookie: setCookie.split(';')[0], csrfToken: body.csrfToken };
	};

	it('GET /auth/csrf stellt Token + Cookie aus', async () => {
		const { cookie, csrfToken } = await fetchCsrfPair();
		assert.ok(cookie.startsWith('__Host-csrf='), `__Host-csrf-Cookie erwartet, war: ${cookie}`);
		assert.ok(csrfToken.includes('.'), 'Token sollte aus HMAC + Zufallswert bestehen');
	});

	it('lehnt schreibenden Request ohne Token mit 403 ab', async () => {
		const res = await fetch(`${server.baseUrl}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'stimmt-nicht' }),
		});
		assert.equal(res.status, 403);
	});

	it('lässt schreibenden Request mit gültigem Token + Cookie durch (401 = Auth-Logik erreicht)', async () => {
		const { cookie, csrfToken } = await fetchCsrfPair();
		const res = await fetch(`${server.baseUrl}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken },
			body: JSON.stringify({ email: 'test@example.com', password: 'stimmt-nicht' }),
		});
		assert.equal(res.status, 401);
	});
});
