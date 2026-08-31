import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	type TestServer,
	applyTestAuthEnv,
	testLoginResponse,
} from '../test/helpers.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('test-secret-for-tests');

const ALLOWED_EMAIL = 'testuser@example.com';
const ALLOWED_NAME = 'Test User';

let server: TestServer;

const cookieFromSetCookie = (setCookie: string): string => setCookie.split(';')[0];

describe('Issue #217 — Avatar mit Google Profilbild', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	// ── AC-217-1 — Google-Login: /auth/me enthält avatarUrl als HTTPS-String ──

	describe('AC-217-1 — Google-Login mit Foto: avatarUrl als HTTPS-String', () => {
		it('liefert avatarUrl wenn test-login eine HTTPS-URL uebergibt', async () => {
			const loginRes = await testLoginResponse(server, ALLOWED_EMAIL, {
				displayName: ALLOWED_NAME,
				avatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
			});
			assert.equal(loginRes.status, 200, 'test-login muss 200 liefern');
			const setCookie = loginRes.headers.get('set-cookie');
			assert.ok(setCookie, 'test-login muss Cookie setzen');
			const cookie = cookieFromSetCookie(setCookie);

			const meRes = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(meRes.status, 200);
			const body = (await meRes.json()) as Record<string, unknown>;
			assert.ok('avatarUrl' in body, '/auth/me muss avatarUrl enthalten');
			assert.equal(
				body.avatarUrl,
				'https://lh3.googleusercontent.com/a/photo.jpg',
				'avatarUrl muss die uebergebene HTTPS-URL sein',
			);
		});
	});

	// ── AC-217-2 — Google ohne Foto: avatarUrl ist null ──────────────────────

	describe('AC-217-2 — Google-Login ohne Foto: avatarUrl ist null', () => {
		it('liefert avatarUrl: null wenn kein avatarUrl uebergeben wird', async () => {
			const loginRes = await testLoginResponse(server, ALLOWED_EMAIL, { displayName: ALLOWED_NAME });
			assert.equal(loginRes.status, 200, 'test-login muss 200 liefern');
			const setCookie = loginRes.headers.get('set-cookie');
			assert.ok(setCookie, 'test-login muss Cookie setzen');
			const cookie = cookieFromSetCookie(setCookie);

			const meRes = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(meRes.status, 200);
			const body = (await meRes.json()) as Record<string, unknown>;
			assert.ok('avatarUrl' in body, '/auth/me muss avatarUrl enthalten (auch wenn null)');
			assert.equal(body.avatarUrl, null, 'Kein Foto -> avatarUrl muss null sein');
		});
	});

	// ── AC-217-3 — Email/Passwort-Login: avatarUrl ist null ──────────────────

	describe('AC-217-3 — Email/Passwort-Login: avatarUrl ist null', () => {
		it('liefert avatarUrl: null nach Passwort-Login', async () => {
			await fetch(`${server.baseUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'avatar-pw@example.com', password: 'sicher123' }),
			});
			const loginRes = await fetch(`${server.baseUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'avatar-pw@example.com', password: 'sicher123' }),
			});
			assert.equal(loginRes.status, 200, 'Passwort-Login muss 200 liefern');
			const setCookie = loginRes.headers.get('set-cookie');
			assert.ok(setCookie, 'Login muss Cookie setzen');
			const cookie = cookieFromSetCookie(setCookie);

			const meRes = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
			assert.equal(meRes.status, 200);
			const body = (await meRes.json()) as Record<string, unknown>;
			assert.ok('avatarUrl' in body, '/auth/me muss avatarUrl enthalten');
			assert.equal(body.avatarUrl, null, 'Passwort-User hat kein Avatar -> null');
		});
	});
});
