import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, ScoreEntry, User } from '../models/index.js';

/**
 * Spec-Tests für #1438 (Spec `docs/spec/issue-1438.md`), teilweise abgelöst durch #1821
 * (Spec `docs/spec/issue-1821.md`): erledigte Tasks sind wieder direkt bearbeitbar (AK1/AK4/AK6
 * umgedreht auf 200), Punkte werden bei Änderung von Aufwand/Priorität/Deadline neu berechnet.
 * Unten: Sperre-Beschreibung von #1438, soweit noch gültig (Reopen, Idempotenz).
 *
 * Ein erledigter Task (`status: 'Done'`) ist eingefroren: `PATCH /tasks/:id` lehnt inhaltliche
 * Änderungen mit 409 ab, solange der Request den Status nicht im selben Aufruf von `Done`
 * wegändert. Reopen (allein oder mit inhaltlichen Feldern) bleibt möglich.
 *
 * AK7 (Bestandsverhalten für status !== 'Done' bleibt unverändert) ist bewusst KEIN neuer
 * Testfall hier — der Bestandslauf (`api.test.ts`, `tasks-checklist.test.ts`,
 * `tasks-address.test.ts`, `tasks-handover.test.ts`, `tasks-reopen-score.test.ts`,
 * `score.test.ts`, `tasks-subtask-status-guard.test.ts`) deckt das bereits ab (Dedup-Regel).
 * AK9 (openapi.yml-Doku) ist kein Applikationscode → kein Testfall (ADR 0001).
 *
 * Rot, bis `server/src/express/routes/tasks.ts` den Guard vor der Transaktion ergänzt. KEIN
 * Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'done-guard-a@example.com,done-guard-b@example.com';
applyTestAuthEnv('tasks-done-edit-guard-test');

const OWNER = 'done-guard-a@example.com';
const MEMBER = 'done-guard-b@example.com';

let server: TestServer;

const patchTask = async (cookie: string, id: number, body: unknown): Promise<Response> =>
	fetch(`${server.baseUrl}/tasks/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const getTask = async (cookie: string, id: number): Promise<Response> =>
	fetch(`${server.baseUrl}/tasks/${id}`, { headers: { Cookie: cookie } });

const createTask = async (cookie: string, body: Record<string, unknown>): Promise<{ id: number; status: string }> => {
	const res = await fetch(`${server.baseUrl}/tasks`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ priority: 3, estimatedEffort: 1, ...body }),
	});
	assert.equal(res.status, 201, 'Setup: Task-Anlage muss 201 liefern');
	return (await res.json()) as { id: number; status: string };
};

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

const fetchScores = async (cookie: string): Promise<Array<{ taskId: number }>> => {
	const res = await fetch(`${server.baseUrl}/scores`, { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'Setup: GET /scores muss 200 liefern');
	return (await res.json()) as Array<{ taskId: number }>;
};

describe('PATCH /tasks/:id — Done-Bearbeitungssperre (#1438)', () => {
	let cookie: string;

	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		cookie = await server.register(OWNER);
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('#1821 AK1: inhaltliche Felder ohne status auf einen Done-Task → 200, Felder übernommen, Status bleibt Done (bisher #1438 AK1 → 409)', async () => {
		const task = await createTask(cookie, { title: 'Original' });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { title: 'Neu', priority: 5 });
		assert.equal(res.status, 200);

		const nachlese = (await (await getTask(cookie, task.id)).json()) as {
			title: string;
			priority: number;
			status: string;
		};
		assert.equal(nachlese.title, 'Neu');
		assert.equal(nachlese.priority, 5);
		assert.equal(nachlese.status, 'Done');
	});

	it('AK2: {status: "Open"} auf einen Done-Task → 200, Reopen bleibt möglich', async () => {
		const task = await createTask(cookie, { title: 'Wird wiedereröffnet' });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { status: 'Open' });
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { status: string }).status, 'Open');
	});

	it('AK2b: {status: "In process"} auf einen Done-Task → 200', async () => {
		const task = await createTask(cookie, { title: 'Wird reaktiviert' });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { status: 'In process' });
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { status: string }).status, 'In process');
	});

	it('AK3: Statuswechsel + inhaltliche Felder im selben Request auf einen Done-Task → 200, beide Änderungen übernommen', async () => {
		const task = await createTask(cookie, { title: 'Original', priority: 1 });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { status: 'Open', title: 'Neu', priority: 5 });
		assert.equal(res.status, 200);
		const body = (await res.json()) as { status: string; title: string; priority: number };
		assert.equal(body.status, 'Open');
		assert.equal(body.title, 'Neu');
		assert.equal(body.priority, 5);
	});

	it('#1821 AK2: {status: "Done", title: "Neu"} auf bereits erledigten Task → 200, Titel übernommen (bisher #1438 AK4 → 409)', async () => {
		const task = await createTask(cookie, { title: 'Original' });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { status: 'Done', title: 'Neu' });
		assert.equal(res.status, 200);

		const nachlese = await getTask(cookie, task.id);
		assert.equal(((await nachlese.json()) as { title: string }).title, 'Neu');
	});

	it('AK5: {status: "Done"} ohne inhaltliche Felder auf bereits erledigten Task → weiterhin 200, kein zweiter ScoreEntry', async () => {
		const task = await createTask(cookie, {
			title: 'Idempotent',
			deadline: new Date('2026-12-31T00:00:00.000Z').toISOString(),
		});
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);
		const nachErstemDone = (await fetchScores(cookie)).filter((entry) => entry.taskId === task.id).length;
		assert.equal(nachErstemDone, 1, 'Vorbedingung: genau ein ScoreEntry nach dem ersten Done');

		const res = await patchTask(cookie, task.id, { status: 'Done' });
		assert.equal(res.status, 200);

		const nachZweitemDone = (await fetchScores(cookie)).filter((entry) => entry.taskId === task.id).length;
		assert.equal(nachZweitemDone, 1, 'kein zweiter ScoreEntry durch das wiederholte Done');
	});

	it('#1821 AK1: Übergabe (userId) an ein Gruppenmitglied auf einen Done-Task → 200, Eigentümer wechselt (bisher #1438 AK6 → 409)', async () => {
		const memberCookie = await server.register(MEMBER);
		const ownerId = await userIdOf(OWNER);
		const memberId = await userIdOf(MEMBER);
		const group = await Group.create({ name: 'Übergabe-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: ownerId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: memberId, role: 'member', joinedAt: new Date() });
		void memberCookie;

		const task = await createTask(cookie, { title: 'Übergabe-Kandidat' });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { userId: memberId });
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { userId: number }).userId, memberId);
		assert.notEqual(memberId, ownerId);
	});

	it('AK6b: {userId: <eigene ID>} ohne Statuswechsel auf einen Done-Task → 200 (No-Op, #1252)', async () => {
		const ownerId = await userIdOf(OWNER);
		const task = await createTask(cookie, { title: 'Bleibt bei mir' });
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);

		const res = await patchTask(cookie, task.id, { userId: ownerId });
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { userId: number }).userId, ownerId);
	});
});

describe('PATCH /tasks/:id — Punkte-Neuberechnung bei Done-Bearbeitung (#1821 AK3)', () => {
	let cookie: string;

	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		cookie = await server.register(OWNER);
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const scoreOf = async (taskId: number): Promise<{ punkte: number; pünktlich: boolean; zeitpunkt: string }> => {
		const entries = await fetchScores(cookie);
		const own = (entries as Array<{ taskId: number; punkte: number; pünktlich: boolean; zeitpunkt: string }>).filter(
			(entry) => entry.taskId === taskId,
		);
		assert.equal(own.length, 1, 'genau ein ScoreEntry je Task');
		return own[0];
	};

	it('Aufwand/Priorität geändert → punkte = neuer Aufwand × neue Priorität, zeitpunkt unverändert, weiterhin ein Eintrag', async () => {
		const task = await createTask(cookie, {
			title: 'Punkte',
			priority: 2,
			estimatedEffort: 1,
			deadline: new Date('2099-01-01T00:00:00.000Z').toISOString(),
		});
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);
		const vorher = await scoreOf(task.id);
		assert.equal(vorher.punkte, 2);

		const res = await patchTask(cookie, task.id, { estimatedEffort: 3, priority: 4 });
		assert.equal(res.status, 200);

		const nachher = await scoreOf(task.id);
		assert.equal(nachher.punkte, 12);
		assert.equal(nachher.pünktlich, true);
		assert.equal(nachher.zeitpunkt, vorher.zeitpunkt, 'zeitpunkt (Erledigt-Datum) darf sich nicht ändern');
		assert.equal(await ScoreEntry.count({ where: { taskId: task.id } }), 1);
	});

	it('Deadline vor den gespeicherten zeitpunkt gesetzt → pünktlich false, Punkte halbiert', async () => {
		const task = await createTask(cookie, {
			title: 'Verspätet',
			priority: 2,
			estimatedEffort: 2,
			deadline: new Date('2099-01-01T00:00:00.000Z').toISOString(),
		});
		assert.equal((await patchTask(cookie, task.id, { status: 'Done' })).status, 200);
		assert.equal((await scoreOf(task.id)).pünktlich, true);

		const res = await patchTask(cookie, task.id, { deadline: new Date('2020-01-01T00:00:00.000Z').toISOString() });
		assert.equal(res.status, 200);

		const nachher = await scoreOf(task.id);
		assert.equal(nachher.pünktlich, false);
		assert.equal(nachher.punkte, 2, 'Basis 2 × 2 = 4, verspätet × 0,5');
	});
});
