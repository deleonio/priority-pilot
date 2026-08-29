import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1098 (Spec docs/spec/issue-1098.md) — pro-User Geo-Konfiguration.
 *
 * AK7: `GET`/`PUT /geo-config` hinter requireAuth persistieren Anzeige-Entfernung (Default 5 km),
 *   Alarm-Entfernung (Default 1 km) und Positionsermittlungs-Intervall (Default 5 min)
 *   **serverseitig pro User** — KEIN localStorage. Der Server validiert die Kreuz-Schranken
 *   (AK2): alarm ∈ [1, display], display ∈ [alarm, 50], interval ∈ [1, 60]; Verstöße → 400.
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback). KEIN Produktivcode.
 * Muster: routes/llmProviders.test.ts (per-User-Konfiguration + Dataisolation).
 */

process.env.SESSION_SECRET = 'test-secret-issue-1098';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

type GeoConfig = { displayDistanceKm: number; alarmDistanceKm: number; intervalMinutes: number };

const DEFAULTS: GeoConfig = { displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 5 };

let server: TestServer;

const register = async (email: string, password = 'password123'): Promise<string> => {
	const res = await fetch(`${server.baseUrl}/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	assert.equal(res.status, 201, `Register ${email} muss 201 liefern`);
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Register muss einen Set-Cookie-Header setzen');
	return setCookie.split(';')[0];
};

const getConfig = (cookie: string): Promise<Response> =>
	fetch(`${server.baseUrl}/geo-config`, { headers: { Cookie: cookie } });

const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	fetch(`${server.baseUrl}/geo-config`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Geo-Konfiguration pro User (#1098 AK7)', () => {
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
		assert.equal(
			(
				await fetch(`${server.baseUrl}/geo-config`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(DEFAULTS),
				})
			).status,
			401,
		);
	});

	it('GET liefert die Defaults (5 km / 1 km / 5 min), solange nichts gespeichert ist', async () => {
		const cookie = await register('geo-defaults@example.com');
		const res = await getConfig(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual((await res.json()) as GeoConfig, DEFAULTS);
	});

	it('PUT speichert eine valide Config, GET liefert sie zurück (auch nach Neuladen der DB-Session)', async () => {
		const cookie = await register('geo-put@example.com');
		const next: GeoConfig = { displayDistanceKm: 20, alarmDistanceKm: 3, intervalMinutes: 15 };
		const put = await putConfig(cookie, next);
		assert.equal(put.status, 200, 'valide Config muss 200 liefern');
		const stored = (await (await getConfig(cookie)).json()) as GeoConfig;
		assert.deepEqual(stored, next, 'GET muss die gespeicherten Werte liefern, nicht die Defaults');
	});

	const invalid: Array<[string, GeoConfig]> = [
		['Alarm unter 1 km', { displayDistanceKm: 5, alarmDistanceKm: 0, intervalMinutes: 5 }],
		['Alarm größer Anzeige', { displayDistanceKm: 5, alarmDistanceKm: 6, intervalMinutes: 5 }],
		['Anzeige unter Alarm', { displayDistanceKm: 0, alarmDistanceKm: 1, intervalMinutes: 5 }],
		['Anzeige über 50 km', { displayDistanceKm: 51, alarmDistanceKm: 1, intervalMinutes: 5 }],
		['Intervall über 60 min', { displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 61 }],
		['Intervall unter 1 min', { displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 0 }],
	];
	for (const [index, [label, body]] of invalid.entries()) {
		it(`PUT weist Schranken-Verstoß ab: ${label} (400)`, async () => {
			const cookie = await register(`geo-invalid-${index}@example.com`);
			const res = await putConfig(cookie, body);
			assert.equal(res.status, 400, `${label} ist keine gültige Kombination`);
			// Der Verstoß darf nichts persistieren:
			assert.deepEqual((await (await getConfig(cookie)).json()) as GeoConfig, DEFAULTS);
		});
	}

	it('Dataisolation: User B sieht seine eigene (Default-)Config, nicht die von User A', async () => {
		const cookieA = await register('geo-a@example.com');
		const cookieB = await register('geo-b@example.com');
		await putConfig(cookieA, { displayDistanceKm: 40, alarmDistanceKm: 10, intervalMinutes: 30 });

		const ofB = (await (await getConfig(cookieB)).json()) as GeoConfig;
		assert.deepEqual(ofB, DEFAULTS, 'B darf die Config von A nicht lesen');

		const putByB = await putConfig(cookieB, { displayDistanceKm: 8, alarmDistanceKm: 2, intervalMinutes: 10 });
		assert.equal(putByB.status, 200);
		const ofA = (await (await getConfig(cookieA)).json()) as GeoConfig;
		assert.deepEqual(
			ofA,
			{ displayDistanceKm: 40, alarmDistanceKm: 10, intervalMinutes: 30 },
			'PUT von B darf die Config von A nicht überschreiben',
		);
	});
});

describe('POST /geo/position (#1101 F5/F1)', () => {
	const postPosition = (cookie: string, body: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}/geo/position`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

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

	it('ohne Session → 401', async () => {
		const res = await postPosition('cookie=none', { lat: 52.5219, lon: 13.4132 });
		assert.equal(res.status, 401);
	});

	// F1: `NaN < -90` ist false — der NaN-Fall muss explizit 400 liefern, nicht in den Push-Job laufen.
	const nan: Array<[string, unknown]> = [
		['lat als String', { lat: 'abc', lon: 13.4 }],
		['lat null', { lat: null, lon: 13.4 }],
		['lon fehlt', { lat: 52.5 }],
	];
	for (const [index, [label, body]] of nan.entries()) {
		it(`weist nicht-numerische Koordinaten ab: ${label} (400)`, async () => {
			const cookie = await register(`geo-pos-nan-${index}@example.com`);
			const res = await postPosition(cookie, body);
			assert.equal(res.status, 400, `${label} muss als „keine Zahl“ abgelehnt werden`);
		});
	}

	it('weist Koordinaten außerhalb des Wertebereichs ab (400)', async () => {
		const cookie = await register('geo-pos-range@example.com');
		assert.equal((await postPosition(cookie, { lat: 91, lon: 13.4 })).status, 400);
		assert.equal((await postPosition(cookie, { lat: -91, lon: 13.4 })).status, 400);
		assert.equal((await postPosition(cookie, { lat: 52.5, lon: 181 })).status, 400);
		assert.equal((await postPosition(cookie, { lat: 52.5, lon: -181 })).status, 400);
	});

	it('gültige Koordinaten → 204 ohne Body (Fire-and-forget)', async () => {
		const cookie = await register('geo-pos-valid@example.com');
		const res = await postPosition(cookie, { lat: 52.5219, lon: 13.4132 });
		assert.equal(res.status, 204);
		assert.equal(await res.text(), '', '204 hat keinen Body');
	});
});
