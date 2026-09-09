import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für den Admin-Bootstrap (Rollensystem admin/member): ADMIN_EMAILS befördert
// automatisch zu `role: 'admin'` — bei Registrierung, Passwort-Login und Test-Login. Eigene
// Datei, damit ADMIN_EMAILS nicht mit anderen Auth-Testfiles kollidiert (node:test isoliert
// Testdateien in eigenen Prozessen).
process.env.GOOGLE_ALLOWED_EMAILS = 'boss@example.com,worker@example.com';
process.env.ADMIN_EMAILS = 'boss@example.com';
applyTestAuthEnv('admin-bootstrap-test');

const ADMIN_EMAIL = 'boss@example.com';
const OTHER_EMAIL = 'worker@example.com';

let server: TestServer;

/** Extrahiert das erste `name=value`-Paar aus einem Set-Cookie-Header (ohne Attribute). */
const cookieFromSetCookie = (setCookie: string): string => setCookie.split(';')[0];

describe('Admin-Bootstrap über ADMIN_EMAILS (Rollensystem admin/member)', () => {
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

	it('POST /auth/register mit ADMIN_EMAILS-E-Mail → /auth/me liefert role=admin', async () => {
		const res = await fetch(`${server.baseUrl}/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: ADMIN_EMAIL, password: 'sicher123' }),
		});
		assert.equal(res.status, 201);
		const setCookie = res.headers.get('set-cookie');
		assert.ok(setCookie, 'Register muss einen Set-Cookie-Header setzen');
		const cookie = cookieFromSetCookie(setCookie);

		const me = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
		assert.equal(me.status, 200);
		const body = (await me.json()) as { role: string };
		assert.equal(body.role, 'admin', 'ADMIN_EMAILS befördert bereits bei der Registrierung');
	});

	it('POST /auth/register mit anderer E-Mail → role=member', async () => {
		const res = await fetch(`${server.baseUrl}/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: OTHER_EMAIL, password: 'sicher123' }),
		});
		const cookie = cookieFromSetCookie(res.headers.get('set-cookie') as string);
		const me = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
		const body = (await me.json()) as { role: string };
		assert.equal(body.role, 'member');
	});

	it('Bestandsnutzer wird bei Login zu admin befördert, sobald die E-Mail in ADMIN_EMAILS steht', async () => {
		await fetch(`${server.baseUrl}/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: ADMIN_EMAIL, password: 'sicher123' }),
		});
		// Zweiter Login (statt Registrierung) durchläuft den Beförderungs-Abgleich in routes/auth.ts.
		const loginRes = await fetch(`${server.baseUrl}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: ADMIN_EMAIL, password: 'sicher123' }),
		});
		assert.equal(loginRes.status, 200);
		const body = (await loginRes.json()) as { role: string };
		assert.equal(body.role, 'admin');
	});

	it('POST /auth/test-login ohne explizite role folgt ADMIN_EMAILS', async () => {
		const cookie = await server.login(ADMIN_EMAIL);
		const me = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
		const body = (await me.json()) as { role: string };
		assert.equal(body.role, 'admin');
	});
});
