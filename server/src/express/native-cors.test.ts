import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * CORS fuer die Android-App (#2377 AK6/AK7, Spec docs/spec/issue-2377.md): nur der WebView-Ursprung
 * `https://localhost` bekommt Freigabe — ohne Credentials (Bearer statt Cookies).
 */
applyTestAuthEnv('native-cors');

const APP_ORIGIN = 'https://localhost';

let server: TestServer;

const preflight = (origin: string) =>
	fetch(`${server.baseUrl}/auth/me`, {
		method: 'OPTIONS',
		headers: {
			Origin: origin,
			'Access-Control-Request-Method': 'GET',
			// Genau die Header, die das Frontend sendet; `x-csrf-token` fehlte und blockierte jeden POST der App.
			'Access-Control-Request-Headers': 'authorization, content-type, x-client-channel, x-csrf-token, accept-language',
		},
	});

describe('CORS fuer den App-Ursprung https://localhost (#2377)', () => {
	before(async () => {
		server = await startTestServer();
	});
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('AK6: Preflight antwortet 204 mit Allow-Origin und allen Headern des Frontends, ohne Credentials', async () => {
		const res = await preflight(APP_ORIGIN);
		assert.equal(res.status, 204);
		assert.equal(res.headers.get('access-control-allow-origin'), APP_ORIGIN);
		const allowed = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase();
		for (const header of ['authorization', 'content-type', 'x-client-channel', 'x-csrf-token', 'accept-language']) {
			assert.ok(allowed.includes(header), `Allow-Headers enthaelt ${header}`);
		}
		assert.equal(res.headers.get('access-control-allow-credentials'), null);
	});

	it('AK6: auch normale Antworten an diesen Origin tragen Allow-Origin', async () => {
		const res = await fetch(`${server.baseUrl}/auth/providers`, { headers: { Origin: APP_ORIGIN } });
		assert.equal(res.headers.get('access-control-allow-origin'), APP_ORIGIN);
	});

	it('AK7: ein fremder Origin bekommt keine CORS-Freigabe (Preflight und einfacher Request)', async () => {
		const pre = await preflight('https://evil.example');
		assert.equal(pre.headers.get('access-control-allow-origin'), null);
		const res = await fetch(`${server.baseUrl}/auth/providers`, { headers: { Origin: 'https://evil.example' } });
		assert.equal(res.headers.get('access-control-allow-origin'), null);
	});
});
