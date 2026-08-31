import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Auth-Kontext muss vor dem Server-Start feststehen: createApp() liest diese
// Werte beim Aufbau der Session-/Passport-Middleware.
// NODE_ENV=test wird bereits im test-Skript gesetzt — nötig, weil der
// Test-Login-Endpunkt nur bei NODE_ENV=test registriert wird und das beim
// Modul-Load von auth.ts (vor diesen Zuweisungen) ausgewertet wird.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
process.env.SESSION_SECRET = 'test-secret-for-tests';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

const ALLOWED_EMAIL = 'testuser@example.com';
const ALLOWED_NAME = 'Test User';

let server: TestServer;

/** Extrahiert das erste `name=value`-Paar aus einem Set-Cookie-Header (ohne Attribute). */
const cookieFromSetCookie = (setCookie: string): string => setCookie.split(';')[0];

/**
 * Loggt über den Test-Only-Endpunkt ein und gibt den Cookie-Header für Folgeanfragen zurück.
 * Wirft, wenn kein Set-Cookie geliefert wurde — dann ist der Vertrag verletzt.
 */
const testLogin = async (email = ALLOWED_EMAIL, displayName = ALLOWED_NAME): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, displayName }),
	});
	assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Test-Login sollte einen Set-Cookie-Header setzen');
	return cookieFromSetCookie(setCookie);
};

