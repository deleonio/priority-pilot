import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Task, TaskPillar, Pillar, ScoreEntry, User } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';

/**
 * Rote Spec-Tests für #1521 — Aufgabe an eine ganze Gruppe zuweisen, Erlediger bekommt die
 * Gutschrift (Vertrag: docs/spec/issue-1521.md, AK2–AK5).
 *
 * `Task.groupId` existiert am Modell noch nicht (Analyse-Block #1521). Damit die Tests dennoch den
 * beabsichtigten Ziel-Zustand ("Aufgabe hat eine Gruppe, aber noch keinen Empfänger") seeden können,
 * zieht `ensureGroupIdColumn` die Spalte testseitig per rohem SQL nach (Muster
 * `ensureDisplayNameCustomColumn` in `test/helpers.ts`, #1256) — das SUT bleibt vollständig die
 * echte HTTP-API (`GET /tasks`, `PATCH /tasks/:id`), nicht das Modell.
 *
 * Rot, bis `taskReadScope`/die Done-Claim-Logik/die Säulen-Umverrechnung `groupId` auswerten.
 * KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,anna@example.com,carol@example.com';
applyTestAuthEnv('issue-1521-group-task-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const ANNA = 'anna@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

/** Zieht `tasks.groupId` testseitig nach (Spalte existiert am Modell noch nicht, siehe Datei-Kopf). */
const ensureGroupIdColumn = async (): Promise<void> => {
	const [rows] = await sequelize.query("PRAGMA table_info('tasks')");
	const hasColumn = (rows as { name: string }[]).some((row) => row.name === 'groupId');
	if (!hasColumn) {
		await sequelize.query('ALTER TABLE `tasks` ADD COLUMN `groupId` INTEGER');
	}
};

/** Setzt `groupId` einer Zeile per SQL (das Modell kennt das Attribut noch nicht, `task.update` würde es ignorieren). */
const setGroupId = async (taskId: number, groupId: number | null): Promise<void> => {
	await ensureGroupIdColumn();
	await sequelize.query('UPDATE `tasks` SET `groupId` = ? WHERE `id` = ?', { replacements: [groupId, taskId] });
};

/** Liest `groupId`/`userId` einer Task-Zeile roh (Orakel — Modell kennt `groupId` noch nicht). */
const rawTaskRow = async (taskId: number): Promise<{ groupId: number | null; userId: number | null }> => {
	await ensureGroupIdColumn();
	const [rows] = await sequelize.query('SELECT `groupId`, `userId` FROM `tasks` WHERE `id` = ?', {
		replacements: [taskId],
	});
	const row = (rows as { groupId: number | null; userId: number | null }[])[0];
	assert.ok(row, `Setup: Task ${taskId} muss existieren`);
	return row;
};

/** Seedet eine unclaimte Gruppen-Aufgabe (`groupId = G`, `userId = null`) direkt am Modell. */
const seedGroupTask = async (title: string, groupId: number): Promise<Task> => {
	const task = await Task.create({ title, status: 'Open', userId: null, priority: 3, estimatedEffort: 0.5 });
	await setGroupId(task.id, groupId);
	return task;
};

/** Seedet die fünf Standard-Säulen für einen Nutzer (Muster pillars.test.ts). */
const seedPillarsFor = (userId: number): Promise<Pillar[]> =>
	Pillar.bulkCreate(SEED_PILLARS.map(({ name, description, weight }) => ({ name, description, weight, userId })));

