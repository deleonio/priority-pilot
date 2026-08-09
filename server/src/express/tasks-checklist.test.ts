import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * ROTE Spec-Tests (#531) — Checklisten-Feld in Tasks.
 *
 * Ein Task bekommt ein optionales `checklist`-Array (Default `[]`) mit Einträgen der Form
 * `{ id: UUID, title: 1–255 Zeichen, completed: boolean (Default false) }`. GET/POST/PATCH `/tasks`
 * unterstützen das Feld; `serializeTask` gibt es mit. Validierung: Titel nicht leer, `id` gültige
 * UUID, max. 20 Items. Bestehende Tasks bleiben unberührt (Backward-Kompatibilität).
 *
 * Weder das Modell (`server/src/models/task.ts`) noch `validateTaskFields`/`serializeTask`
 * (`server/src/express/routes/tasks.ts`) noch die OpenAPI kennen `checklist` bisher — `validateTaskFields`
 * ignoriert unbekannte Felder stillschweigend, `serializeTask` gibt das Feld nicht aus. Diese Tests sind
 * daher rot, bis die Umsetzung das Feld modellseitig, in Validierung/Serialisierung und im API-Vertrag
 * führt. Bewusst rein über HTTP formuliert (Black-Box-Vertrag, implementierungsunabhängig).
 */
describe('#531 — Checklisten-Feld in Tasks', () => {
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

	const UUID = '550e8400-e29b-41d4-a716-446655440000';
	const UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

	it('AC3/T1: POST /tasks mit checklist → 201, Liste gespeichert und zurückgegeben', async () => {
		const checklist = [
			{ id: UUID, title: 'Erster Schritt', completed: false },
			{ id: UUID_2, title: 'Zweiter Schritt', completed: true },
		];
		const res = await post('/tasks', { title: 'Mit Checkliste', checklist });
		assert.equal(res.status, 201);
		const created = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(created.checklist, checklist);
	});

	it('AC1/T2: POST /tasks ohne checklist → Default [] (rückwärtskompatibel)', async () => {
		const id = await createTask({ title: 'Ohne Checkliste' });
		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(task.checklist, []);
	});

	it('AC2: Checklist-Item ohne completed → Default false', async () => {
		const res = await post('/tasks', {
			title: 'Default-completed',
			checklist: [{ id: UUID, title: 'Nur id+title' }],
		});
		assert.equal(res.status, 201);
		const created = (await res.json()) as { checklist: { completed: boolean }[] };
		assert.equal(created.checklist.length, 1);
		assert.equal(created.checklist[0].completed, false);
	});

	it('AC3/T3: PATCH /tasks/:id aktualisiert die Checklisten-Items', async () => {
		const id = await createTask({ title: 'Patch-Mich' });
		const neueItems = [{ id: UUID, title: 'Geändert', completed: true }];
		const res = await patch(`/tasks/${id}`, { checklist: neueItems });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(updated.checklist, neueItems);
	});

	it('AC4/T4: Checklist-Item mit leerem Titel → 400', async () => {
		const res = await post('/tasks', {
			title: 'Ungültiges Item',
			checklist: [{ id: UUID, title: '   ', completed: false }],
		});
		assert.equal(res.status, 400);
	});

	it('AC4/T5: Checklist-Item mit ungültiger id (keine UUID) → 400', async () => {
		const res = await post('/tasks', {
			title: 'Ungültige id',
			checklist: [{ id: 'keine-uuid', title: 'Gültiger Titel', completed: false }],
		});
		assert.equal(res.status, 400);
	});

	it('AC4/T6: mehr als 20 Checklist-Items → 400', async () => {
		const zuViele = Array.from({ length: 21 }, (_, i) => ({
			id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
			title: `Item ${i}`,
			completed: false,
		}));
		const res = await post('/tasks', { title: 'Zu viele Items', checklist: zuViele });
		assert.equal(res.status, 400);
	});

	it('AC5/T7: bestehender Task liefert checklist: [] (Backward-Kompatibilität)', async () => {
		const id = await createTask({ title: 'Alt-Task' });
		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(task.checklist, []);
	});

	it('AC3: GET /tasks (Liste) liefert je Task ein checklist-Feld', async () => {
		await createTask({ title: 'Listen-Task' });
		const res = await get('/tasks');
		assert.equal(res.status, 200);
		const tasks = (await res.json()) as { checklist: unknown[] }[];
		assert.ok(tasks.length > 0);
		for (const task of tasks) {
			assert.ok(Array.isArray(task.checklist), 'jeder Task braucht ein checklist-Array');
		}
	});
});