describe('Auth (Google OAuth Single-User-Gate)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	// ── AC 1 — Geschützte Routen ohne Session → 401 ──────────────────────────

	describe('AC 1 — geschützte Routen ohne Session-Cookie', () => {
		for (const path of ['/tasks', '/forest', '/next', '/suggestions']) {
			it(`GET ${path} liefert 401 ohne Session-Cookie`, async () => {
				const res = await fetch(`${server.baseUrl}${path}`);
				assert.equal(res.status, 401);
			});
		}
	});

	// ── AC 2 — Redirect zu Google ────────────────────────────────────────────

	describe('AC 2 — GET /auth/google', () => {
		it('liefert 302 mit Location-Header auf accounts.google.com', async () => {
			const res = await fetch(`${server.baseUrl}/auth/google`, { redirect: 'manual' });
			assert.equal(res.status, 302);
			const location = res.headers.get('location');
			assert.ok(location, 'Location-Header sollte gesetzt sein');
			assert.equal(
				new URL(location).origin,
				'https://accounts.google.com',
				`Location sollte auf accounts.google.com zeigen, war: ${location}`,
			);
		});
	});

	// ── AC 3 — Nicht erlaubte E-Mail → 401, kein Cookie ──────────────────────
	// Status-Code auf 401 aktualisiert (war 403): AK-8 aus #193 definiert 401 als neuen Vertrag.

	describe('AC 3 — Login mit nicht erlaubter E-Mail', () => {
		it('liefert 401 und setzt kein Session-Cookie', async () => {
			const res = await fetch(`${server.baseUrl}/auth/test-login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'intruder@example.com', displayName: 'Intruder' }),
			});
			assert.equal(res.status, 401);
			assert.equal(res.headers.get('set-cookie'), null, 'Es darf kein Session-Cookie gesetzt werden');
		});
	});

	// ── AC 4 — /auth/me mit gültiger Session → 200 ───────────────────────────

	describe('AC 4 — GET /auth/me mit gültiger Session', () => {
		it('liefert 200 mit { email, displayName }', async () => {
			const cookie = await testLogin();
			const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.email, ALLOWED_EMAIL);
			assert.equal(body.displayName, ALLOWED_NAME);
		});
	});

	// ── AC 5 — /auth/me ohne Session → 401 ───────────────────────────────────

	describe('AC 5 — GET /auth/me ohne Session', () => {
		it('liefert 401', async () => {
			const res = await fetch(`${server.baseUrl}/auth/me`);
			assert.equal(res.status, 401);
		});
	});

	// ── AC 6 — Logout invalidiert die Session ────────────────────────────────

	describe('AC 6 — POST /auth/logout', () => {
		it('nach Logout liefert GET /auth/me 401', async () => {
			const cookie = await testLogin();

			const me = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(me.status, 200, 'Vorbedingung: Session ist vor dem Logout gültig');

			const logout = await fetch(`${server.baseUrl}/auth/logout`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(logout.status, 200);

			// Nach dem Logout darf derselbe Cookie keine gültige Session mehr ausweisen.
			const afterLogout = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(afterLogout.status, 401);
		});
	});

	// ── AK-8 (Issue #193) — Nicht-erlaubte E-Mail → 401 via Multi-Email-Gate ──
	describe('AK-8 — Multi-User-Gate: nicht erlaubte E-Mail → 401', () => {
		it('POST /auth/test-login mit nicht-erlaubter E-Mail liefert 401', async () => {
			// Nicht in der Allowlist → requireAuth soll 401 zurückgeben
			const res = await fetch(`${server.baseUrl}/auth/test-login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'not-allowed@evil.com', displayName: 'Evil User' }),
			});
			assert.equal(res.status, 401);
		});
	});

	// ── Passwort-Authentifizierung (Issue #206) ───────────────────────────────
	// Diese Tests werden grün, sobald POST /auth/register und POST /auth/login existieren.

	describe('AK 1 — POST /auth/register', () => {
		it('neue E-Mail + Passwort → 201 + httpOnly Session-Cookie', async () => {
			const res = await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'new@example.com', password: 'sicher123' }),
			});
			assert.equal(res.status, 201);
			const setCookie = res.headers.get('set-cookie');
			assert.ok(setCookie, 'Register muss einen Set-Cookie-Header setzen');
			assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie muss HttpOnly sein');
		});

		it('doppelte E-Mail → 409', async () => {
			await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'dup@example.com', password: 'sicher123' }),
			});
			const res = await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'dup@example.com', password: 'anderes456' }),
			});
			assert.equal(res.status, 409);
		});
	});

	describe('AK 2 — POST /auth/login', () => {
		it('gültige Credentials → 200 + httpOnly Session-Cookie', async () => {
			await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'login@example.com', password: 'sicher123' }),
			});
			const res = await fetch(`${server.baseUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'login@example.com', password: 'sicher123' }),
			});
			assert.equal(res.status, 200);
			const setCookie = res.headers.get('set-cookie');
			assert.ok(setCookie, 'Login muss einen Set-Cookie-Header setzen');
			assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie muss HttpOnly sein');
		});

		it('falsches Passwort → 401', async () => {
			await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'wrong@example.com', password: 'richtig' }),
			});
			const res = await fetch(`${server.baseUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'wrong@example.com', password: 'falsch' }),
			});
			assert.equal(res.status, 401);
		});

		it('unbekannte E-Mail → 401', async () => {
			const res = await fetch(`${server.baseUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'unknown@example.com', password: 'egal' }),
			});
			assert.equal(res.status, 401);
		});
	});

	// ── Issue #1136 — OAuth-Fehler im manuellen Login-Pfad → /?error=<code> ───
	// Vertrag (docs/spec/issue-1136.md, AK2): Der failureRedirect des gemeinsamen Callbacks
	// adressiert im MANUELLEN Pfad die Frontend-Fehler-Weiche /?error=<code> statt der rohen
	// JSON-Route /auth/error. Der stille Pfad (/?silent=unavailable) bleibt unverändert.
	// Der Callback ohne Session/Google-Antwort schlägt bei Passport fehl → failureRedirect greift.

	describe('AK2 (#1136) — OAuth-Fehler im manuellen Login-Pfad', () => {
		it('GET /auth/google/callback ohne Session → 302 auf /?error=… (nicht /auth/error)', async () => {
			const res = await fetch(`${server.baseUrl}/auth/google/callback`, { redirect: 'manual' });
			assert.equal(res.status, 302);
			const location = res.headers.get('location');
			assert.ok(location, 'Location-Header sollte gesetzt sein');
			const target = new URL(location, server.baseUrl);
			assert.equal(target.pathname, '/', 'Redirect-Ziel sollte die App-Wurzel sein');
			assert.match(target.search, /[?&]error=/, `Redirect sollte ?error= tragen, war: ${location}`);
			assert.ok(!target.search.includes('silent='), 'Manueller Pfad darf nicht silent=unavailable melden');
			assert.notEqual(location, '/auth/error', 'Rohe JSON-Fehler-Route ist als Ziel abgelöst');
		});

		it('GET /auth/error bleibt als API-Fallback erhalten (rohes JSON 400)', async () => {
			const res = await fetch(`${server.baseUrl}/auth/error`);
			assert.equal(res.status, 400);
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok(body.error, 'Fallback sollte ein JSON-Fehlerfeld liefern');
		});
	});

	describe('AK 3 — POST /auth/logout (Passwort-Session)', () => {
		it('nach Passwort-Login + Logout ist Session ungültig: GET /auth/me → 401', async () => {
			await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'logout-pw@example.com', password: 'sicher123' }),
			});
			const loginRes = await fetch(`${server.baseUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'logout-pw@example.com', password: 'sicher123' }),
			});
			assert.equal(loginRes.status, 200, 'Vorbedingung: Login muss 200 liefern');
			const setCookie = loginRes.headers.get('set-cookie');
			assert.ok(setCookie, 'Login muss einen Cookie setzen');
			const cookie = cookieFromSetCookie(setCookie);

			const logoutRes = await fetch(`${server.baseUrl}/auth/logout`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
			assert.equal(logoutRes.status, 200);

			const meRes = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(meRes.status, 401, 'Session nach Logout muss ungültig sein');
		});
	});
});
