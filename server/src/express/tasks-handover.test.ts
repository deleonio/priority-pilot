import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Dependency, Group, GroupMember, Pillar, Task, TaskPillar, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1252 — Übergabe einer Aufgabe an ein Gruppenmitglied über
 * PATCH /tasks/:id (Vertrag: docs/spec/issue-1252.md, AK1/AK2/AK4/AK5/AK6/AK7).
 *
 * Rollen: Alice (Eigentümerin, übergibt), Bob (Gruppenmitglied, Empfänger),
 * Carol (Drittkonto ohne gemeinsame Gruppe). Geseedet direkt an den Modellen bzw. über
 * POST /tasks — Muster groups-tasks.api.test.ts / tasks-created-by.test.ts (#1213).
 *
 * AK3 (nur Eigentümer übergibt, Ersteller ohne Eigentum → 404) ist durch den bestehenden
 * Schreib-Scope-Vertrag abgedeckt (tasks-created-by.test.ts, PATCH des Erstellers → 404) —
 * kein Duplikat (Dedup-Regel).
 *
 * Rot, bis PATCH /tasks/:id ein optionales `userId` auswertet. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('tasks-handover-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

const patchTask = async (cookie: string | undefined, id: number, body: unknown): Promise<Response> =>
	fetch(`${server.baseUrl}/tasks/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie ?? '' },
		body: JSON.stringify(body),
	});

const listTasks = async (cookie: string | undefined): Promise<Array<Record<string, unknown>>> => {
	const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie ?? '' } });
	assert.equal(res.status, 200, 'GET /tasks muss 200 liefern');
	return (await res.json()) as Array<Record<string, unknown>>;
};

describe('Aufgaben-Übergabe an ein Gruppenmitglied (#1252)', () => {
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

	/** Alice + Bob in einer gemeinsamen Gruppe, Carol ohne Gruppenbezug. */
	const seedSharedGroup = async (): Promise<void> => {
		await server.login(ALICE, { displayName: 'Alice Eigentümerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(CAROL, { displayName: 'Carol Fremd' });
		const group = await Group.create({ name: 'Übergabe-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
	};

	/** Aufgabe im Eigentum von Alice — mit geschützten Feldern, deren Erhalt AK5 prüft. */
	const seedAliceTask = async (): Promise<Task> => {
		const aliceId = await userIdOf(ALICE);
		return Task.create({
			title: 'Übergabe-Kandidat',
			description: 'Wichtige Beschreibung',
			checklist: [{ id: 'c1', title: 'erster Schritt', completed: false }],
			deadline: new Date('2026-12-24T12:00:00Z'),
			estimatedEffort: 1,
			status: 'Open',
			priority: 3,
			userId: aliceId,
		});
	};

	it('ohne userId bleibt der Eigentümer unverändert, auch mit Feldänderung im selben Request (AK1)', async () => {
		await seedSharedGroup();
		const task = await seedAliceTask();
		const aliceId = await userIdOf(ALICE);
		const bobId = await userIdOf(BOB);

		const res = await patchTask(await server.login(ALICE), task.id, { title: 'Neuer Titel' });
		assert.equal(res.status, 200, 'PATCH ohne userId muss weiterhin 200 liefern');

		const oracle = await Task.findByPk(task.id);
		assert.ok(oracle);
		assert.equal(oracle.userId, aliceId, 'AK1: ohne userId bleibt Alice Eigentümerin');
		assert.equal(oracle.title, 'Neuer Titel', 'Feldänderungen funktionieren unverändert weiter');
		assert.notEqual(oracle.userId, bobId);
	});

	it('userId ohne Ganzzahl → 400; ohne gemeinsame Gruppe → 403 ohne Teil-Änderung (AK2)', async () => {
		await seedSharedGroup();
		const task = await seedAliceTask();
		const aliceCookie = await server.login(ALICE);
		const carolId = await userIdOf(CAROL);

		const badType = await patchTask(aliceCookie, task.id, { userId: 'bob' });
		assert.equal(badType.status, 400, 'AK2: nicht-ganzzahliges userId muss 400 liefern');

		const foreign = await patchTask(aliceCookie, task.id, { userId: carolId, title: 'Unerlaubte Änderung' });
		assert.equal(foreign.status, 403, 'AK2: Empfänger ohne gemeinsame Gruppe muss 403 liefern');

		const oracle = await Task.findByPk(task.id);
		assert.ok(oracle);
		assert.equal(oracle.userId, await userIdOf(ALICE), 'AK2: Eigentümer unverändert');
		assert.equal(oracle.title, 'Übergabe-Kandidat', 'AK2: keine Teil-Änderung — Titel bleibt alt');
	});

	it('Übergabe an Bob: Aufgabe in Bobs Liste, Erstellerin = Alice, „Für:"-Kennzeichen (AK4)', async () => {
		await seedSharedGroup();
		const task = await seedAliceTask();
		const aliceId = await userIdOf(ALICE);
		const bobId = await userIdOf(BOB);
		const aliceCookie = await server.login(ALICE);

		const res = await patchTask(aliceCookie, task.id, { userId: bobId });
		assert.equal(res.status, 200, 'Übergabe an Gruppenmitglied muss 200 liefern');

		// Empfänger-Sicht: eigene Aufgabe, kein Kennzeichen, Erstellerin = Alice.
		const bobTasks = await listTasks(await server.login(BOB));
		const handedOver = bobTasks.find((entry) => entry.id === task.id);
		assert.ok(handedOver, 'AK4: die übergebene Aufgabe muss in GET /tasks von Bob auftauchen');
		assert.equal(handedOver.userId, bobId, 'AK4: Bob ist neuer Eigentümer');
		assert.equal(handedOver.createdById, aliceId, 'AK4: die Übergebende steht als Erstellerin');
		assert.equal(handedOver.forUserId, null, 'AK4: Bob bekommt kein „Für:"-Kennzeichen für die eigene Aufgabe');

		// Bisherige Eigentümerin: sieht die Aufgabe über den Ersteller-Zweig mit Kennzeichen.
		const aliceTasks = await listTasks(aliceCookie);
		const asCreator = aliceTasks.find((entry) => entry.id === task.id);
		assert.ok(asCreator, 'AK4: Alice sieht die übergebene Aufgabe weiterhin (Ersteller-Zweig)');
		assert.equal(asCreator.forUserId, bobId, 'AK4: „Für:"-Kennzeichen zeigt auf den Empfänger');
		assert.equal(asCreator.forUserName, 'Bob Empfänger', 'AK4: Empfänger-Name wird aufgelöst');
	});

	it('Titel, Beschreibung, Checkliste, Frist und Aufwand bleiben bei der Übergabe unverändert (AK5)', async () => {
		await seedSharedGroup();
		const task = await seedAliceTask();
		const before = await Task.findByPk(task.id);

		const res = await patchTask(await server.login(ALICE), task.id, { userId: await userIdOf(BOB) });
		assert.equal(res.status, 200);

		const after = await Task.findByPk(task.id);
		assert.ok(before && after, 'Oracle: Task muss existieren');
		assert.equal(after.title, before.title, 'AK5: Titel unverändert');
		assert.equal(after.description, before.description, 'AK5: Beschreibung unverändert');
		assert.deepEqual(after.checklist, before.checklist, 'AK5: Checkliste unverändert');
		assert.equal(after.deadline?.toISOString(), before.deadline?.toISOString(), 'AK5: Frist unverändert');
		assert.equal(after.estimatedEffort, before.estimatedEffort, 'AK5: Aufwand unverändert');
	});

	it('Säulen-Beiträge zeigen nach der Übergabe auf keine Säule von Alice (AK6, Task-Invariante)', async () => {
		await seedSharedGroup();
		const task = await seedAliceTask();
		const aliceId = await userIdOf(ALICE);

		// Alice-eigene Säulen (per-User, #1249) mit Beiträgen an der Aufgabe; Bob hat KEINE
		// gleichnamige Säule → beide Beiträge müssen verschwinden (verworfen oder übernommen,
		// aber niemals auf Alices Säulen zeigen).
		const pillarA = await Pillar.create({
			name: 'Nur-Alice-Sport',
			description: 'Alice-eigene Säule',
			userId: aliceId,
			weight: 100,
		});
		const pillarB = await Pillar.create({
			name: 'Nur-Alice-Karriere',
			description: 'Alice-eigene Säule',
			userId: aliceId,
			weight: 100,
		});
		await TaskPillar.create({ taskId: task.id, pillarId: pillarA.id, share: 60, confidence: 100 });
		await TaskPillar.create({ taskId: task.id, pillarId: pillarB.id, share: 40, confidence: 100 });

		const res = await patchTask(await server.login(ALICE), task.id, { userId: await userIdOf(BOB) });
		assert.equal(res.status, 200);

		const contributions = await TaskPillar.findAll({ where: { taskId: task.id } });
		const referencedPillars =
			contributions.length === 0
				? []
				: await Pillar.findAll({ where: { id: contributions.map((entry) => entry.pillarId) } });
		assert.ok(
			referencedPillars.every((pillar) => pillar.userId !== aliceId),
			'AK6: nach der Übergabe darf kein Beitrag auf eine Säule der bisherigen Eigentümerin zeigen',
		);
	});

	it('Abhängigkeit zu einer für Bob unsichtbaren Aufgabe → 4xx mit Rollback, keine halbe Übergabe (AK7)', async () => {
		await seedSharedGroup();
		const task = await seedAliceTask();
		const aliceId = await userIdOf(ALICE);

		// Alices Vorgänger-Aufgabe: Bob ist weder Eigentümer noch Ersteller → für ihn unsichtbar
		// (Lese-Scope: userId ODER createdById mit aktueller Gruppenmitgliedschaft).
		const prerequisite = await Task.create({
			title: 'Alices private Vorgänger',
			status: 'Open',
			priority: 3,
			estimatedEffort: 1,
			userId: aliceId,
		});
		await Dependency.create({ dependentTaskId: task.id, dependingTaskId: prerequisite.id, weight: 1 });

		const res = await patchTask(await server.login(ALICE), task.id, { userId: await userIdOf(BOB) });
		assert.ok(res.status >= 400 && res.status < 500, `AK7: Abhängigkeitskonflikt muss 4xx sein (war ${res.status})`);
		const message = (await res.json()) as { message?: string };
		assert.ok(
			typeof message.message === 'string' && message.message.length > 0,
			'AK7: die Ablehnung braucht eine verständliche Meldung',
		);

		const oracle = await Task.findByPk(task.id);
		assert.ok(oracle);
		assert.equal(oracle.userId, aliceId, 'AK7: kompletter Rollback — Aufgabe bleibt bei Alice');
		const edges = await Dependency.findAll({ where: { dependentTaskId: task.id } });
		assert.equal(edges.length, 1, 'AK7: Dependency-Kante bleibt erhalten (nichts halb übergeben)');
	});
});
