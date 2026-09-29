import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/** F-19 (#1561): `GET /scores` liefert nur die Score-Einträge der eigenen Tasks (Datenisolation). */

applyTestAuthEnv('test-secret-f19-scores-scope');

let server: TestServer;

const getScores = async (cookie: string): Promise<Array<{ taskId: number }>> => {
	const res = await server.json('/scores', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200);
	return (await res.json()) as Array<{ taskId: number }>;
};

describe('GET /scores — Datenisolation (F-19)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('liefert nur die Einträge des eingeloggten Nutzers', async () => {
		const cookieA = await server.register('scores-a@example.com', 'password123');
		const cookieB = await server.register('scores-b@example.com', 'password123');

		const createRes = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookieA },
			body: JSON.stringify({ title: 'A erledigt', priority: 3, estimatedEffort: 1 }),
		});
		assert.equal(createRes.status, 201);
		const task = (await createRes.json()) as { id: number };
		const doneRes = await server.json(`/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { Cookie: cookieA },
			body: JSON.stringify({ status: 'Done' }),
		});
		assert.equal(doneRes.status, 200);

		assert.deepEqual(
			(await getScores(cookieA)).map((entry) => entry.taskId),
			[task.id],
		);
		assert.deepEqual(await getScores(cookieB), [], 'B darf die Punkte von A nicht sehen');
	});
});
