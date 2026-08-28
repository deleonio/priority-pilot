import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1066 (Spec docs/spec/issue-1066.md) — Persistenz der Koordinaten.
 *
 * AK1: POST/PATCH `/tasks` akzeptieren `latitude`/`longitude` (Zahl, Bereich geprüft), speichern
 *   beide Werte und liefern sie zurück; Leeren setzt BEIDE auf null.
 * AK10: Freitext-`address` ohne Koordinate bleibt speicherbar — der Task trägt latitude/longitude
 *   === null (kein Validierungszwang durch die Geo-Felder).
 *
 * Rot, bis das Task-Modell die Spalten führt und die Validierung sie akzeptiert. KEIN Produktivcode.
 */
describe('Task-Koordinaten (#1066)', () => {
	let server: TestServer;

	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const post = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const patch = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const get = (path: string) => fetch(`${server.baseUrl}${path}`);

	it('POST /tasks mit latitude/longitude → 201 und Koordinaten zurückgegeben', async () => {
		const res = await post('/tasks', { title: 'Post abgeben', latitude: 52.5200066, longitude: 13.4049541 });
		assert.equal(res.status, 201);
		const created = (await res.json()) as { latitude: number | null; longitude: number | null };
		assert.equal(created.latitude, 52.5200066);
		assert.equal(created.longitude, 13.4049541);
	});

	it('GET /tasks/:id liefert die gespeicherten Koordinaten', async () => {
		const created = await post('/tasks', { title: 'Einkaufen', latitude: 52.52, longitude: 13.405 });
		const { id } = (await created.json()) as { id: number };
		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { latitude: number | null; longitude: number | null };
		assert.equal(task.latitude, 52.52);
		assert.equal(task.longitude, 13.405);
	});

	it('PATCH latitude: null/longitude: null setzt BEIDE Werte zurück (AK1)', async () => {
		const created = await post('/tasks', { title: 'Mit Standort', latitude: 48.137, longitude: 11.575 });
		const { id } = (await created.json()) as { id: number };
		const res = await patch(`/tasks/${id}`, { latitude: null, longitude: null });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { latitude: number | null; longitude: number | null };
		assert.equal(updated.latitude, null, 'Latitude muss geleert werden');
		assert.equal(updated.longitude, null, 'Longitude muss geleert werden');
	});

	it('PATCH nur { latitude: null } setzt BEIDE auf null (paarweise Normalisierung, F1)', async () => {
		const created = await post('/tasks', { title: 'Mit Standort', latitude: 48.137, longitude: 11.575 });
		const { id } = (await created.json()) as { id: number };
		const res = await patch(`/tasks/${id}`, { latitude: null });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { latitude: number | null; longitude: number | null };
		assert.equal(updated.latitude, null, 'Latitude muss geleert werden');
		assert.equal(updated.longitude, null, 'Longitude muss auch geleert werden (paarweise)');
	});

	it('latitude außerhalb [-90, 90] → 400', async () => {
		const res = await post('/tasks', { title: 'Unmöglicher Ort', latitude: 91, longitude: 0 });
		assert.equal(res.status, 400);
	});

	it('Freitext-Adresse ohne Koordinate bleibt speicherbar (AK10)', async () => {
		const res = await post('/tasks', { title: 'Nur Freitext', address: 'Irgendwo 1, 12345 Nirgendwo' });
		assert.equal(res.status, 201, 'Freitext-Adresse darf nicht an fehlenden Koordinaten scheitern');
		const created = (await res.json()) as { latitude: number | null; longitude: number | null };
		assert.equal(created.latitude, null);
		assert.equal(created.longitude, null);
	});
});
