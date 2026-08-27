import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Adresssuche für Aufgaben: optionales `address`-Feld an Tasks (Ortsbezug, über die
 * Adresssuche/Forward-Geocoding im Task-Formular ausgewählt). GET/POST/PATCH `/tasks` unterstützen
 * das Feld; `serializeTask` gibt es mit. Validierung: String (max. 255 Zeichen) oder `null`; leerer
 * String wird wie `null` behandelt. Bestehende Tasks ohne Adresse liefern `null`.
 */
describe('Adressfeld an Tasks', () => {
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

	const createTask = async (body: Record<string, unknown>): Promise<number> => {
		const res = await post('/tasks', body);
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	it('POST /tasks mit address → 201, Adresse gespeichert und zurückgegeben', async () => {
		const res = await post('/tasks', { title: 'Mit Adresse', address: 'Musterstraße 1, 12345 Musterstadt' });
		assert.equal(res.status, 201);
		const created = (await res.json()) as { address: string | null };
		assert.equal(created.address, 'Musterstraße 1, 12345 Musterstadt');
	});

	it('POST /tasks ohne address → null (kein Ortsbezug)', async () => {
		const id = await createTask({ title: 'Ohne Adresse' });
		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { address: string | null };
		assert.equal(task.address, null);
	});

	it('PATCH /tasks/:id aktualisiert die Adresse', async () => {
		const id = await createTask({ title: 'Patch-Mich' });
		const res = await patch(`/tasks/${id}`, { address: 'Neue Adresse 2, 54321 Anderestadt' });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { address: string | null };
		assert.equal(updated.address, 'Neue Adresse 2, 54321 Anderestadt');
	});

	it('PATCH /tasks/:id mit address: null entfernt einen bestehenden Ortsbezug', async () => {
		const id = await createTask({ title: 'Mit Adresse', address: 'Alte Adresse' });
		const res = await patch(`/tasks/${id}`, { address: null });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { address: string | null };
		assert.equal(updated.address, null);
	});

	it('address über 255 Zeichen → 400', async () => {
		const res = await post('/tasks', { title: 'Zu lange Adresse', address: 'x'.repeat(256) });
		assert.equal(res.status, 400);
	});

	it('address als Zahl → 400', async () => {
		const res = await post('/tasks', { title: 'Ungültige Adresse', address: 123 });
		assert.equal(res.status, 400);
	});
});
