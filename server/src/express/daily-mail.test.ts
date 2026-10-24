import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Review-Finding zu PR #2935 (#1426 Morgen-Mail): Route `/daily-mail-config` war ungetestet.
 * Muster: push-groups.test.ts (#2850) — GET-Default (ein), PUT-Persistenz, 400 ohne
 * Persistenz bei Nicht-Boolean, 401 anonym.
 */

applyTestAuthEnv('test-secret-issue-1426');

let server: TestServer;

const getConfig = (cookie: string): Promise<Response> =>
	server.json('/daily-mail-config', { headers: { Cookie: cookie } });

const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/daily-mail-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Morgen-Mail-Schalter — /daily-mail-config (#1426)', () => {
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

	it('ohne Session → 401 (GET und PUT)', async () => {
		assert.equal((await getConfig('cookie=none')).status, 401);
		assert.equal((await putConfig('cookie=none', { dailyMailEnabled: true })).status, 401);
	});

	it('GET liefert den Default (ein), solange nichts gespeichert ist', async () => {
		const cookie = await server.register('daily-mail-defaults@example.com', 'password123');
		const res = await getConfig(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { dailyMailEnabled: true });
	});

	it('PUT persistiert den Schalter; GET liefert ihn zurück', async () => {
		const cookie = await server.register('daily-mail-put@example.com', 'password123');
		const put = await putConfig(cookie, { dailyMailEnabled: false });
		assert.equal(put.status, 200);
		assert.deepEqual(await (await getConfig(cookie)).json(), { dailyMailEnabled: false });
	});

	it('PUT wehrt Nicht-Booleans mit 400 ab — ohne Persistenz', async () => {
		const cookie = await server.register('daily-mail-400@example.com', 'password123');
		const res = await putConfig(cookie, { dailyMailEnabled: 'jede Zeichenkette' });
		assert.equal(res.status, 400);
		assert.deepEqual(
			await (await getConfig(cookie)).json(),
			{ dailyMailEnabled: true },
			'ungültiger PUT ändert nichts',
		);
	});
});
