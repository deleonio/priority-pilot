import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { runDeadlineAutoDelete } from '../logics/autoDeleteAfterDeadline.js';

/**
 * Tests für `GET /scores/missed` — Sichtbarkeit von Aufgaben, die der Auto-Delete-Cron
 * (`runDeadlineAutoDelete`, Issue #523) wegen abgelaufener Deadline gelöscht hat. Rein
 * informativ fürs Bewertungssystem; die Daten entstehen NICHT über eine HTTP-Aktion, sondern
 * über den Cron selbst — deshalb ruft der Test `runDeadlineAutoDelete` direkt auf, analog zu
 * `autoDeleteAfterDeadline.test.ts`.
 */

applyTestAuthEnv('test-secret-scores-missed');

let server: TestServer;

type MissedTaskDto = { taskId: number; title: string; deadline: string; verpasstAm: string };
type MissedTasksSummaryDto = { anzahl: number; eintraege: MissedTaskDto[] };

const getMissed = (cookie: string): Promise<Response> => server.json('/scores/missed', { headers: { Cookie: cookie } });

/** Legt über die API einen Task mit vergangener Deadline und aktivierter Auto-Delete-Option an. */
const createOverdueTask = async (cookie: string, title: string): Promise<number> => {
	const deadline = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
	const createRes = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort: 1, deadline, autoDeleteAfterDeadline: true }),
	});
	assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
	const task = (await createRes.json()) as { id: number };
	return task.id;
};

describe('GET /scores/missed', () => {
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
		assert.equal((await getMissed('cookie=none')).status, 401);
	});

	it('ohne verpasste Aufgaben liefert 200 mit anzahl=0 und leerer Liste', async () => {
		const cookie = await server.register('missed-empty@example.com', 'password123');
		const res = await getMissed(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as MissedTasksSummaryDto;
		assert.deepEqual(body, { anzahl: 0, eintraege: [] });
	});

	it('zeigt eine vom Cron gelöschte Aufgabe mit Titel/Id an', async () => {
		const cookie = await server.register('missed-one@example.com', 'password123');
		const taskId = await createOverdueTask(cookie, 'Verpasste Aufgabe');

		await runDeadlineAutoDelete(new Date());

		const body = (await (await getMissed(cookie)).json()) as MissedTasksSummaryDto;
		assert.equal(body.anzahl, 1);
		assert.equal(body.eintraege[0].taskId, taskId);
		assert.equal(body.eintraege[0].title, 'Verpasste Aufgabe');
	});

	it('Datenisolation — verpasste Aufgaben eines anderen Nutzers sind nicht sichtbar', async () => {
		const cookieA = await server.register('missed-a@example.com', 'password123');
		const cookieB = await server.register('missed-b@example.com', 'password123');
		await createOverdueTask(cookieA, 'A verpasst');

		await runDeadlineAutoDelete(new Date());

		const bodyB = (await (await getMissed(cookieB)).json()) as MissedTasksSummaryDto;
		assert.equal(bodyB.anzahl, 0, 'B darf die verpasste Aufgabe von A nicht sehen');

		const bodyA = (await (await getMissed(cookieA)).json()) as MissedTasksSummaryDto;
		assert.equal(bodyA.anzahl, 1, 'A sieht weiterhin die eigene verpasste Aufgabe');
	});
});
