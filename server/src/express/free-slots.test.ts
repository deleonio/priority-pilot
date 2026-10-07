import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1990 (Spec docs/spec/issue-1990.md) — AK3 (Einstellung pro Nutzer, Validierung,
 * Datenisolation) und AK4 (ohne Kalenderquelle 200 + leere Liste). Muster: geo-config.test.ts.
 * Rot, bis die Routen existieren (heute 404/SPA-Fallback). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1990');

let server: TestServer;

const getConfig = (cookie: string): Promise<Response> =>
	server.json('/free-slot-config', { headers: { Cookie: cookie } });
const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/free-slot-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Freie Zeit (#1990)', () => {
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

	it('AK3: ohne Session → 401', async () => {
		assert.equal((await getConfig('cookie=none')).status, 401);
	});

	it('AK3: GET liefert Default 30, PUT speichert, GET liefert den gespeicherten Wert', async () => {
		const cookie = await server.register('free-slot-put@example.com', 'password123');
		assert.deepEqual(await (await getConfig(cookie)).json(), { freeSlotMinMinutes: 30 });
		assert.equal((await putConfig(cookie, { freeSlotMinMinutes: 45 })).status, 200);
		assert.deepEqual(await (await getConfig(cookie)).json(), { freeSlotMinMinutes: 45 });
	});

	for (const [label, value] of [
		['unter 10', 9],
		['über 240', 241],
		['nicht ganzzahlig', 30.5],
		['kein Number', '30'],
	] as const) {
		it(`AK3: PUT weist ${label} ab (400), nichts wird gespeichert`, async () => {
			const cookie = await server.register(`free-slot-bad-${label.replace(/\W/g, '')}@example.com`);
			assert.equal((await putConfig(cookie, { freeSlotMinMinutes: value })).status, 400);
			assert.deepEqual(await (await getConfig(cookie)).json(), { freeSlotMinMinutes: 30 });
		});
	}

	it('AK3: Dataisolation — B sieht nicht den Wert von A', async () => {
		const a = await server.register('free-slot-a@example.com', 'password123');
		const b = await server.register('free-slot-b@example.com', 'password123');
		await putConfig(a, { freeSlotMinMinutes: 120 });
		assert.deepEqual(await (await getConfig(b)).json(), { freeSlotMinMinutes: 30 });
	});

	it('AK4: ohne Kalenderquelle liefert GET /tasks/free-slots 200 und []', async () => {
		const cookie = await server.register('free-slot-empty@example.com', 'password123');
		const res = await server.json('/tasks/free-slots', { headers: { Cookie: cookie } });
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), []);
	});
});
