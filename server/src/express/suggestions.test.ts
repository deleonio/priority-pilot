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

	it('#2043 AK1: GET /next liefert dieselbe Aufgabe wie Rang 1 von GET /suggestions', async () => {
		await Task.create({ title: 'Teuer', priority: 3, estimatedEffort: 1 });
		const billig = await Task.create({ title: 'Billig', priority: 3, estimatedEffort: 0.1 });

		const suggestions = (await (await get('/suggestions')).json()) as Array<{ id: number }>;
		const next = (await (await get('/next')).json()) as { id: number };
		assert.equal(suggestions[0].id, billig.id);
		assert.equal(next.id, suggestions[0].id);
	});

	type Breakdown = {
		total: number;
		priority?: number;
		unlock?: number;
		balance?: number;
		deadline?: number;
		effort?: number;
	};
	const FAKTOREN = ['priority', 'unlock', 'balance', 'deadline', 'effort'] as const;
	const summe = (b: Breakdown) => FAKTOREN.reduce((acc, key) => acc + (b[key] ?? 0), 0);

	it('#2044 AK1/AK3: GET /next trägt scoreBreakdown, Summe der Beiträge = total', async () => {
		await Task.create({ title: 'Eins', priority: 4, estimatedEffort: 0.5, deadline: new Date() });
		const next = (await (await get('/next')).json()) as { scoreBreakdown: Breakdown };
		assert.ok(next.scoreBreakdown, 'scoreBreakdown fehlt');
		assert.ok(Math.abs(summe(next.scoreBreakdown) - next.scoreBreakdown.total) < 1e-9);
	});

	it('#2044 AK2/AK3: jeder /suggestions-Eintrag trägt scoreBreakdown, absteigend nach total; /next = Rang 1', async () => {
		await Task.create({ title: 'A', priority: 2, estimatedEffort: 1 });
		await Task.create({ title: 'B', priority: 5, estimatedEffort: 0.2, deadline: new Date() });
		await Task.create({ title: 'C', priority: 3, estimatedEffort: 0.5 });

		const list = (await (await get('/suggestions')).json()) as Array<{ id: number; scoreBreakdown: Breakdown }>;
		assert.equal(list.length, 3);
		for (const [i, eintrag] of list.entries()) {
			assert.ok(eintrag.scoreBreakdown, 'scoreBreakdown fehlt');
			assert.ok(Math.abs(summe(eintrag.scoreBreakdown) - eintrag.scoreBreakdown.total) < 1e-9);
			if (i > 0) {
				assert.ok(list[i - 1].scoreBreakdown.total >= eintrag.scoreBreakdown.total, 'nicht absteigend');
			}
		}
		const next = (await (await get('/next')).json()) as { id: number; scoreBreakdown: Breakdown };
		assert.equal(next.id, list[0].id);
		assert.equal(next.scoreBreakdown.total, list[0].scoreBreakdown.total);
	});

	it('#2044 AK4: Faktor mit Beitrag 0 fehlt, Faktoren mit Beitrag ≠ 0 sind vorhanden', async () => {
		// Priorität 1 ⇒ 0, Aufwand 1 ⇒ 0, keine Deadline/Nachfolger/Säulen ⇒ alle Beiträge 0.
		await Task.create({ title: 'Null', priority: 1, estimatedEffort: 1 });
		const [leer] = (await (await get('/suggestions')).json()) as Array<{ scoreBreakdown: Breakdown }>;
		assert.ok(leer.scoreBreakdown, 'scoreBreakdown fehlt');
		assert.deepEqual(Object.keys(leer.scoreBreakdown), ['total']);
		assert.equal(leer.scoreBreakdown.total, 0);

		await resetDb();
		const blocker = await Task.create({ title: 'Blocker', priority: 5, estimatedEffort: 0.5, deadline: new Date() });
		const folge = await Task.create({ title: 'Folge', priority: 1, estimatedEffort: 1 });
		await folge.addDependency(blocker);
		const [voll] = (await (await get('/suggestions')).json()) as Array<{ id: number; scoreBreakdown: Breakdown }>;
		assert.equal(voll.id, blocker.id);
		for (const key of ['priority', 'unlock', 'deadline', 'effort'] as const) {
			assert.ok((voll.scoreBreakdown[key] ?? 0) > 0, `${key} fehlt`);
		}
		assert.ok(!('balance' in voll.scoreBreakdown), 'balance (keine Säulen) muss fehlen');
	});
});
