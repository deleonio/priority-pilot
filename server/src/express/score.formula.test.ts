import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Implementierungs-Regressionstest (#121) — **kein** Spec-Test (die Spec-Tests in
 * `express/score.test.ts` sind als Vertrag eingefroren, Gewaltenteilung). Er schließt die im
 * Review benannte Lücke: Die Owner-Formel `punkte = estimatedEffort × priority` bei pünktlicher
 * Erledigung ist sonst nur über `> 0`/Anteile abgesichert und könnte zu einer Konstante o. Ä.
 * regressieren, ohne dass ein Test rot wird. Hier wird der **konkrete Wert** festgenagelt.
 */
describe('Scoring-Formel (estimatedEffort × priority)', () => {
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

	const future = new Date('2026-12-31T00:00:00.000Z').toISOString();

	const createTask = async (body: Record<string, unknown>): Promise<number> => {
		const res = await post('/tasks', body);
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	const punkteNachDone = async (effort: number, priority: number): Promise<number> => {
		const id = await createTask({ title: 'Formel', priority, estimatedEffort: effort, deadline: future });
		const res = await patch(`/tasks/${id}`, { status: 'Done' });
		assert.equal(res.status, 200);
		const scores = (await (await get('/scores')).json()) as Array<{ punkte: number }>;
		assert.equal(scores.length, 1);
		return scores[0].punkte;
	};

	it('pünktlich: estimatedEffort=1, priority=3 ⇒ punkte = 3', async () => {
		assert.equal(await punkteNachDone(1, 3), 3);
	});

	it('pünktlich: Owner-Beispiel estimatedEffort=0,1, priority=2 ⇒ punkte = 0,2', async () => {
		const punkte = await punkteNachDone(0.1, 2);
		assert.ok(Math.abs(punkte - 0.2) < 1e-9, `erwartet 0,2 — war ${punkte}`);
	});
});
