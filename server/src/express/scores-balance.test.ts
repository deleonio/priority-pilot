import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEntry } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1423 (Spec docs/spec/issue-1423.md) — `GET /scores/balance`.
 *
 * AK5: Antwort enthält je eigener Säule `{ id, name, punkte, gewichtung }`; Säule ohne Punkte
 *   erscheint mit `punkte: 0`.
 * AK6: Antwort enthält `streak.aktuell`, `streak.best` und `meilensteine` (nur erreichte Stufen).
 * AK9: dieselbe Nutzlast über die HTTP-Route und über das MCP-Werkzeug `balance_status`.
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback, kein Router unter `/scores/balance`).
 * KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1423-balance');

let server: TestServer;
let idCounter = 1;

const getBalance = (cookie: string, query = ''): Promise<Response> =>
	server.json(`/scores/balance${query}`, { headers: { Cookie: cookie } });

/**
 * Gibt eine der fünf festen Standard-Säulen des Nutzers zurück (Setup). Säulen-CRUD ist seit
 * #1573 gesperrt — die Registrierung sät fünf Standard-Säulen; statt anzulegen wird aus diesem
 * Bestand gewählt (Zyklus, damit aufeinanderfolgende Aufrufe unterschiedliche ids liefern).
 */
let seedPillarCursor = 0;
const createPillar = async (cookie: string, _name: string): Promise<{ id: number; weight: number }> => {
	const res = await server.json('/pillars', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'Setup: Säulen müssen über die API lesbar sein');
	const pillars = (await res.json()) as { id: number; weight: number }[];
	assert.ok(pillars.length > 1, 'Setup: Registrierung sollte fünf Standard-Säulen säen');
	return pillars[seedPillarCursor++ % pillars.length]!;
};

/** Legt einen Task mit Säulenanteilen an und erledigt ihn. */
const completeTaskWithShares = async (
	cookie: string,
	title: string,
	estimatedEffort: number,
	pillars: { pillarId: number; share: number }[],
): Promise<number> => {
	const createRes = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort, pillars }),
	});
	assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
	const task = (await createRes.json()) as { id: number };

	const doneRes = await server.json(`/tasks/${task.id}`, {
		method: 'PATCH',
		headers: { Cookie: cookie },
		body: JSON.stringify({ status: 'Done' }),
	});
	assert.equal(doneRes.status, 200, 'Statuswechsel auf Done muss 200 liefern');
	return task.id;
};

