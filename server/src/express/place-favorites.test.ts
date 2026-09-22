import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, registerOn, applyTestAuthEnv } from '../test/helpers.js';
import { placeFavoritesRouter } from './routes/placeFavorites.js';

/**
 * Vertrag der Standort-Favoriten-API (#1595, ersetzt den Namens-Vertrag aus #1342): pro Nutzer
 * isolierte Liste ohne Namensfeld, Adressen bis 255 Zeichen, Dedup gleicher Adressen. `PATCH` gibt
 * es nicht mehr (AK3) — das Umbenennen entfällt ersatzlos.
 */

applyTestAuthEnv('test-secret-place-favorites-1595');

let server: TestServer;

describe('Standort-Favoriten API (#1595)', () => {
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

	it('AK1 — POST mit einer Adresse über 60 Zeichen legt den Ort an und er steht im GET', async () => {
		const cookie = await register('long-address@example.com');
		const longAddress = 'Musterstraße 123, Erdgeschoss rechts, Hinterhaus, 10115 Berlin-Mitte, Deutschland, Europa';
		assert.ok(longAddress.length > 60, 'Testadresse muss die alte Namensgrenze überschreiten');

		const created = await createFavorite(cookie, { address: longAddress, latitude: 52.52, longitude: 13.405 });
		assert.equal(created.status, 201);

		const list = (await (await listFavorites(cookie)).json()) as { address: string }[];
		assert.equal(
			list.some((entry) => entry.address === longAddress),
			true,
			'die lange Adresse muss unverändert (nicht auf 60 Zeichen gekappt) in der Liste stehen',
		);
	});

	it('AK3 — die Antwort enthält kein name-Feld mehr', async () => {
		const cookie = await register('no-name@example.com');
		const created = await createFavorite(cookie, { address: 'Rathausplatz 1, München' });
		assert.equal(created.status, 201);
		const createdBody = (await created.json()) as Record<string, unknown>;
		assert.equal('name' in createdBody, false, 'POST-Antwort darf kein name-Feld mehr enthalten');

		const list = (await (await listFavorites(cookie)).json()) as Record<string, unknown>[];
		assert.equal(list.length, 1);
		assert.equal('name' in list[0]!, false, 'GET-Antwort darf kein name-Feld mehr enthalten');
	});

	it('AK3 — PATCH /place-favorites/:id existiert nicht mehr (404)', async () => {
		const cookie = await register('no-patch@example.com');
		const created = await createFavorite(cookie, { address: 'Weg 1' });
		const { id } = (await created.json()) as { id: number };

		const patchRes = await patchFavorite(cookie, id, { name: 'Neu' });
		assert.equal(patchRes.status, 404, 'die Umbenennen-Route ist entfernt');
	});

	it('AK4 — ein zweiter POST derselben Adresse (getrimmt, Groß-/Kleinschreibung egal) legt keinen zweiten Eintrag an', async () => {
		const cookie = await register('dedup@example.com');
		const first = await createFavorite(cookie, { address: 'Alexanderplatz 1, Berlin' });
		assert.equal(first.status, 201);

		const second = await createFavorite(cookie, { address: '  ALEXANDERPLATZ 1, berlin  ' });
		assert.equal(second.status, 201, 'ein Duplikat ist kein Fehler, sondern liefert den bestehenden Eintrag');

		const list = (await (await listFavorites(cookie)).json()) as { address: string }[];
		assert.equal(
			list.filter((entry) => entry.address.toLowerCase() === 'alexanderplatz 1, berlin').length,
			1,
			'die Adresse darf trotz zweier POSTs nur einmal in der Liste stehen',
		);
	});

	// #1595 (AK4, Review): Der Prüfpfad oben ist ein Read-then-Write — zwei gleichzeitige POSTs
	// (Doppelklick auf den Stern) sehen beide noch keinen Eintrag. Der Unique-Index
	// `place_favorites_user_id_address` lässt nur einen durch, der Verlierer liefert denselben
	// bestehenden Eintrag zurück statt eines 500ers.
	it('AK4 — zwei gleichzeitige POSTs derselben Adresse ergeben genau einen Eintrag', async () => {
		const cookie = await register('race@example.com');
		const responses = await Promise.all([
			createFavorite(cookie, { address: 'Marienplatz 8, München' }),
			createFavorite(cookie, { address: 'Marienplatz 8, München' }),
		]);

		for (const res of responses) {
			assert.equal(res.status, 201, 'beide Anfragen werden erfolgreich beantwortet');
		}
		const list = (await (await listFavorites(cookie)).json()) as { id: number; address: string }[];
		assert.equal(
			list.filter((entry) => entry.address === 'Marienplatz 8, München').length,
			1,
			'die Adresse steht trotz zweier paralleler POSTs genau einmal in der Liste',
		);
		const bodies = (await Promise.all(responses.map((res) => res.json()))) as { id: number }[];
		assert.equal(bodies[0].id, bodies[1].id, 'beide Antworten zeigen auf denselben Eintrag');
	});

	it('AK5 — GET /place-favorites ohne Session antwortet 401', async () => {
		const res = await listFavorites();
		assert.equal(res.status, 401);
	});

	it('AK5 — POST/DELETE ohne Session antworten 401', async () => {
		const postRes = await createFavorite('', { address: 'Musterstraße 1' });
		assert.equal(postRes.status, 401);
		const deleteRes = await deleteFavorite('', 1);
		assert.equal(deleteRes.status, 401);
	});

	it('AK5 — GET liefert ausschließlich die eigenen Einträge zweier Nutzer', async () => {
		const cookieA = await register('a@example.com');
		const cookieB = await register('b@example.com');

		await createFavorite(cookieA, { address: 'A-Straße 1' });
		await createFavorite(cookieB, { address: 'B-Straße 2' });

		const listA = (await (await listFavorites(cookieA)).json()) as { address: string }[];
		const listB = (await (await listFavorites(cookieB)).json()) as { address: string }[];

		assert.equal(listA.length, 1);
		assert.equal(listA[0]?.address, 'A-Straße 1');
		assert.equal(listB.length, 1);
		assert.equal(listB[0]?.address, 'B-Straße 2');
	});

	it('AK5 — DELETE auf einen fremden Favoriten antwortet 404, der Eigentümer behält ihn', async () => {
		const cookieA = await register('owner2@example.com');
		const cookieB = await register('intruder@example.com');

		const created = await createFavorite(cookieA, { address: 'Privatweg 9' });
		const { id } = (await created.json()) as { id: number };

		const deleteRes = await deleteFavorite(cookieB, id);
		assert.equal(deleteRes.status, 404);

		const listA = (await (await listFavorites(cookieA)).json()) as { id: number; address: string }[];
		assert.equal(
			listA.some((entry) => entry.id === id && entry.address === 'Privatweg 9'),
			true,
		);
	});

	it('AK6 — DELETE entfernt den Favoriten dauerhaft aus der Liste', async () => {
		const cookie = await register('deleter@example.com');
		const created = await createFavorite(cookie, { address: 'Weg 1' });
		const { id } = (await created.json()) as { id: number };

		const deleteRes = await deleteFavorite(cookie, id);
		assert.equal(deleteRes.status, 204);

		const list = (await (await listFavorites(cookie)).json()) as { id: number }[];
		assert.equal(
			list.some((entry) => entry.id === id),
			false,
			'ein gelöschter Favorit darf nicht mehr in der Liste erscheinen',
		);
	});
});
