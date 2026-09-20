import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * ROTE Spec-Tests (#1582) — Aufgaben anpinnen, Server-Vertrag.
 *
 * `pinned`/`pinnedAt` sind bisher keine Spalten auf `Task` (`server/src/models/task.ts`) und
 * `validateTaskFields`/`serializeTask` (`server/src/express/routes/tasks.ts`) kennen `pinned`
 * nicht — `validateTaskFields` ignoriert unbekannte Felder stillschweigend, `serializeTask` gibt
 * das Feld nicht aus. Diese Tests sind daher rot, bis die Umsetzung `pinned` (Boolean) und die
 * serverseitig abgeleitete `pinnedAt` (Zeitstempel beim Anpinnen, `null` beim Abpinnen) modellseitig,
 * in Validierung/Serialisierung und im API-Vertrag führt (docs/spec/issue-1582.md).
 */
describe('#1582 — Aufgaben anpinnen (Server)', () => {
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

	const createTask = async (): Promise<number> => {
		const res = await post('/tasks', { title: 'Steuererklärung', priority: 3, estimatedEffort: 1 });
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	it('AK1/AK3: neuer Task ist standardmäßig nicht angepinnt (pinned: false)', async () => {
		const id = await createTask();

		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { pinned?: boolean };
		assert.equal(task.pinned, false, 'unangepinnte Tasks müssen pinned: false liefern');
	});

	it('AK1: PATCH /tasks/:id mit pinned: true pinnt den Task an', async () => {
		const id = await createTask();

		const res = await patch(`/tasks/${id}`, { pinned: true });
		assert.equal(res.status, 200);
		const task = (await res.json()) as { pinned?: boolean };
		assert.equal(task.pinned, true, 'PATCH pinned: true muss den Task anpinnen');
	});

	it('AK3: Pin-Zustand bleibt nach erneutem GET erhalten (Persistenz)', async () => {
		const id = await createTask();
		await patch(`/tasks/${id}`, { pinned: true });

		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { pinned?: boolean; pinnedAt?: string | null };
		assert.equal(task.pinned, true, 'Pin-Zustand muss nach Reload/GET erhalten bleiben');
		assert.notEqual(task.pinnedAt, null, 'pinnedAt muss beim Anpinnen gesetzt werden');
	});

	it('AK5: PATCH pinned: false pinnt wieder ab und löscht pinnedAt', async () => {
		const id = await createTask();
		await patch(`/tasks/${id}`, { pinned: true });

		const res = await patch(`/tasks/${id}`, { pinned: false });
		assert.equal(res.status, 200);
		const task = (await res.json()) as { pinned?: boolean; pinnedAt?: string | null };
		assert.equal(task.pinned, false, 'Abpinnen muss pinned auf false setzen');
		assert.equal(task.pinnedAt, null, 'Abpinnen muss pinnedAt zurücksetzen');
	});
});
