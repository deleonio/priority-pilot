import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Roter TDD-Vertrag für #246 „Unteraufgaben-Done-Guard" (AK5, Backend).
 *
 * Eine Aufgabe darf nur dann auf „Done" gesetzt werden, wenn keine ihrer **direkten** Unteraufgaben
 * offen ist. „Unteraufgabe von parent" wird über die Dependency-Kante modelliert: der Eltern-Task ist
 * Vorgänger des Kindes (`POST /tasks/{childId}/dependencies` mit `{ dependingTaskId: parentId }`).
 * Damit gilt `parent.getDependents()` = [child]; das Kind erscheint im Wald als Unteraufgabe unter
 * parent. Die Regel: `parent` kann nur „Done" werden, wenn alle `getDependents()` „Done" sind.
 *
 * Diese Specs sind rot, bis der PATCH-Handler in `routes/tasks.ts` den Guard implementiert und bei
 * einem verbotenen Done-Übergang 409 mit einer Hinweis-`message` zurückgibt.
 *
 * Der Testserver läuft ohne Auth-Konfiguration (kein SESSION_SECRET/OAuth/Allowlist) → `requireAuth`
 * ist Pass-Through, exakt wie in `api.test.ts`.
 */
let server: TestServer;

describe('PATCH /tasks/:id — Unteraufgaben-Done-Guard (#246, AK5)', () => {
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

	/**
	 * Verknüpft `childId` als Unteraufgabe von `parentId`: der Eltern-Task wird zum Vorgänger des
	 * Kindes (`POST /tasks/{childId}/dependencies` mit `dependingTaskId = parentId`). Damit gilt
	 * `parent.getDependents()` = [child].
	 */
	const addSubtask = async (parentId: number, childId: number): Promise<void> => {
		const res = await post(`/tasks/${childId}/dependencies`, { dependingTaskId: parentId });
		assert.equal(res.status, 201, 'Unteraufgabe-Verknüpfung sollte 201 liefern');
	};

	it('AK5 Happy Path: Task ohne Unteraufgaben darf auf Done gesetzt werden → 200', async () => {
		const task = await Task.create({ title: 'Solo', priority: 3, estimatedEffort: 1 });

		const res = await patch(`/tasks/${task.id}`, { status: 'Done' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(body.status, 'Done');
	});

	it('AK5 Happy Path: alle direkten Unteraufgaben Done → Parent darf Done werden → 200', async () => {
		const parent = await Task.create({ title: 'Parent', priority: 3, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1, status: 'Done' });
		await addSubtask(parent.id, child.id);

		const res = await patch(`/tasks/${parent.id}`, { status: 'Done' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(body.status, 'Done');
	});

	it('AK5 Guard: offene (Open) Unteraufgabe blockiert Done → 409 mit message', async () => {
		const parent = await Task.create({ title: 'Parent', priority: 3, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1, status: 'Open' });
		await addSubtask(parent.id, child.id);

		const res = await patch(`/tasks/${parent.id}`, { status: 'Done' });

		assert.equal(res.status, 409);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(typeof body.message, 'string');
		assert.ok((body.message as string).length > 0, 'message darf nicht leer sein');

		// Der Guard darf den Status nicht heimlich geändert haben.
		await parent.reload();
		assert.notEqual(parent.dataValues.status, 'Done');
	});

	it('AK5 Guard: „In process"-Unteraufgabe blockiert Done → 409', async () => {
		const parent = await Task.create({ title: 'Parent', priority: 3, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1, status: 'In process' });
		await addSubtask(parent.id, child.id);

		const res = await patch(`/tasks/${parent.id}`, { status: 'Done' });

		assert.equal(res.status, 409);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(typeof body.message, 'string');
	});

	it('AK5: nicht-Done-Übergänge (Open/In process) sind trotz offener Unteraufgaben erlaubt → 200', async () => {
		const parent = await Task.create({ title: 'Parent', priority: 3, estimatedEffort: 1 });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1, status: 'Open' });
		await addSubtask(parent.id, child.id);

		const toInProcess = await patch(`/tasks/${parent.id}`, { status: 'In process' });
		assert.equal(toInProcess.status, 200);
		assert.equal(((await toInProcess.json()) as Record<string, unknown>).status, 'In process');

		const toOpen = await patch(`/tasks/${parent.id}`, { status: 'Open' });
		assert.equal(toOpen.status, 200);
		assert.equal(((await toOpen.json()) as Record<string, unknown>).status, 'Open');
	});
});
