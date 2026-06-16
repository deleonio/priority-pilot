import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, Dependency } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

let server: TestServer;

// We start a single server for all tests and reset the DB between each test.
// The server is started before tests run and closed at the end.
// Note: beforeEach/after are registered at module level.

// Start server once, reset DB between tests.
// Using a top-level async IIFE isn't supported in node:test, so we use a describe with lifecycle hooks.

describe('Tasks API', () => {
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

	// Helper
	const get = (path: string) => fetch(`${server.baseUrl}${path}`);
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
	const del = (path: string) => fetch(`${server.baseUrl}${path}`, { method: 'DELETE' });

	// ── GET /tasks ──────────────────────────────────────────────────────────

	describe('GET /tasks', () => {
		it('200 mit leerer Liste', async () => {
			const res = await get('/tasks');
			assert.equal(res.status, 200);
			const body = await res.json();
			assert.deepEqual(body, []);
		});

		it('200 mit erstelltem Task', async () => {
			await Task.create({ title: 'My task', priority: 3, estimatedEffort: 1 });
			const res = await get('/tasks');
			assert.equal(res.status, 200);
			const body = (await res.json()) as unknown[];
			assert.equal(body.length, 1);
		});
	});

	// ── POST /tasks ─────────────────────────────────────────────────────────

	describe('POST /tasks', () => {
		it('201 und Task-Objekt bei gültigem Body', async () => {
			const res = await post('/tasks', { title: 'New task', priority: 5, estimatedEffort: 2 });
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(typeof body.id, 'number');
			assert.equal(body.title, 'New task');
			assert.equal(body.priority, 5);
			assert.equal(body.status, 'Open');
		});

		it('serializeTask liefert alle Pflichtfelder', async () => {
			const res = await post('/tasks', { title: 'Fields', priority: 2, estimatedEffort: 0.5 });
			const body = (await res.json()) as Record<string, unknown>;
			for (const field of [
				'id',
				'title',
				'status',
				'priority',
				'estimatedEffort',
				'actualEffort',
				'description',
				'deadline',
			]) {
				assert.ok(field in body, `Fehlendes Feld: ${field}`);
			}
		});

		it('400 wenn title fehlt', async () => {
			const res = await post('/tasks', { priority: 3, estimatedEffort: 1 });
			assert.equal(res.status, 400);
		});

		it('400 wenn title leer', async () => {
			const res = await post('/tasks', { title: '   ', priority: 1, estimatedEffort: 1 });
			assert.equal(res.status, 400);
		});

		it('400 wenn priority < 1', async () => {
			const res = await post('/tasks', { title: 'T', priority: 0, estimatedEffort: 1 });
			assert.equal(res.status, 400);
		});

		it('400 wenn priority keine Ganzzahl', async () => {
			const res = await post('/tasks', { title: 'T', priority: 1.5, estimatedEffort: 1 });
			assert.equal(res.status, 400);
		});

		it('400 wenn estimatedEffort < 0.1', async () => {
			const res = await post('/tasks', { title: 'T', priority: 1, estimatedEffort: 0.05 });
			assert.equal(res.status, 400);
		});

		it('400 wenn estimatedEffort kein Number', async () => {
			// Infinity/NaN überleben JSON.stringify nicht (→ null); über die API erreichbar ist nur der Typcheck.
			const res = await post('/tasks', { title: 'T', priority: 1, estimatedEffort: 'viel' });
			assert.equal(res.status, 400);
		});

		it('400 wenn status ungültig', async () => {
			const res = await post('/tasks', { title: 'T', priority: 1, estimatedEffort: 1, status: 'Invalid' });
			assert.equal(res.status, 400);
		});

		it('400 wenn Body kein Objekt', async () => {
			const res = await fetch(`${server.baseUrl}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify('not an object'),
			});
			assert.equal(res.status, 400);
		});

		it('400 wenn deadline ungültig', async () => {
			const res = await post('/tasks', { title: 'T', priority: 1, estimatedEffort: 1, deadline: 'not-a-date' });
			assert.equal(res.status, 400);
		});

		it('201 mit gültigem ISO-Datum als deadline', async () => {
			const res = await post('/tasks', {
				title: 'Deadline task',
				priority: 1,
				estimatedEffort: 1,
				deadline: '2025-12-31T00:00:00.000Z',
			});
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.ok(typeof body.deadline === 'string');
		});
	});

	// ── GET /tasks/:id ───────────────────────────────────────────────────────

	describe('GET /tasks/:id', () => {
		it('200 mit korrektem Task', async () => {
			const task = await Task.create({ title: 'Find me', priority: 2, estimatedEffort: 1 });
			const res = await get(`/tasks/${task.id}`);
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.id, task.id);
			assert.equal(body.title, 'Find me');
		});

		it('404 wenn nicht gefunden', async () => {
			const res = await get('/tasks/99999');
			assert.equal(res.status, 404);
		});

		it('404 bei nicht-numerischer id "abc"', async () => {
			const res = await get('/tasks/abc');
			assert.equal(res.status, 404);
		});

		it('404 bei id=0', async () => {
			const res = await get('/tasks/0');
			assert.equal(res.status, 404);
		});

		it('404 bei negativer id', async () => {
			const res = await get('/tasks/-1');
			assert.equal(res.status, 404);
		});
	});

	// ── PATCH /tasks/:id ─────────────────────────────────────────────────────

	describe('PATCH /tasks/:id', () => {
		it('200 und aktualisierter Task', async () => {
			const task = await Task.create({ title: 'Original', priority: 1, estimatedEffort: 1 });
			const res = await patch(`/tasks/${task.id}`, { title: 'Updated', priority: 5 });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.title, 'Updated');
			assert.equal(body.priority, 5);
		});

		it('404 wenn nicht gefunden', async () => {
			const res = await patch('/tasks/99999', { title: 'X' });
			assert.equal(res.status, 404);
		});

		it('400 bei ungültigem status', async () => {
			const task = await Task.create({ title: 'T', priority: 1, estimatedEffort: 1 });
			const res = await patch(`/tasks/${task.id}`, { status: 'BadStatus' });
			assert.equal(res.status, 400);
		});

		it('400 wenn title leer-string', async () => {
			const task = await Task.create({ title: 'T', priority: 1, estimatedEffort: 1 });
			const res = await patch(`/tasks/${task.id}`, { title: '' });
			assert.equal(res.status, 400);
		});

		it('PATCH erlaubt partial update (title optional)', async () => {
			const task = await Task.create({ title: 'T', priority: 1, estimatedEffort: 1 });
			const res = await patch(`/tasks/${task.id}`, { priority: 9 });
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.priority, 9);
			assert.equal(body.title, 'T');
		});
	});

	// ── DELETE /tasks/:id ────────────────────────────────────────────────────

	describe('DELETE /tasks/:id', () => {
		it('204 bei erfolgreichem Löschen', async () => {
			const task = await Task.create({ title: 'Del', priority: 1, estimatedEffort: 1 });
			const res = await del(`/tasks/${task.id}`);
			assert.equal(res.status, 204);
		});

		it('404 nach Löschen', async () => {
			const task = await Task.create({ title: 'Del', priority: 1, estimatedEffort: 1 });
			await del(`/tasks/${task.id}`);
			const res = await get(`/tasks/${task.id}`);
			assert.equal(res.status, 404);
		});

		it('404 wenn nicht gefunden', async () => {
			const res = await del('/tasks/99999');
			assert.equal(res.status, 404);
		});
	});

	// ── POST /tasks/:id/dependencies ─────────────────────────────────────────

	describe('POST /tasks/:id/dependencies', () => {
		it('201 bei gültiger Kante', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			// Make a depend on b
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id });
			assert.equal(res.status, 201);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.id, a.id);
		});

		it('201 idempotent: erneutes Hinzufügen aktualisiert nur weight', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: 1 });
			const res2 = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: 2 });
			assert.equal(res2.status, 201);
			// Keine Duplikat-Kante, und das Gewicht wurde tatsächlich aktualisiert (nicht nur Status 201).
			const edges = await Dependency.findAll({ where: { dependentTaskId: a.id, dependingTaskId: b.id } });
			assert.equal(edges.length, 1);
			assert.equal(edges[0].dataValues.weight, 2);
		});

		it('400 wenn dependingTaskId fehlt', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const res = await post(`/tasks/${a.id}/dependencies`, {});
			assert.equal(res.status, 400);
		});

		it('400 wenn dependingTaskId = 0', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: 0 });
			assert.equal(res.status, 400);
		});

		it('400 wenn weight negativ', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id, weight: -1 });
			assert.equal(res.status, 400);
		});

		it('400 wenn Body kein Objekt', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const res = await fetch(`${server.baseUrl}/tasks/${a.id}/dependencies`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(null),
			});
			assert.equal(res.status, 400);
		});

		it('404 wenn dependent Task nicht existiert', async () => {
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			const res = await post('/tasks/99999/dependencies', { dependingTaskId: b.id });
			assert.equal(res.status, 404);
		});

		it('404 wenn depending Task nicht existiert', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: 99999 });
			assert.equal(res.status, 404);
		});

		it('409 wenn Zyklus entsteht', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			// Make b depend on a
			await post(`/tasks/${b.id}/dependencies`, { dependingTaskId: a.id });
			// Now make a depend on b → cycle
			const res = await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id });
			assert.equal(res.status, 409);
		});
	});

	// ── DELETE /tasks/:id/dependencies/:depId ────────────────────────────────

	describe('DELETE /tasks/:id/dependencies/:depId', () => {
		it('204 bei vorhandener Kante', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			await a.addDependency(b);
			const res = await del(`/tasks/${a.id}/dependencies/${b.id}`);
			assert.equal(res.status, 204);
		});

		it('404 wenn Kante nicht existiert', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			const res = await del(`/tasks/${a.id}/dependencies/${b.id}`);
			assert.equal(res.status, 404);
		});

		it('404 wenn Task nicht existiert', async () => {
			const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
			const res = await del(`/tasks/99999/dependencies/${b.id}`);
			assert.equal(res.status, 404);
		});

		it('404 bei ungültiger depId', async () => {
			const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
			const res = await del(`/tasks/${a.id}/dependencies/abc`);
			assert.equal(res.status, 404);
		});
	});

	// ── GET /forest ──────────────────────────────────────────────────────────

	describe('GET /forest', () => {
		it('200 mit leerer Liste', async () => {
			const res = await get('/forest');
			assert.equal(res.status, 200);
			const body = await res.json();
			assert.deepEqual(body, []);
		});

		it('200 mit Task-Baum', async () => {
			await Task.create({ title: 'Root', priority: 3, estimatedEffort: 1 });
			const res = await get('/forest');
			assert.equal(res.status, 200);
			const body = (await res.json()) as unknown[];
			assert.equal(body.length, 1);
		});

		it('Baumknoten hat erwartete Felder', async () => {
			await Task.create({ title: 'Root', priority: 3, estimatedEffort: 2 });
			const res = await get('/forest');
			const body = (await res.json()) as Record<string, unknown>[];
			const node = body[0];
			for (const field of [
				'id',
				'title',
				'priority',
				'estimatedEffort',
				'totalEstimatedEffort',
				'value',
				'dependents',
			]) {
				assert.ok(field in node, `Fehlendes Feld: ${field}`);
			}
		});
	});

	// ── GET /next ────────────────────────────────────────────────────────────

	describe('GET /next', () => {
		it('200 mit null wenn keine Tasks', async () => {
			const res = await get('/next');
			assert.equal(res.status, 200);
			const body = await res.json();
			assert.equal(body, null);
		});

		it('200 mit nächstem Task', async () => {
			await Task.create({ title: 'Important', priority: 9, estimatedEffort: 1 });
			const res = await get('/next');
			assert.equal(res.status, 200);
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.title, 'Important');
		});

		it('Antwort hat serialisiertes Task-Format', async () => {
			await Task.create({ title: 'T', priority: 1, estimatedEffort: 1 });
			const res = await get('/next');
			const body = (await res.json()) as Record<string, unknown>;
			for (const field of [
				'id',
				'title',
				'status',
				'priority',
				'estimatedEffort',
				'actualEffort',
				'description',
				'deadline',
			]) {
				assert.ok(field in body, `Fehlendes Feld: ${field}`);
			}
		});
	});
});
