import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * TDD-Vertrag für #246 „Unteraufgaben-Done-Guard" (AK5, Backend), Kanten-Richtung korrigiert in #336.
 *
 * Eine Aufgabe darf nur dann auf „Done" gesetzt werden, wenn keine ihrer **direkten** Unteraufgaben
 * offen ist. „Unteraufgabe von parent" wird — exakt wie der reale „Unteraufgabe anlegen"-Flow in
 * `TaskForm.tsx` — als **Vorgänger** der Eltern-Aufgabe modelliert
 * (`POST /tasks/{parentId}/dependencies` mit `{ dependingTaskId: childId }`). Damit gilt
 * `parent.getDependencies()` = [child]; das Kind erscheint im Wald als Unteraufgabe unter parent. Die
 * Regel: `parent` kann nur „Done" werden, wenn alle seine `getDependencies()` „Done" sind. (Vor #336
 * verknüpfte die Fixture invers zu `TaskForm.tsx`, sodass der Guard für real angelegte Unteraufgaben
 * nie griff — siehe #336.)
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
	 * Verknüpft `childId` als Unteraufgabe von `parentId` — exakt wie `TaskForm.tsx`: das Kind wird
	 * zum **Vorgänger** der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit
	 * `dependingTaskId = childId`). Damit gilt `parent.getDependencies()` = [child] (#336).
	 */
	const addSubtask = async (parentId: number, childId: number): Promise<void> => {
		const res = await post(`/tasks/${parentId}/dependencies`, { dependingTaskId: childId });
		assert.equal(res.status, 201, 'Unteraufgabe-Verknüpfung sollte 201 liefern');
	};

	it('AK5 Happy Path: Task ohne Unteraufgaben darf auf Done gesetzt werden → 200', async () => {
		const task = await Task.create({ title: 'Solo', priority: 3, estimatedEffort: 1 });

		const res = await patch(`/tasks/${task.id}`, { status: 'Done' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(body.status, 'Done');
	});

	it('AK1 (#336): Blatt-Unteraufgabe ist immer erledigbar, auch bei offener Eltern-Aufgabe → 200', async () => {
		// Realer TaskForm-Flow: child ist Unteraufgabe (Vorgänger) von parent; parent bleibt offen.
		const parent = await Task.create({ title: 'Parent', priority: 3, estimatedEffort: 1, status: 'Open' });
		const child = await Task.create({ title: 'Child', priority: 3, estimatedEffort: 1, status: 'Open' });
		await addSubtask(parent.id, child.id);

		// Das Blatt (child) hat selbst keine Unteraufgaben → Done gelingt, unabhängig vom offenen parent.
		const res = await patch(`/tasks/${child.id}`, { status: 'Done' });

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
