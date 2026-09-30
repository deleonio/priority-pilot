import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { resetDb, closeDb, startTestServer, testLoginOn, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
// Neue Konstante der aktuellen Fassung (#1901) — fehlendes Modul ist der legitime erste Rot-Zustand.
import { TERMS_VERSION } from '../logics/legal.js';

process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('terms-consent');

const EMAIL = 'testuser@example.com';
let server: TestServer;

const me = async (cookie: string): Promise<Record<string, unknown>> => {
	const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
	assert.equal(res.status, 200);
	return (await res.json()) as Record<string, unknown>;
};

const accept = (cookie: string | null, body: Record<string, unknown>): Promise<Response> =>
	fetch(`${server.baseUrl}/auth/terms`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
		body: JSON.stringify(body),
	});

const dbRow = async (): Promise<{ termsAcceptedAt: string | null; termsVersion: string | null }> => {
	const [rows] = await sequelize.query('SELECT `termsAcceptedAt`, `termsVersion` FROM `users` WHERE `email` = ?', {
		replacements: [EMAIL],
	});
	return (rows as { termsAcceptedAt: string | null; termsVersion: string | null }[])[0];
};

describe('Issue #1901 — Zustimmung zu Nutzungsbedingungen und Datenschutz (Server)', () => {
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

	it('AK1: /auth/me meldet fehlende Zustimmung, nach Zustimmung nicht mehr', async () => {
		const cookie = await testLoginOn(server, EMAIL);
		assert.equal((await me(cookie)).termsAccepted, false);
		const res = await accept(cookie, { acceptTerms: true, acceptPrivacy: true });
		assert.equal(res.status, 204);
		assert.equal((await me(cookie)).termsAccepted, true);
	});

	it('AK2: Speichern legt Zeitpunkt und aktuelle Fassung am eigenen Konto ab', async () => {
		const cookie = await testLoginOn(server, EMAIL);
		const before = Date.now();
		await accept(cookie, { acceptTerms: true, acceptPrivacy: true });
		const row = await dbRow();
		assert.equal(row.termsVersion, TERMS_VERSION);
		assert.ok(row.termsAcceptedAt, 'Zeitpunkt muss gesetzt sein');
		assert.ok(new Date(row.termsAcceptedAt).getTime() >= before - 1000, 'Zeitpunkt muss aktuell sein');
	});

	it('AK2: ohne Session 401', async () => {
		const res = await accept(null, { acceptTerms: true, acceptPrivacy: true });
		assert.equal(res.status, 401);
	});

	it('AK2: ohne beide Bestätigungen 400 und nichts gespeichert', async () => {
		const cookie = await testLoginOn(server, EMAIL);
		for (const body of [
			{},
			{ acceptTerms: true },
			{ acceptTerms: true, acceptPrivacy: false },
			{ acceptPrivacy: true },
		]) {
			const res = await accept(cookie, body);
			assert.equal(res.status, 400, JSON.stringify(body));
		}
		assert.equal((await me(cookie)).termsAccepted, false);
		assert.equal((await dbRow()).termsVersion, null);
	});

	it('AK3: abweichende gespeicherte Fassung (Fassungswechsel) meldet wieder fehlende Zustimmung', async () => {
		const cookie = await testLoginOn(server, EMAIL);
		await accept(cookie, { acceptTerms: true, acceptPrivacy: true });
		assert.equal((await me(cookie)).termsAccepted, true);
		await sequelize.query('UPDATE `users` SET `termsVersion` = ? WHERE `email` = ?', {
			replacements: ['1900-01-01', EMAIL],
		});
		assert.equal((await me(cookie)).termsAccepted, false);
	});
});
