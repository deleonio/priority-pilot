import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1066 (Spec docs/spec/issue-1066.md) — Endpoint `GET /tasks/nearby`.
 *
 * AK2: maximal 10 Tasks mit Koordinaten und offenem Status (Open/In process), aufsteigend nach
 *   Distanz zur übergebenen Position; Tasks ohne Koordinaten und erledigte erscheinen nie.
 * AK3: `distanceKm` in km mit einer Nachkommastelle (Haversine).
 * AK7: auth-geschützt (401 ohne Session) und owner-scoped — User A sieht keine Tasks von User B.
 *
 * Rot, bis der Endpoint existiert. KEIN Produktivcode.
 */

// Auth-Kontext wie in api-auth-protection.test.ts (#207): damit ist requireAuth aktiv und der
// Register-Endpunkt liefert einen Session-Cookie.
process.env.SESSION_SECRET = 'test-secret-issue-1066';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

/** Referenzposition: Berlin (Alexanderplatz). */
const LAT = 52.5219;
const LON = 13.4132;

let server: TestServer;

const register = async (email: string, password: string): Promise<string> => {
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

describe('GET /tasks/nearby (#1066)', () => {
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

	const createTask = async (
		cookie: string,
		body: Record<string, unknown>,
	): Promise<{ id: number; status?: string }> => {
		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});
		assert.equal(res.status, 201, `Task-Anlage muss 201 liefern (${JSON.stringify(body.title)})`);
		return (await res.json()) as { id: number; status?: string };
	};

	const nearby = async (cookie: string, lat = LAT, lon = LON): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks/nearby?lat=${lat}&lon=${lon}`, { headers: { Cookie: cookie } });

	it('ohne Session → 401 (AK7)', async () => {
		const res = await fetch(`${server.baseUrl}/tasks/nearby?lat=${LAT}&lon=${LON}`);
		assert.equal(res.status, 401);
	});

	it('liefert Tasks aufsteigend nach Distanz mit distanceKm in km (AK2, AK3)', async () => {
		const cookie = await register('nearby-sort@example.com', 'password123');
		// Distanzen von Berlin: Leipzig ~150 km, Hamburg ~255 km, Potsdam ~26 km
		await createTask(cookie, { title: 'Leipzig', latitude: 51.3397, longitude: 12.3731 });
		await createTask(cookie, { title: 'Hamburg', latitude: 53.5511, longitude: 9.9937 });
		await createTask(cookie, { title: 'Potsdam', latitude: 52.3906, longitude: 13.0645 });

		const res = await nearby(cookie);
		assert.equal(res.status, 200);
		const items = (await res.json()) as { id: number; title: string; distanceKm: number }[];
		assert.deepEqual(
			items.map((i) => i.title),
			['Potsdam', 'Leipzig', 'Hamburg'],
			'aufsteigend nach Distanz sortiert',
		);
		const [potsdam] = items;
		assert.equal(
			Math.round(potsdam.distanceKm * 10) / 10,
			potsdam.distanceKm,
			' distanceKm ist auf eine Nachkommastelle gerundet',
		);
		assert.ok(potsdam.distanceKm > 20 && potsdam.distanceKm < 35, 'Distanz Berlin–Potsdam ~26 km');
	});

	it('erledigte Tasks und Tasks ohne Koordinaten erscheinen nicht (AK2)', async () => {
		const cookie = await register('nearby-filter@example.com', 'password123');
		const done = await createTask(cookie, { title: 'Erledigt', latitude: 52.52, longitude: 13.405 });
		await fetch(`${server.baseUrl}/tasks/${done.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ status: 'Done' }),
		});
		await createTask(cookie, { title: 'Ohne Koordinate', address: 'Nur Freitext 1' });

		const res = await nearby(cookie);
		assert.equal(res.status, 200);
		const items = (await res.json()) as { title: string }[];
		assert.equal(items.length, 0, 'weder Done noch koordinatenlos dürfen erscheinen');
	});

	it('liefert maximal 10 Einträge (AK2)', async () => {
		const cookie = await register('nearby-cap@example.com', 'password123');
		for (let i = 0; i < 12; i += 1) {
			await createTask(cookie, { title: `Task ${i}`, latitude: 52.5 + i / 100, longitude: 13.4 });
		}
		const res = await nearby(cookie);
		assert.equal(res.status, 200);
		const items = (await res.json()) as unknown[];
		assert.ok(items.length <= 10, 'maximal 10 Einträge, keine 12');
	});

	it('Datenisolation: User A sieht keine Tasks von User B (AK7)', async () => {
		const cookieA = await register('nearby-a@example.com', 'password123');
		const cookieB = await register('nearby-b@example.com', 'password123');
		await createTask(cookieB, { title: 'B-Besitz', latitude: 52.52, longitude: 13.405 });

		const res = await nearby(cookieA);
		assert.equal(res.status, 200);
		const items = (await res.json()) as { title: string }[];
		assert.equal(items.length, 0, 'Tasks anderer Nutzer dürfen nicht durchsickern');
	});
});
