import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1066 (Spec docs/spec/issue-1066.md) — Endpoint `GET /tasks/nearby`.
 *
 * AK2: maximal 10 Tasks mit Koordinaten und offenem Status (Open/In process), aufsteigend nach
 *   Distanz zur übergebenen Position; Tasks ohne Koordinaten und erledigte erscheinen nie.
 * AK3: `distanceKm` in km mit einer Nachkommastelle (Haversine).
 * AK7: auth-geschützt (401 ohne Session) und owner-scoped — User A sieht keine Tasks von User B.
 * #1098 AK6: die Liste enthält nur Tasks innerhalb der **gespeicherten Anzeige-Entfernung** des
 *   Users (PUT /geo-config, Default 5 km) — Server-Filter, nicht clientseitig.
 *
 * Test-Pflege #1098: Die #1066-Distanz-Tests nutzten Referenzorte bis 255 km (Leipzig/Hamburg).
 * Mit dem neuen Server-Filter (Default 5 km) wären sie leer — sie nutzen jetzt eine Config mit
 * `displayDistanceKm = 50` bzw. Punkte im Kilometer-Abstand (dokumentiert im PR-Body unter
 * „Test-Pflege-Bedarf"). Rot, bis der Filter existiert. KEIN Produktivcode.
 */

// Auth-Kontext wie in api-auth-protection.test.ts (#207): damit ist requireAuth aktiv und der
// Register-Endpunkt liefert einen Session-Cookie.
applyTestAuthEnv('test-secret-issue-1066');

/** Referenzposition: Berlin (Alexanderplatz). */
const LAT = 52.5219;
const LON = 13.4132;

let server: TestServer;

/** Unabhängiger Haversine-Orakel (km) — absichtlich NICHT aus der Route importiert (AK3 #1110). */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
	const R = 6371;
	const toRad = (deg: number): number => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
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

	/** Speichert die Anzeige-Entfernung des Users (#1098 AK7). */
	const setDisplayDistance = async (cookie: string, displayDistanceKm: number): Promise<void> => {
		const res = await fetch(`${server.baseUrl}/geo-config`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ displayDistanceKm, alarmDistanceKm: 1, intervalMinutes: 5 }),
		});
		assert.ok(res.ok, `PUT /geo-config muss gelingen (ist ${res.status})`);
	};

	it('ohne Session → 401 (AK7)', async () => {
		const res = await fetch(`${server.baseUrl}/tasks/nearby?lat=${LAT}&lon=${LON}`);
		assert.equal(res.status, 401);
	});

	it('liefert Tasks aufsteigend nach Distanz mit distanceKm in km (AK2, AK3)', async () => {
		const cookie = await server.register('nearby-sort@example.com', 'password123');
		// 1° Breite ≈ 111 km → 0.009° / 0.027° / 0.045° ≈ 1 / 3 / 5 km nördlich der Referenz.
		await createTask(cookie, { title: '5km', latitude: LAT + 0.045, longitude: LON });
		await createTask(cookie, { title: '3km', latitude: LAT + 0.027, longitude: LON });
		await createTask(cookie, { title: '1km', latitude: LAT + 0.009, longitude: LON });
		await setDisplayDistance(cookie, 50);

		const res = await nearby(cookie);
		assert.equal(res.status, 200);
		const items = (await res.json()) as { id: number; title: string; distanceKm: number }[];
		assert.deepEqual(
			items.map((i) => i.title),
			['1km', '3km', '5km'],
			'aufsteigend nach Distanz sortiert',
		);
		const [first] = items;
		assert.equal(
			Math.round(first.distanceKm * 10) / 10,
			first.distanceKm,
			' distanceKm ist auf eine Nachkommastelle gerundet',
		);
		assert.ok(first.distanceKm > 0.5 && first.distanceKm < 1.5, 'Distanz ~1 km');
	});

	it('erledigte Tasks und Tasks ohne Koordinaten erscheinen nicht (AK2)', async () => {
		const cookie = await server.register('nearby-filter@example.com', 'password123');
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
		const cookie = await server.register('nearby-cap@example.com', 'password123');
		for (let i = 0; i < 12; i += 1) {
			await createTask(cookie, { title: `Task ${i}`, latitude: 52.5 + i / 100, longitude: 13.4 });
		}
		await setDisplayDistance(cookie, 50);

		const res = await nearby(cookie);
		assert.equal(res.status, 200);
		const items = (await res.json()) as unknown[];
		assert.ok(items.length <= 10, 'maximal 10 Einträge, keine 12');
	});

	// #1098 AK6: Der Server filtert auf die gespeicherte Anzeige-Entfernung des Users.
	it('liefert nur Tasks innerhalb der gespeicherten Anzeige-Entfernung (AK6 #1098)', async () => {
		const cookie = await server.register('nearby-radius@example.com', 'password123');
		// ~3 km und ~26 km von der Referenzposition entfernt.
		await createTask(cookie, { title: 'Nah', latitude: LAT + 0.027, longitude: LON });
		await createTask(cookie, { title: 'Fern (Potsdam)', latitude: 52.3906, longitude: 13.0645 });

		// Default 5 km: nur der nahe Task.
		const resDefault = await nearby(cookie);
		assert.equal(resDefault.status, 200);
		const defaultItems = (await resDefault.json()) as { title: string; distanceKm: number }[];
		assert.deepEqual(
			defaultItems.map((i) => i.title),
			['Nah'],
			'Default-Anzeige-Entfernung 5 km: Potsdam (~26 km) ist rausgefiltert',
		);
		assert.ok(defaultItems[0].distanceKm < 5, 'gelieferter Task liegt unter 5 km');

		// Nach Erhöhung auf 50 km erscheint der ferne Task — der Filter folgt der gespeicherten Config.
		await setDisplayDistance(cookie, 50);
		const resWide = await nearby(cookie);
		assert.deepEqual(
			((await resWide.json()) as { title: string }[]).map((i) => i.title),
			['Nah', 'Fern (Potsdam)'],
			'Anzeige-Entfernung 50 km: beide Tasks sichtbar',
		);
	});

	// #1110 AK3: distanceKm muss der Haversine-Distanz zur Anfrage-Position entsprechen — auch im
	// Grenzfall „Task liegt exakt an der Position" (dort exakt 0, niemals ein Rundungs-Artefakt),
	// damit ein flächendeckendes „(0 km)" in der UI als Kettenbruch auffällt und nicht als
	// „wird so gerechnet" durchgeht.
	it('liefert exakt 0 für einen Task an der Position und die Haversine-Distanz sonst (AK3 #1110)', async () => {
		const cookie = await server.register('nearby-haversine@example.com', 'password123');
		// ~2,4 km nördlich der Referenzposition (1° Breite ≈ 111,32 km).
		await createTask(cookie, { title: '2,4km', latitude: LAT + 0.0216, longitude: LON });
		await createTask(cookie, { title: 'Exakt dort', latitude: LAT, longitude: LON });

		const res = await nearby(cookie);
		assert.equal(res.status, 200);
		const items = (await res.json()) as { title: string; distanceKm: number }[];
		const byTitle = Object.fromEntries(items.map((i) => [i.title, i.distanceKm]));

		const expected = haversineKm(LAT, LON, LAT + 0.0216, LON);
		assert.ok(
			Math.abs(byTitle['2,4km'] - expected) < 0.05,
			`distanceKm (${byTitle['2,4km']}) muss der Haversine-Distanz (${expected.toFixed(2)} km) entsprechen`,
		);
		assert.equal(
			Math.round(byTitle['2,4km'] * 10) / 10,
			byTitle['2,4km'],
			'distanceKm ist auf eine Nachkommastelle gerundet',
		);
		assert.equal(byTitle['Exakt dort'], 0, 'Task exakt an der Position → distanceKm exakt 0');
	});

	it('Datenisolation: User A sieht keine Tasks von User B (AK7)', async () => {
		const cookieA = await server.register('nearby-a@example.com', 'password123');
		const cookieB = await server.register('nearby-b@example.com', 'password123');
		await createTask(cookieB, { title: 'B-Besitz', latitude: 52.52, longitude: 13.405 });

		const res = await nearby(cookieA);
		assert.equal(res.status, 200);
		const items = (await res.json()) as { title: string }[];
		assert.equal(items.length, 0, 'Tasks anderer Nutzer dürfen nicht durchsickern');
	});
});
