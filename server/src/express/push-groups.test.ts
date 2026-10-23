import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #2850 (Spec: docs/spec/issue-2850.md) — Push-Gruppen pro User.
 *
 * AK2: GET/PUT /push-groups — die vier Gruppen-Flags werden serverseitig pro Nutzer
 *   gespeichert (Defaults: drei Gruppen an, Tipps aus); PUT wehrt Nicht-Booleans mit 400
 *   ohne Persistenz ab; Datenisolation zwischen Nutzern. `carePushEnabled` bleibt unverändert
 *   bei `/care-config` (AK1, bestehende Tests).
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-2850');

type PushGroups = {
	taskPushEnabled: boolean;
	successPushEnabled: boolean;
	groupPushEnabled: boolean;
	tipPushEnabled: boolean;
};

const DEFAULTS: PushGroups = {
	taskPushEnabled: true,
	successPushEnabled: true,
	groupPushEnabled: true,
	tipPushEnabled: false,
};

let server: TestServer;

const getConfig = (cookie: string): Promise<Response> => server.json('/push-groups', { headers: { Cookie: cookie } });

const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/push-groups', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Push-Gruppen pro User (#2850 AK2)', () => {
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
		assert.equal((await putConfig('cookie=none', DEFAULTS)).status, 401);
	});

	it('GET liefert die Defaults (drei Gruppen an, Tipps aus), solange nichts gespeichert ist', async () => {
		const cookie = await server.register('groups-defaults@example.com', 'password123');
		const res = await getConfig(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), DEFAULTS);
	});

	it('PUT persistiert die vier Flags; GET liefert sie nach dem Speichern zurück', async () => {
		const cookie = await server.register('groups-put@example.com', 'password123');
		const geaendert: PushGroups = {
			taskPushEnabled: false,
			successPushEnabled: true,
			groupPushEnabled: false,
			tipPushEnabled: true,
		};

		const put = await putConfig(cookie, geaendert);
		assert.equal(put.status, 200);

		const res = await getConfig(cookie);
		assert.deepEqual(await res.json(), geaendert);
	});

	it('PUT wehrt Nicht-Booleans mit 400 ab — ohne Persistenz', async () => {
		const cookie = await server.register('groups-400@example.com', 'password123');

		const res = await putConfig(cookie, { taskPushEnabled: 'jede Zeichenkette' });
		assert.equal(res.status, 400);

		assert.deepEqual(await (await getConfig(cookie)).json(), DEFAULTS, 'ungültiger PUT ändert nichts');
	});

	it('Datenisolation: PUT von Nutzer A ändert die Gruppen von Nutzer B nicht', async () => {
		const cookieA = await server.register('groups-a@example.com', 'password123');
		const cookieB = await server.register('groups-b@example.com', 'password123');

		const put = await putConfig(cookieA, { ...DEFAULTS, tipPushEnabled: true });
		assert.equal(put.status, 200);

		assert.deepEqual(await (await getConfig(cookieB)).json(), DEFAULTS);
	});
});
