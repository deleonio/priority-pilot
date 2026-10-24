import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { Task } from '../models/index.js';
import { closeDb, resetDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #2940 (TF6): lesender Abhängigkeits-Endpunkt für die Aufgabenansicht.
 * Spec: docs/spec/issue-2940.md — `GET /tasks/:id/dependencies` liefert beide Kanten-Richtungen
 * (`subtasks` = getDependencies(), `dependents` = getDependents()) mit id/title/status,
 * Done-Kinder inklusive, archivierte ausgeschlossen; fremde ID → 404 mit message.
 * Rot, bis die Route existiert (erstes Rot: 404 statt 200 → Assertion).
 */

describe('GET /tasks/:id/dependencies (#2940)', () => {
	let server: TestServer;

	const json = (cookie: string, method: string, path: string, body?: unknown): Promise<Response> =>
		server.json(path, {
			method,
			headers: { cookie },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});

	const createTask = async (cookie: string, title: string): Promise<number> => {
		const res = await json(cookie, 'POST', '/tasks', { title, priority: 3 });
		assert.equal(res.status, 201, `Setup: Task-Anlage für „${title}“ muss 201 liefern`);
		return ((await res.json()) as { id: number }).id;
	};

	beforeEach(async () => {
		await resetDb();
		if (!server) server = await startTestServer();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	// TF6/AK1+AK2: Beide Richtungen einer Kante am selben Task — Kinder (Unteraufgaben) und
	// Wartende („Blockiert“) mit id/title/status.
	it('liefert beide Richtungen mit id/title/status', async () => {
		const cookie = await server.register('dep-read-a@example.com');
		const parent = await createTask(cookie, 'Eltern-Aufgabe');
		const child = await createTask(cookie, 'Unteraufgabe');
		const waiter = await createTask(cookie, 'Wartende Aufgabe');
		assert.equal((await json(cookie, 'POST', `/tasks/${parent}/dependencies`, { dependingTaskId: child })).status, 201);
		assert.equal(
			(await json(cookie, 'POST', `/tasks/${waiter}/dependencies`, { dependingTaskId: parent })).status,
			201,
		);

		const res = await json(cookie, 'GET', `/tasks/${parent}/dependencies`);
		assert.equal(res.status, 200);
		const body = (await res.json()) as {
			subtasks: { id: number; title: string; status: string }[];
			dependents: { id: number; title: string; status: string }[];
		};
		assert.deepEqual(body.subtasks, [{ id: child, title: 'Unteraufgabe', status: 'Open' }]);
		assert.deepEqual(body.dependents, [{ id: waiter, title: 'Wartende Aufgabe', status: 'Open' }]);
	});

	// TF6/AK1: Zähler-Grundlage — erledigte Kinder bleiben geliefert, archivierte fallen raus.
	it('liefert Done-Kinder weiter und lässt archivierte weg', async () => {
		const cookie = await server.register('dep-read-b@example.com');
		const parent = await createTask(cookie, 'Eltern');
		const doneChild = await createTask(cookie, 'Fertiges Kind');
		const archivedChild = await createTask(cookie, 'Archiviertes Kind');
		await json(cookie, 'POST', `/tasks/${parent}/dependencies`, { dependingTaskId: doneChild });
		await json(cookie, 'POST', `/tasks/${parent}/dependencies`, { dependingTaskId: archivedChild });
		assert.equal((await json(cookie, 'PATCH', `/tasks/${doneChild}`, { status: 'Done' })).status, 200);
		// Archivierung direkt übers Modell — es geht um die Leselogik, nicht um den Archiv-Vertrag.
		await Task.update({ archivedAt: new Date() }, { where: { id: archivedChild } });

		const res = await json(cookie, 'GET', `/tasks/${parent}/dependencies`);
		assert.equal(res.status, 200);
		const body = (await res.json()) as {
			subtasks: { id: number; status: string }[];
			dependents: unknown[];
		};
		assert.deepEqual(
			body.subtasks.map((entry) => entry.id),
			[doneChild],
		);
		assert.equal(body.subtasks[0]?.status, 'Done');
		assert.deepEqual(body.dependents, []);
	});

	// TF6/Datenisolation: fremde Task-ID → 404 mit Error-Body-Vertrag (Muster error-contract).
	it('antwortet auf eine fremde Task-ID mit 404 und message', async () => {
		const owner = await server.register('dep-read-c@example.com');
		const foreignTask = await createTask(await server.register('dep-read-d@example.com'), 'Fremd');

		const res = await json(owner, 'GET', `/tasks/${foreignTask}/dependencies`);
		assert.equal(res.status, 404);
		const body = (await res.json()) as { message?: unknown };
		assert.equal(typeof body.message, 'string');
		assert.ok((body.message as string).length > 0);
	});
});
