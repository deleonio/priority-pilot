import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEntry } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1362 (Spec docs/spec/issue-1362.md) — `GET /scores/milestones`.
 *
 * AK5: liefert `200` mit der Meilenstein-Stufenliste, wertet ausschließlich Tasks/ScoreEntries des
 *   eingeloggten Nutzers aus (Datenisolation, Muster `/scores/streak`) und akzeptiert `?tz=`; ein
 *   unbekannter tz-Wert führt nicht zu einem Fehler, sondern auf die Serverzeitzone zurück.
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback, kein Router unter `/scores/milestones`).
 * KEIN Produktivcode. `ScoreEntry.punkte` wird nach dem Erledigen direkt überschrieben, um deterministisch
 * hohe Punktesummen zu erzeugen (Muster `streak.test.ts` für `zeitpunkt`).
 */

applyTestAuthEnv('test-secret-issue-1362');

let server: TestServer;

type Stufe = { schluessel: string; typ: 'streak' | 'punkte'; schwelle: number; erreicht: boolean };

const getMilestones = (cookie: string, query = ''): Promise<Response> =>
	server.json(`/scores/milestones${query}`, { headers: { Cookie: cookie } });

/** Legt einen Task an, erledigt ihn heute und setzt `ScoreEntry.punkte` direkt auf `punkte`. */
const completeTaskWithPunkte = async (cookie: string, title: string, punkte: number): Promise<void> => {
	const createRes = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort: 1 }),
	});
	assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
	const task = (await createRes.json()) as { id: number };

	const doneRes = await server.json(`/tasks/${task.id}`, {
		method: 'PATCH',
		headers: { Cookie: cookie },
		body: JSON.stringify({ status: 'Done' }),
	});
	assert.equal(doneRes.status, 200, 'Statuswechsel auf Done muss 200 liefern');

	const [updated] = await ScoreEntry.update({ punkte }, { where: { taskId: task.id } });
	assert.equal(updated, 1, 'ScoreEntry für den Task muss existieren, um die Punkte zu setzen');
};

describe('GET /scores/milestones (#1362)', () => {
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

	it('ohne Session → 401', async () => {
		assert.equal((await getMilestones('cookie=none')).status, 401);
	});

	it('AK5: ohne Erledigungen liefert 200, alle Stufen erreicht=false', async () => {
		const cookie = await server.register('milestones-empty@example.com', 'password123');
		const res = await getMilestones(cookie);
		assert.equal(res.status, 200);
		const stufen = (await res.json()) as Stufe[];
		assert.ok(stufen.length > 0, 'Antwort muss Stufen enthalten');
		assert.equal(
			stufen.every((s) => s.erreicht === false),
			true,
		);
	});

	it('AK5/AK6: Bestandsdaten oberhalb der 250-Punkte-Schwelle sind beim ersten Aufruf erreicht=true', async () => {
		const cookie = await server.register('milestones-punkte@example.com', 'password123');
		await completeTaskWithPunkte(cookie, 'Viele Punkte', 300);

		const stufen = (await (await getMilestones(cookie)).json()) as Stufe[];
		const stufe250 = stufen.find((s) => s.typ === 'punkte' && s.schwelle === 250);
		const stufe1000 = stufen.find((s) => s.typ === 'punkte' && s.schwelle === 1000);
		assert.equal(stufe250?.erreicht, true, '300 Punkte müssen die 250er-Stufe erreichen');
		assert.equal(stufe1000?.erreicht, false, '300 Punkte dürfen die 1000er-Stufe nicht erreichen');
	});

	it('AK5: Datenisolation — Erledigungen eines anderen Nutzers verändern die eigene Auswertung nicht', async () => {
		const cookieA = await server.register('milestones-a@example.com', 'password123');
		const cookieB = await server.register('milestones-b@example.com', 'password123');
		await completeTaskWithPunkte(cookieA, 'A viele Punkte', 5000);

		const stufenB = (await (await getMilestones(cookieB)).json()) as Stufe[];
		assert.equal(
			stufenB.every((s) => s.erreicht === false),
			true,
			'B darf die Punkte von A nicht sehen',
		);

		const stufenA = (await (await getMilestones(cookieA)).json()) as Stufe[];
		const punkteA = stufenA.filter((s) => s.typ === 'punkte');
		assert.equal(
			punkteA.every((s) => s.erreicht === true),
			true,
			'A behält die eigenen Punkte unabhängig von B',
		);
	});

	it('AK5: gültige, ungültige und fehlende tz liefern alle 200 (kein Fehler)', async () => {
		const cookie = await server.register('milestones-tz@example.com', 'password123');
		assert.equal((await getMilestones(cookie, '?tz=Europe/Berlin')).status, 200);
		assert.equal((await getMilestones(cookie, '?tz=Kein/Ding')).status, 200);
		assert.equal((await getMilestones(cookie)).status, 200);
	});
});
