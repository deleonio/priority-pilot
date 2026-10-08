import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #2398 (Spec: docs/spec/issue-2398.md) — inhaltliche Präferenzen am Konto.
 *
 * AK1: `PUT /account-preferences` speichert KI-, Balance-Priorität-, Expertenmodus- und
 *   Geo-Schalter; `GET` liefert sie, ohne Wert die bisherigen Frontend-Defaults; ungültig → 400.
 * AK2: Kontoisolation und 401 ohne Anmeldung.
 *
 * Muster `balance-variant.test.ts` (#2009). Rot, bis der Endpoint existiert. KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-2398');

type Prefs = { aiEnabled: boolean; balancePriority: boolean; expertMode: boolean; geolocationEnabled: boolean };

/** Bisherige Frontend-Defaults (aiPreferences, balancePreferences, expertMode, useGeolocation). */
const DEFAULTS: Prefs = { aiEnabled: true, balancePriority: true, expertMode: false, geolocationEnabled: false };

let server: TestServer;

const get = (cookie: string): Promise<Response> => server.json('/account-preferences', { headers: { Cookie: cookie } });

const put = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/account-preferences', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Konto-Präferenzen (#2398 AK1–AK2)', () => {
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

	it('AK2 — ohne Session → 401 (GET und PUT)', async () => {
		assert.equal((await get('cookie=none')).status, 401);
		const res = await fetch(`${server.baseUrl}/account-preferences`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ expertMode: true }),
		});
		assert.equal(res.status, 401);
	});

	it('AK1 — GET liefert die Frontend-Defaults, solange nichts gespeichert ist', async () => {
		const cookie = await server.register('prefs-default@example.com', 'password123');
		const res = await get(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual((await res.json()) as Prefs, DEFAULTS);
	});

	it('AK1 — PUT speichert alle vier Schalter, GET liefert sie zurück', async () => {
		const cookie = await server.register('prefs-alle@example.com', 'password123');
		const target: Prefs = { aiEnabled: false, balancePriority: false, expertMode: true, geolocationEnabled: true };
		const res = await put(cookie, target);
		assert.equal(res.status, 200);
		assert.deepEqual((await res.json()) as Prefs, target);
		assert.deepEqual((await (await get(cookie)).json()) as Prefs, target);
	});

	it('AK1 — PUT mit Teilmenge ändert nur die gesendeten Felder', async () => {
		const cookie = await server.register('prefs-teil@example.com', 'password123');
		await put(cookie, { expertMode: true, aiEnabled: false });
		await put(cookie, { geolocationEnabled: true });
		assert.deepEqual((await (await get(cookie)).json()) as Prefs, {
			aiEnabled: false,
			balancePriority: true,
			expertMode: true,
			geolocationEnabled: true,
		});
	});

	const invalid: Array<[string, unknown]> = [
		['String statt boolean', { aiEnabled: 'false' }],
		['Zahl statt boolean', { expertMode: 1 }],
		['null', { balancePriority: null }],
		['leeren Body', {}],
		['gültiges Feld neben einem ungültigen', { expertMode: true, geolocationEnabled: 'ja' }],
	];
	for (const [index, [label, body]] of invalid.entries()) {
		it(`AK1 — PUT weist ${label} ab (400) und persistiert nichts`, async () => {
			const cookie = await server.register(`prefs-invalid-${index}@example.com`, 'password123');
			const res = await put(cookie, body);
			assert.equal(res.status, 400);
			assert.deepEqual((await (await get(cookie)).json()) as Prefs, DEFAULTS);
		});
	}

	it('AK2 — Dataisolation: Konto B sieht und ändert nie die Werte von Konto A', async () => {
		const cookieA = await server.register('prefs-a@example.com', 'password123');
		const cookieB = await server.register('prefs-b@example.com', 'password123');
		await put(cookieA, { expertMode: true, aiEnabled: false });

		assert.deepEqual((await (await get(cookieB)).json()) as Prefs, DEFAULTS, 'B erhält die Defaults');

		await put(cookieB, { balancePriority: false });
		const ofA = (await (await get(cookieA)).json()) as Prefs;
		assert.equal(ofA.balancePriority, true, 'B darf A nicht überschreiben');
		assert.equal(ofA.expertMode, true);
		assert.equal(ofA.aiEnabled, false);
	});
});
