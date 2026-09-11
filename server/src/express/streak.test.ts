import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEntry } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1360 (Spec docs/spec/issue-1360.md) — `GET /scores/streak`.
 *
 * AK3: liefert `200` mit `{ aktuell, best, letzterTag }` und wertet ausschließlich `ScoreEntry`-
 *   Zeilen zu Tasks des eingeloggten Nutzers aus (Datenisolation, Muster `/scores/by-pillar`).
 * AK4: `?tz=<IANA>` bestimmt die Kalendertagsgrenze; ungültiger/fehlender Wert ⇒ Serverzeit, kein Fehler.
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback, kein Router unter `/scores/streak`).
 * KEIN Produktivcode. Backdating der Erledigungszeitpunkte über direktes `ScoreEntry`-Update, weil
 * `PATCH /tasks/:id` den Zeitpunkt immer auf „jetzt" setzt (Muster `score.test.ts`).
 */

applyTestAuthEnv('test-secret-issue-1360');

let server: TestServer;

const getStreak = (cookie: string, query = ''): Promise<Response> =>
	server.json(`/scores/streak${query}`, { headers: { Cookie: cookie } });

/** Legt einen Task an, erledigt ihn und setzt den `ScoreEntry.zeitpunkt` direkt auf `zeitpunkt`. */
const completeTaskAt = async (cookie: string, title: string, zeitpunkt: Date): Promise<void> => {
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

	const [updated] = await ScoreEntry.update({ zeitpunkt }, { where: { taskId: task.id } });
	assert.equal(updated, 1, 'ScoreEntry für den Task muss existieren, um den Zeitpunkt zu verschieben');
};

describe('GET /scores/streak (#1360)', () => {
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
		assert.equal((await getStreak('cookie=none')).status, 401);
	});

	it('AK3: ohne Erledigungen liefert 200 mit aktuell=0, best=0, letzterTag=null', async () => {
		const cookie = await server.register('streak-empty@example.com', 'password123');
		const res = await getStreak(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { aktuell: 0, best: 0, letzterTag: null });
	});

	it('AK3: drei zusammenhängende Erledigungstage bis heute ergeben aktuell=3, letzterTag=heute', async () => {
		const cookie = await server.register('streak-three@example.com', 'password123');
		const heute = new Date();
		const tag = (offset: number): Date => {
			const d = new Date(heute);
			d.setUTCDate(d.getUTCDate() - offset);
			d.setUTCHours(12, 0, 0, 0);
			return d;
		};
		await completeTaskAt(cookie, 'Tag -2', tag(2));
		await completeTaskAt(cookie, 'Tag -1', tag(1));
		await completeTaskAt(cookie, 'Tag 0', tag(0));

		const res = await getStreak(cookie, '?tz=UTC');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { aktuell: number; best: number; letzterTag: string | null };
		assert.equal(body.aktuell, 3);
		assert.equal(body.best, 3);
		assert.equal(body.letzterTag, tag(0).toISOString().slice(0, 10));
	});

	it('AK3: Datenisolation — Erledigungen eines anderen Nutzers verändern die eigene Streak nicht', async () => {
		const cookieA = await server.register('streak-a@example.com', 'password123');
		const cookieB = await server.register('streak-b@example.com', 'password123');
		await completeTaskAt(cookieA, 'A erledigt', new Date());

		const resB = await getStreak(cookieB);
		assert.equal(resB.status, 200);
		assert.deepEqual(
			await resB.json(),
			{ aktuell: 0, best: 0, letzterTag: null },
			'B darf die Erledigungen von A nicht sehen',
		);

		const resA = await getStreak(cookieA);
		const bodyA = (await resA.json()) as { aktuell: number };
		assert.equal(bodyA.aktuell, 1, 'A behält die eigene Streak unabhängig von B');
	});

	it('AK4: gültige, ungültige und fehlende tz liefern alle 200 (kein Fehler)', async () => {
		const cookie = await server.register('streak-tz@example.com', 'password123');
		await completeTaskAt(cookie, 'Einmalig', new Date());

		assert.equal((await getStreak(cookie, '?tz=Europe/Berlin')).status, 200);
		assert.equal((await getStreak(cookie, '?tz=Kein/Ding')).status, 200);
		assert.equal((await getStreak(cookie)).status, 200);
	});

	it('AK4: eine grenznahe Erledigung verschiebt den Kalendertag je nach tz', async () => {
		const cookie = await server.register('streak-boundary@example.com', 'password123');
		// 2026-09-11T23:30:00Z ist in UTC noch der 11., in Europe/Berlin (UTC+2 im Sommer) bereits der 12.
		await completeTaskAt(cookie, 'Grenzfall', new Date('2026-09-11T23:30:00.000Z'));

		const utc = (await (await getStreak(cookie, '?tz=UTC')).json()) as { letzterTag: string | null };
		const berlin = (await (await getStreak(cookie, '?tz=Europe/Berlin')).json()) as { letzterTag: string | null };

		assert.equal(utc.letzterTag, '2026-09-11');
		assert.equal(berlin.letzterTag, '2026-09-12', 'Europe/Berlin verschiebt den Kalendertag über Mitternacht hinaus');
	});
});