describe('Gruppen-Aufgabe: Claim durch ein Mitglied (#1521)', () => {
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

	const seedGroup = async (): Promise<{
		group: Group;
		aliceId: number;
		bobId: number;
		annaId: number;
		carolId: number;
	}> => {
		await server.login(ALICE, { displayName: 'Alice Admin' });
		await server.login(BOB, { displayName: 'Bob Mitglied' });
		await server.login(ANNA, { displayName: 'Anna Mitglied' });
		await server.login(CAROL, { displayName: 'Carol Fremd' });
		const group = await Group.create({ name: 'Spec-Gruppe #1521', description: null });
		const [aliceId, bobId, annaId, carolId] = await Promise.all([ALICE, BOB, ANNA, CAROL].map(userIdOf));
		await GroupMember.create({ groupId: group.id, userId: aliceId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: bobId, role: 'member', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: annaId, role: 'member', joinedAt: new Date() });
		return { group, aliceId, bobId, annaId, carolId };
	};

	const getTasks = async (cookie: string): Promise<{ id: number }[]> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /tasks muss 200 liefern');
		return (await res.json()) as { id: number }[];
	};

	const patchDone = (cookie: string, taskId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks/${taskId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ status: 'Done' }),
		});

	it('AK2: eine unclaimte Gruppen-Aufgabe erscheint bei jedem Mitglied, nicht beim Nicht-Mitglied', async () => {
		const { group } = await seedGroup();
		const task = await seedGroupTask('Gemeinsame Aufgabe', group.id);

		const bobList = await getTasks(await server.login(BOB));
		assert.ok(
			bobList.some((entry) => entry.id === task.id),
			'AK2: Mitglied Bob muss die Gruppen-Aufgabe in GET /tasks sehen',
		);

		const carolList = await getTasks(await server.login(CAROL));
		assert.ok(
			!carolList.some((entry) => entry.id === task.id),
			'AK2: Nicht-Mitglied Carol darf die Gruppen-Aufgabe nicht sehen',
		);
	});

	it('AK3: ein beliebiges Mitglied kann die Gruppen-Aufgabe erledigen, danach fehlt sie den übrigen Mitgliedern', async () => {
		const { group } = await seedGroup();
		const task = await seedGroupTask('Gemeinsame Aufgabe', group.id);

		const bobRes = await patchDone(await server.login(BOB), task.id);
		assert.equal(
			bobRes.status,
			200,
			'AK3: Bob (kein Eigentümer, aber Gruppenmitglied) muss die Aufgabe erledigen können',
		);

		const annaList = await getTasks(await server.login(ANNA));
		assert.ok(
			!annaList.some((entry) => entry.id === task.id),
			'AK3: Nach dem Erledigen durch Bob darf Anna die Aufgabe nicht mehr als offen sehen',
		);
	});

	it('AK4: nach dem Claim existiert genau ein ScoreEntry, ein zweites Done durch ein anderes Mitglied ändert nichts', async () => {
		const { group, bobId } = await seedGroup();
		const task = await seedGroupTask('Gemeinsame Aufgabe', group.id);

		const bobRes = await patchDone(await server.login(BOB), task.id);
		assert.equal(bobRes.status, 200, 'Voraussetzung: Bob erledigt die Aufgabe');

		const row = await rawTaskRow(task.id);
		assert.equal(row.userId, bobId, 'AK4: die Aufgabe gehört nach dem Claim dem Erlediger Bob');

		const entries = await ScoreEntry.findAll({ where: { taskId: task.id } });
		assert.equal(entries.length, 1, 'AK4: genau ein ScoreEntry nach dem Erledigen');

		// Zweites "Done" durch Alice (nicht mehr Eigentümerin nach dem Claim) darf keinen zweiten
		// Eintrag erzeugen und die Gutschrift nicht verschieben.
		await patchDone(await server.login(ALICE), task.id);
		const entriesAfterSecondAttempt = await ScoreEntry.findAll({ where: { taskId: task.id } });
		assert.equal(
			entriesAfterSecondAttempt.length,
			1,
			'AK4: ein zweites Done (auch durch ein anderes Mitglied) erzeugt keinen zweiten ScoreEntry',
		);
	});

	it('AK5: Säulen-Anteile hängen nach dem Claim auf die gleichnamigen Säulen des Erledigers um', async () => {
		const { group, aliceId, bobId } = await seedGroup();
		const [alicePillars, bobPillars] = await Promise.all([seedPillarsFor(aliceId), seedPillarsFor(bobId)]);
		const task = await seedGroupTask('Gemeinsame Aufgabe mit Säulen', group.id);
		// Beiträge zeigen (wie bei der Anlage durch die Erstellerin üblich) auf Alices Säulen-Zeilen.
		const koerperAlice = alicePillars.find((p) => p.name === 'Körper');
		assert.ok(koerperAlice, 'Setup: Alice muss eine "Körper"-Säule besitzen');
		await TaskPillar.create({ taskId: task.id, pillarId: koerperAlice.id, share: 100, confidence: 80 });

		const bobRes = await patchDone(await server.login(BOB), task.id);
		assert.equal(bobRes.status, 200, 'Voraussetzung: Bob erledigt die Aufgabe');

		const contributions = await TaskPillar.findAll({ where: { taskId: task.id } });
		const koerperBob = bobPillars.find((p) => p.name === 'Körper');
		assert.ok(koerperBob, 'Setup: Bob muss eine "Körper"-Säule besitzen');
		assert.deepEqual(
			contributions.map((c) => ({ pillarId: c.pillarId, share: c.share, confidence: c.confidence })),
			[{ pillarId: koerperBob.id, share: 100, confidence: 80 }],
			'AK5: der Beitrag zeigt nach dem Claim auf Bobs gleichnamige Säule, share/confidence unverändert',
		);

		const alicePillarUnchanged = await Pillar.findByPk(koerperAlice.id);
		assert.ok(alicePillarUnchanged, "AK5: Alice's Säule bleibt unangetastet bestehen");
	});
});
