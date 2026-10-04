import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEntry, Task, TaskPillar, User } from '../models/index.js';
import { PILLAR_RHYTHMS } from '../models/pillarData.js';
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

/**
 * Legt einen Task mit Säulenanteilen an und erledigt ihn. #2077: die Beiträge werden direkt in
 * der DB eingeklagt (Legacy-Bestand außerhalb der API-Schreib-Regel, Muster des AK5-Legacy-Tests)
 * — die Balance-/Trend-Lesepfade werten Alt-Verteilungen unverfälscht aus; die Schreib-Regel
 * (Vollverteilungs-Pflicht) ist für diese Lesetests bewusst nicht aktiv.
 */
const completeTaskWithShares = async (
	cookie: string,
	title: string,
	estimatedEffort: number,
	pillars: { pillarId: number; share: number }[],
): Promise<number> => {
	const createRes = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort }),
	});
	assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
	const task = (await createRes.json()) as { id: number };
	for (const entry of pillars) {
		await TaskPillar.create({ taskId: task.id, pillarId: entry.pillarId, share: entry.share, confidence: 100 });
	}

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

	it('#2077 AK5: Legacy-Einzel-Säule (share 100) bleibt abrufbar und geht unverfälscht in die Balance ein', async () => {
		const cookie = await server.register('balance-legacy@example.com', 'password123');
		const pillarsRes = await server.json('/pillars', { headers: { Cookie: cookie } });
		const pillars = (await pillarsRes.json()) as { id: number }[];
		const user = await User.findOne({ where: { email: 'balance-legacy@example.com' } });
		assert.ok(user, 'Setup: Konto muss existieren');

		// Alt-Bestand direkt in der DB (außerhalb der neuen Validierung): einzelne Säule, share 100.
		const legacy = await Task.create({ title: 'Legacy', priority: 3, estimatedEffort: 1, userId: user.id });
		await TaskPillar.create({ taskId: legacy.id, pillarId: pillars[0]!.id, share: 100, confidence: 100 });
		await server.json(`/tasks/${legacy.id}`, {
			method: 'PATCH',
			headers: { Cookie: cookie },
			body: JSON.stringify({ status: 'Done' }),
		});

		const res = await getBalance(cookie);
		assert.equal(res.status, 200, 'Legacy-Bestand muss weiter abrufbar sein');
		const body = (await res.json()) as { saeulen: { id: number; punkte: number }[] };
		const saeule = body.saeulen.find((entry) => entry.id === pillars[0]!.id);
		assert.ok(saeule && saeule.punkte > 0, 'die Legacy-Säule muss unverfälscht Punkte tragen');

		// Keine Migration beim Lesen: die Einzel-Form bleibt unverändert bestehen.
		const rows = await TaskPillar.findAll({ where: { taskId: legacy.id } });
		assert.equal(rows.length, 1);
		assert.equal(rows[0]!.share, 100);
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

	it('#1638 AK3/AK4/AK7: Erledigung vor > 28 Tagen zählt in punkte, nicht im Füllstand; ScoreEntry.punkte bleibt', async () => {
		const cookie = await server.register('balance-kadenz@example.com', 'password123');
		const saeule = await createPillar(cookie, `Kadenz-${idCounter++}`);
		const alteTaskId = await completeTaskWithShares(cookie, 'Alte Erledigung', 0.5, [
			{ pillarId: saeule.id, share: 100 },
		]);
		const [eintragVorher] = await ScoreEntry.findAll({ where: { taskId: alteTaskId } });
		await ScoreEntry.update(
			{ zeitpunkt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
			{ where: { taskId: alteTaskId } },
		);

		type Antwort = { fuellstandProzent: number; hatPunkte: boolean; saeulen: { id: number; punkte: number }[] };
		const alt = (await (await getBalance(cookie)).json()) as Antwort;
		assert.equal(alt.hatPunkte, true);
		assert.equal(alt.fuellstandProzent, 0, 'außerhalb des 28-Tage-Fensters darf nichts in den Füllstand zählen');
		assert.equal(alt.saeulen.find((s) => s.id === saeule.id)?.punkte, 0.5, 'punkte bleiben kumulativ');

		await completeTaskWithShares(cookie, 'Frische Erledigung', 0.25, [{ pillarId: saeule.id, share: 100 }]);
		const frisch = (await (await getBalance(cookie)).json()) as Antwort;
		assert.ok(frisch.fuellstandProzent > 0, 'eine Erledigung im Fenster muss den Füllstand heben');
		assert.equal(frisch.saeulen.find((s) => s.id === saeule.id)?.punkte, 0.75);

		const [eintragNachher] = await ScoreEntry.findAll({ where: { taskId: alteTaskId } });
		assert.equal(eintragNachher.punkte, eintragVorher.punkte, 'Gamification-Punkte bleiben unverändert');
	});

	it('#1663 AK5: ungleiche Gewichte ändern den Füllstand von GET /scores/balance (Körper hoch/gleich)', async () => {
		const cookie = await server.register('balance-gewichte@example.com', 'password123');
		const pillarRes = await server.json('/pillars', { headers: { Cookie: cookie } });
		assert.equal(pillarRes.status, 200, 'Setup: Säulen müssen über die API lesbar sein');
		const pillars = (await pillarRes.json()) as { id: number; name: string; weight: number }[];
		assert.equal(pillars.length, 5, 'Setup: Registrierung sollte fünf Standard-Säulen säen');

		// Körper bleibt ohne Erledigung im Fenster, die übrigen vier Säulen erfüllen ihren
		// Soll-Rhythmus aus PILLAR_RHYTHMS vollständig (rhythmusProWoche × 4 Wochen).
		const rhythmusProName = new Map(PILLAR_RHYTHMS.map((eintrag) => [eintrag.name, eintrag.rhythmusProWoche]));
		const koerper = pillars.find((p) => p.name === 'Körper');
		assert.ok(koerper, 'Setup: Standard-Säule Körper muss existieren');
		for (const pillar of pillars) {
			if (pillar.id === koerper!.id) continue;
			const rhythmus = rhythmusProName.get(pillar.name) ?? 1;
			for (let i = 0; i < rhythmus * 4; i++) {
				await completeTaskWithShares(cookie, `Gewichte-${pillar.id}-${i}`, 0.1, [{ pillarId: pillar.id, share: 100 }]);
			}
		}

		const setzeGewichte = async (gewichtKoerper: number, rest: number): Promise<number> => {
			const res = await server.json('/pillars/weights', {
				method: 'PUT',
				headers: { Cookie: cookie },
				body: JSON.stringify({
					weights: pillars.map((p) => ({ id: p.id, weight: p.id === koerper!.id ? gewichtKoerper : rest })),
				}),
			});
			assert.equal(res.status, 200, 'Setup: PUT /pillars/weights muss 200 liefern');
			const body = (await (await getBalance(cookie)).json()) as { fuellstandProzent: number };
			return body.fuellstandProzent;
		};

		// Einziges Defizit ist Körper (Erfüllung 0): gleiche Gewichte → 1 − √0,2 ≈ 55,3 %;
		// Körper hoch gewichtet → gewichtete Komponente 1 − √0,6 ≈ 22,5 %.
		const gleich = await setzeGewichte(20, 20);
		const hoch = await setzeGewichte(60, 10);
		assert.ok(
			Math.abs(gleich - 55.3) < 0.2,
			`fuellstandProzent=${gleich} muss ≈ 55,3 sein bei gleichen Gewichten (AK5)`,
		);
		assert.ok(
			Math.abs(hoch - 22.5) < 0.2,
			`fuellstandProzent=${hoch} muss ≈ 22,5 sein, wenn Körper hoch gewichtet ist (AK5)`,
		);
		assert.ok(hoch < gleich, 'höheres Gewicht der unbedienten Säule muss den Füllstand senken (AK5)');
	});
});

/**
 * Rote Spec-Tests für #1796 (Spec docs/spec/issue-1796.md) — AK3: `GET /scores/balance` trägt je
 * Säule `trend` und `defizitaer` (Quelle `bewerteCareDefizit`), Bestandsfelder bleiben.
 */
describe('GET /scores/balance — Trend und Defizit (#1796)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		seedPillarCursor = 0;
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK3: je Säule trend/defizitaer nach Fenstervergleich, Bestandsfelder unverändert', async () => {
		const cookie = await server.register('balance-trend@example.com', 'password123');
		const tag = 24 * 60 * 60 * 1000;
		const juengerP = await createPillar(cookie, 'Jung');
		const aelterP = await createPillar(cookie, 'Alt');
		const leerP = await createPillar(cookie, 'Leer');
		const taskJung = await completeTaskWithShares(cookie, 'Jung', 1, [{ pillarId: juengerP.id, share: 100 }]);
		const taskAlt = await completeTaskWithShares(cookie, 'Alt', 1, [{ pillarId: aelterP.id, share: 100 }]);
		await ScoreEntry.update({ zeitpunkt: new Date(Date.now() - tag) }, { where: { taskId: taskJung } });
		await ScoreEntry.update({ zeitpunkt: new Date(Date.now() - 10 * tag) }, { where: { taskId: taskAlt } });

		const body = (await (await getBalance(cookie)).json()) as {
			saeulen: { id: number; name: string; punkte: number; gewichtung: number; trend?: string; defizitaer?: boolean }[];
		};
		const je = (id: number) => body.saeulen.find((s) => s.id === id);
		assert.deepEqual([je(juengerP.id)?.trend, je(juengerP.id)?.defizitaer], ['erholt', false]);
		assert.deepEqual([je(aelterP.id)?.trend, je(aelterP.id)?.defizitaer], ['verschlechtert', true]);
		assert.deepEqual([je(leerP.id)?.trend, je(leerP.id)?.defizitaer], ['stabil', true]);
		assert.equal(je(juengerP.id)?.gewichtung, juengerP.weight, 'Bestandsfeld gewichtung bleibt');
		assert.ok(typeof je(juengerP.id)?.punkte === 'number', 'Bestandsfeld punkte bleibt');
	});

	// ── #1965 AK3: Balance zeigt einen einmal erreichten Meilenstein nach Reopen weiterhin ──

	it('#1965 AK3: der meilensteine-Filter zeigt die Stufe nach Reopen unverändert (sticky)', async () => {
		const cookie = await server.register('balance-sticky@example.com', 'password123');
		const createRes = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ title: 'Sticky-Balance', priority: 3, estimatedEffort: 1 }),
		});
		assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await createRes.json()) as { id: number };
		const doneRes = await server.json(`/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { Cookie: cookie },
			body: JSON.stringify({ status: 'Done' }),
		});
		assert.equal(doneRes.status, 200, 'Statuswechsel auf Done muss 200 liefern');
		await ScoreEntry.update({ punkte: 300 }, { where: { taskId: task.id } });

		const vorReopen = (await (await getBalance(cookie)).json()) as {
			meilensteine: { schluessel: string }[];
		};
		assert.ok(
			vorReopen.meilensteine.some((m) => m.schluessel === 'punkte-250'),
			'Vorbedingung: die 250er-Stufe ist erreicht und im Balance-Filter sichtbar',
		);

		const reopen = await server.json(`/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { Cookie: cookie },
			body: JSON.stringify({ status: 'Open' }),
		});
		assert.equal(reopen.status, 200, 'Reopen muss 200 liefern');

		const nachReopen = (await (await getBalance(cookie)).json()) as {
			meilensteine: { schluessel: string }[];
		};
		assert.ok(
			nachReopen.meilensteine.some((m) => m.schluessel === 'punkte-250'),
			'AK3: die Balance zeigt die einmal erreichte Stufe trotz Reopen weiterhin',
		);
		const nochmal = (await (await getBalance(cookie)).json()) as { meilensteine: { schluessel: string }[] };
		assert.deepEqual(nochmal.meilensteine, nachReopen.meilensteine, 'AK3: ein zweiter Leselauf ändert nichts');
	});

	it('AK1 (#2150): ein Balance-Request liest ScoreEntry.findAll genau einmal', async (t) => {
		const cookie = await server.register('balance-einlesen@example.com', 'password123');
		const saeule = await createPillar(cookie, `Eins-${idCounter++}`);
		await completeTaskWithShares(cookie, 'Einlese-Aufgabe', 1, [{ pillarId: saeule.id, share: 100 }]);

		const original = ScoreEntry.findAll;
		let aufrufe = 0;
		ScoreEntry.findAll = (async (...args: Parameters<typeof original>) => {
			aufrufe++;
			return original.apply(ScoreEntry, args);
		}) as typeof ScoreEntry.findAll;
		t.after(() => {
			ScoreEntry.findAll = original;
		});

		const res = await getBalance(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { streak: { aktuell: number }; meilensteine: unknown[] };
		assert.ok(body.streak, 'Antwort bleibt unverändert: streak ist vorhanden');
		assert.ok(Array.isArray(body.meilensteine), 'Antwort bleibt unverändert: meilensteine ist eine Liste');
		assert.equal(aufrufe, 1, `genau ein ScoreEntry.findAll je Balance-Request ( aktuell: ${aufrufe})`);
	});
});
