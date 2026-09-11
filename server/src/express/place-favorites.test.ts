import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, registerOn, applyTestAuthEnv } from '../test/helpers.js';
// Neues Modul (#1342) — importiert für die Modul-Auflösung; solange die Datei nicht existiert,
// ist DAS der erwartete rote Zustand (neue Funktionalität, kein bestehender Code).
import { placeFavoritesRouter } from './routes/placeFavorites.js';

/**
 * Vertrag der Standort-Favoriten-API (#1342, AK4/AK5): pro Nutzer isolierte CRUD-Liste,
 * analog zu `apiTokens.ts` (#1352) — 401 ohne Session, 404 statt 403 bei fremden Zeilen,
 * Koordinaten optional (Freitext-Favorit ohne lat/lon).
 */

applyTestAuthEnv('test-secret-place-favorites');

let server: TestServer;

describe('Standort-Favoriten API (#1342)', () => {
	before(async () => {
		server = await startTestServer();
		assert.ok(placeFavoritesRouter, 'placeFavoritesRouter muss exportiert sein');
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const register = (email: string) => registerOn(server, email, 'password');

	const listFavorites = (cookie?: string) =>
		fetch(`${server.baseUrl}/place-favorites`, { headers: cookie ? { Cookie: cookie } : {} });

	const createFavorite = (cookie: string, body: unknown) =>
		fetch(`${server.baseUrl}/place-favorites`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const patchFavorite = (cookie: string, id: number, body: unknown) =>
		fetch(`${server.baseUrl}/place-favorites/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const deleteFavorite = (cookie: string, id: number) =>
		fetch(`${server.baseUrl}/place-favorites/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });

	it('AK5 — GET /place-favorites ohne Session antwortet 401', async () => {
		const res = await listFavorites();
		assert.equal(res.status, 401);
	});

	it('AK5 — POST/PATCH/DELETE ohne Session antworten 401', async () => {
		const postRes = await createFavorite('', { name: 'Zuhause', address: 'Musterstraße 1' });
		assert.equal(postRes.status, 401);
		const patchRes = await patchFavorite('', 1, { name: 'Neu' });
		assert.equal(patchRes.status, 401);
		const deleteRes = await deleteFavorite('', 1);
		assert.equal(deleteRes.status, 401);
	});

	it('AK2/AK4 — POST legt einen Favoriten an; Koordinaten sind optional (Freitext ohne lat/lon)', async () => {
		const cookie = await register('owner@example.com');

		const withCoords = await createFavorite(cookie, {
			name: 'Büro',
			address: 'Rathausplatz 1, München',
			latitude: 48.1374,
			longitude: 11.5755,
		});
		assert.equal(withCoords.status, 201);
		const withCoordsBody = (await withCoords.json()) as {
			id: number;
			latitude: number | null;
			longitude: number | null;
		};
		assert.equal(withCoordsBody.latitude, 48.1374);
		assert.equal(withCoordsBody.longitude, 11.5755);

		const freetext = await createFavorite(cookie, { name: 'Oma', address: 'Irgendwo 3' });
		assert.equal(freetext.status, 201);
		const freetextBody = (await freetext.json()) as { latitude: number | null; longitude: number | null };
		assert.equal(freetextBody.latitude, null, 'ohne Koordinate bleibt latitude null, keine alte Koordinate');
		assert.equal(freetextBody.longitude, null);
	});

	it('AK5 — GET liefert ausschließlich die eigenen Einträge zweier Nutzer', async () => {
		const cookieA = await register('a@example.com');
		const cookieB = await register('b@example.com');

		await createFavorite(cookieA, { name: 'A-Ort', address: 'A-Straße 1' });
		await createFavorite(cookieB, { name: 'B-Ort', address: 'B-Straße 2' });

		const listA = (await (await listFavorites(cookieA)).json()) as { name: string }[];
		const listB = (await (await listFavorites(cookieB)).json()) as { name: string }[];

		assert.equal(listA.length, 1);
		assert.equal(listA[0]?.name, 'A-Ort');
		assert.equal(listB.length, 1);
		assert.equal(listB[0]?.name, 'B-Ort');
	});

	it('AK5 — PATCH und DELETE auf einen fremden Favoriten antworten 404', async () => {
		const cookieA = await register('owner2@example.com');
		const cookieB = await register('intruder@example.com');

		const created = await createFavorite(cookieA, { name: 'Geheim', address: 'Privatweg 9' });
		const { id } = (await created.json()) as { id: number };

		const patchRes = await patchFavorite(cookieB, id, { name: 'Übernommen' });
		assert.equal(patchRes.status, 404);

		const deleteRes = await deleteFavorite(cookieB, id);
		assert.equal(deleteRes.status, 404);

		// Der Eigentümer sieht seinen Favoriten unverändert weiter.
		const listA = (await (await listFavorites(cookieA)).json()) as { id: number; name: string }[];
		assert.equal(
			listA.some((entry) => entry.id === id && entry.name === 'Geheim'),
			true,
		);
	});

	it('AK3/AK5 — PATCH benennt einen eigenen Favoriten um, DELETE entfernt ihn dauerhaft aus der Liste', async () => {
		const cookie = await register('renamer@example.com');
		const created = await createFavorite(cookie, { name: 'Alt', address: 'Weg 1' });
		const { id } = (await created.json()) as { id: number };

		const patchRes = await patchFavorite(cookie, id, { name: 'Neu' });
		assert.equal(patchRes.status, 200);
		const patched = (await patchRes.json()) as { name: string };
		assert.equal(patched.name, 'Neu');

		const deleteRes = await deleteFavorite(cookie, id);
		assert.equal(deleteRes.status, 204);

		const list = (await (await listFavorites(cookie)).json()) as { id: number }[];
		assert.equal(
			list.some((entry) => entry.id === id),
			false,
			'ein gelöschter Favorit darf nicht mehr in der Liste erscheinen',
		);
	});

	it('AK5 — nach Anmeldung in einer anderen Sitzung sind dieselben Favoriten da (kein Session-Storage)', async () => {
		const firstSession = await register('cross-session@example.com');
		await createFavorite(firstSession, { name: 'Stammort', address: 'Dauerstraße 5' });

		// Zweite, unabhängige Sitzung desselben Kontos über Test-Login statt Registrierung.
		const secondRes = await fetch(`${server.baseUrl}/auth/test-login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'cross-session@example.com' }),
		});
		assert.equal(secondRes.status, 200);
		const secondCookie = secondRes.headers.get('set-cookie');
		assert.ok(secondCookie, 'zweite Sitzung braucht einen eigenen Set-Cookie-Header');

		const list = (await (await listFavorites(secondCookie ?? undefined)).json()) as { name: string }[];
		assert.equal(
			list.some((entry) => entry.name === 'Stammort'),
			true,
		);
	});
});
