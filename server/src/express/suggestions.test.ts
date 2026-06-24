import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #122 — Endpoint der „Was ist jetzt dran?"-Vorschlagsliste.
 *
 * Vertrag: `GET /suggestions` liefert die nach Score sortierte, post-gefilterte Liste der nächsten
 * Tasks (vgl. `findSuggestedTasks` in `logics/find.ts`). Jeder Eintrag ist ein vollständig
 * serialisierter Task (`serializeTask`). Der bestehende `GET /next` (Top-1) bleibt unberührt.
 * Die Implementierung (Route + `openapi.yml`) folgt durch die Umsetzung.
 */
describe('GET /suggestions — Vorschlagsliste (#122)', () => {
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

	it('200 mit leerer Liste, wenn keine Tasks existieren', async () => {
		const res = await get('/suggestions');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), []);
	});

	it('liefert eine nach Score sortierte Liste (höchste Priorität zuerst)', async () => {
		const niedrig = await Task.create({ title: 'Niedrig', priority: 2, estimatedEffort: 1 });
		const hoch = await Task.create({ title: 'Hoch', priority: 5, estimatedEffort: 1 });

		const res = await get('/suggestions');
		assert.equal(res.status, 200);
		const body = (await res.json()) as Array<{ id: number }>;
		assert.ok(Array.isArray(body));
		assert.equal(body.length, 2);
		assert.equal(body[0].id, hoch.id, 'höchste Priorität zuerst');
		assert.equal(body[1].id, niedrig.id);
	});

	it('Listenelemente tragen die Task-Pflichtfelder (serializeTask)', async () => {
		await Task.create({ title: 'Feldtest', priority: 3, estimatedEffort: 0.5 });
		const res = await get('/suggestions');
		const body = (await res.json()) as Array<Record<string, unknown>>;
		assert.ok(body.length >= 1);
		for (const field of ['id', 'title', 'status', 'priority', 'estimatedEffort', 'deadline', 'pillars']) {
			assert.ok(field in body[0], `Fehlendes Feld: ${field}`);
		}
	});

	it('blockierte Tasks (offene Abhängigkeit) sind nicht enthalten', async () => {
		const blocker = await Task.create({ title: 'Blocker', priority: 1, estimatedEffort: 1 });
		const blockiert = await Task.create({ title: 'Blockiert', priority: 5, estimatedEffort: 1 });
		await blockiert.addDependency(blocker);

		const res = await get('/suggestions');
		const body = (await res.json()) as Array<{ id: number }>;
		const ids = body.map((t) => t.id);
		assert.ok(!ids.includes(blockiert.id), 'blockierter Task fehlt in der Vorschlagsliste');
		assert.ok(ids.includes(blocker.id), 'freier Blocker ist enthalten');
	});
});
