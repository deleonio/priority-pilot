import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Pass-Through-Modus: kein Auth-Kontext konfiguriert (#1901 AK8) — Env VOR dem Server-Start leeren.
for (const key of [
	'SESSION_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
	'GOOGLE_ALLOWED_EMAIL',
	'GOOGLE_ALLOWED_EMAILS',
]) {
	delete process.env[key];
}

let server: TestServer;

describe('Issue #1901 AK8 — Pass-Through ohne Zustimmungspflicht', () => {
	before(async () => {
		await resetDb();
		server = await startTestServer();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('/auth/me des synthetischen Nutzers meldet termsAccepted: true', async () => {
		const res = await fetch(`${server.baseUrl}/auth/me`);
		assert.equal(res.status, 200);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(body.termsAccepted, true);
	});
});
