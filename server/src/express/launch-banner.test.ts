/**
 * Rote Spec-Tests für Issue #2229 (Spec docs/spec/issue-2229.md) — AK1: `GET /auth/me` meldet
 * über `launchBanner`, ob der Einladungs-Banner aktiv ist. Rot, bis die Route das Feld liefert.
 */
import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

process.env.GOOGLE_ALLOWED_EMAILS = 'banner@example.com';
applyTestAuthEnv('launch-banner-test');

let server: TestServer;
let cookie: string;

const me = async (): Promise<{ launchBanner?: boolean }> => {
	const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { cookie } });
	assert.equal(res.status, 200);
	return (await res.json()) as { launchBanner?: boolean };
};

describe('GET /auth/me — launchBanner (#2229)', () => {
	before(async () => {
		server = await startTestServer();
	});
	after(async () => {
		await server.close();
		await closeDb();
	});
	beforeEach(async () => {
		await resetDb();
		cookie = await server.register('banner@example.com');
	});
	afterEach(() => {
		delete process.env.LAUNCH_BANNER_ENABLED;
	});

	it('AK1: LAUNCH_BANNER_ENABLED=true → launchBanner true', async () => {
		process.env.LAUNCH_BANNER_ENABLED = 'true';
		assert.equal((await me()).launchBanner, true);
	});

	it('AK1: Variable nicht gesetzt → launchBanner false (Default aus)', async () => {
		assert.equal((await me()).launchBanner, false);
	});

	it('AK1: anderer Wert als "true" → launchBanner false', async () => {
		process.env.LAUNCH_BANNER_ENABLED = 'false';
		assert.equal((await me()).launchBanner, false);
	});
});