describe('GET /scores/balance (#1423)', () => {
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
		assert.equal((await getBalance('cookie=none')).status, 401);
	});

	it('AK5: Säulen-Punkte folgen dem share-Anteil, Säule ohne Punkte liefert punkte: 0', async () => {
		const cookie = await server.register('balance-shares@example.com', 'password123');
		const koerper = await createPillar(cookie, `Körper-${idCounter++}`);
		const geist = await createPillar(cookie, `Geist-${idCounter++}`);
		const ohnePunkte = await createPillar(cookie, `Ohne-${idCounter++}`);
		await completeTaskWithShares(cookie, 'Geteilte Aufgabe', 1, [
			{ pillarId: koerper.id, share: 70 },
			{ pillarId: geist.id, share: 30 },
		]);

		const res = await getBalance(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as {
			fuellstandProzent: number;
			hatPunkte: boolean;
			saeulen: { id: number; name: string; punkte: number; gewichtung: number }[];
		};

		const saeuleKoerper = body.saeulen.find((s) => s.id === koerper.id);
		const saeuleGeist = body.saeulen.find((s) => s.id === geist.id);
		const saeuleOhne = body.saeulen.find((s) => s.id === ohnePunkte.id);
		assert.ok(saeuleKoerper && Math.abs(saeuleKoerper.punkte - 0.7) < 1e-9, 'Körper muss 0.7 Punkte tragen');
		assert.ok(saeuleGeist && Math.abs(saeuleGeist.punkte - 0.3) < 1e-9, 'Geist muss 0.3 Punkte tragen');
		assert.equal(saeuleOhne?.punkte, 0, 'Säule ohne Beitrag muss mit punkte: 0 erscheinen, nicht fehlen');
		assert.equal(saeuleKoerper?.gewichtung, koerper.weight);
		assert.equal(body.hatPunkte, true);
	});

	it('AK5: ohne jede erledigte Aufgabe ist fuellstandProzent 0 und hatPunkte false', async () => {
		const cookie = await server.register('balance-empty@example.com', 'password123');
		await createPillar(cookie, `Leer-${idCounter++}`);

		const body = (await (await getBalance(cookie)).json()) as { fuellstandProzent: number; hatPunkte: boolean };
		assert.equal(body.fuellstandProzent, 0);
		assert.equal(body.hatPunkte, false);
	});

	it('AK6: streak.aktuell/best und meilensteine (nur erreichte Stufen) aus eigenen Erledigungen', async () => {
		const cookie = await server.register('balance-streak@example.com', 'password123');
		const heute = new Date();
		const gestern = new Date(heute.getTime() - 24 * 60 * 60 * 1000);
		const taskHeute = await completeTaskWithShares(cookie, 'Heute erledigt', 1, []);
		const taskGestern = await completeTaskWithShares(cookie, 'Gestern erledigt', 1, []);
		await ScoreEntry.update({ zeitpunkt: heute }, { where: { taskId: taskHeute } });
		await ScoreEntry.update({ zeitpunkt: gestern }, { where: { taskId: taskGestern } });

		const body = (await (await getBalance(cookie)).json()) as {
			streak: { aktuell: number; best: number };
			meilensteine: { schluessel: string; typ: string; schwelle: number }[];
		};
		assert.equal(body.streak.aktuell, 2, 'zwei aufeinanderfolgende Tage müssen den aktuellen Streak auf 2 heben');
		assert.equal(body.streak.best, 2);
		assert.ok(
			body.meilensteine.every((m) => m.typ !== 'streak' || m.schwelle <= 2),
			'meilensteine darf keine nicht erreichte Streak-Stufe enthalten',
		);
	});

	it('AK6: ohne Erledigungen ist meilensteine leer', async () => {
		const cookie = await server.register('balance-no-milestones@example.com', 'password123');
		const body = (await (await getBalance(cookie)).json()) as { meilensteine: unknown[] };
		assert.deepEqual(body.meilensteine, []);
	});

	it('AK9: dieselbe Nutzlast über die HTTP-Route und über das Werkzeug balance_status', async () => {
		const cookie = await server.register('balance-parity@example.com', 'password123');
		const pillar = await createPillar(cookie, `Parität-${idCounter++}`);
		await completeTaskWithShares(cookie, 'Für Paritätstest', 1, [{ pillarId: pillar.id, share: 100 }]);

		const tokenRes = await server.json('/api-tokens', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ name: `Client-${idCounter++}`, expiresInDays: 365 }),
		});
		assert.equal(tokenRes.status, 201, 'Setup: Token muss anlegbar sein');
		const { token } = (await tokenRes.json()) as { token: string };

		const direct = await getBalance(cookie);
		const expected = await direct.json();

		const mcpRes = await fetch(`${server.baseUrl}/mcp/v1`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: idCounter++,
				method: 'tools/call',
				params: { name: 'balance_status', arguments: {} },
			}),
		});
		assert.equal(mcpRes.status, 200, 'tools/call balance_status sollte 200 liefern');
		const mcpBody = (await mcpRes.json()) as { result?: { content?: { type: string; text: string }[] } };
		const viaTool = JSON.parse(mcpBody.result?.content?.[0]?.text ?? 'null');
		assert.deepEqual(viaTool, expected, 'balance_status muss GET /scores/balance 1:1 spiegeln');
	});
});
