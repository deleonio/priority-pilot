import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Pillar, Series, Task, TaskPillar, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1249 — Säulen-Beiträge müssen gegen das Konto geprüft werden, dem die
 * Aufgabe/Serie gehört (Empfänger vor Ersteller); Prüfung ohne Kontobezug ist unzulässig.
 * Vertrag: docs/spec/issue-1249.md (AK1–AK4, AK6).
 *
 * Rollen: Alice (Erstellerin, Gruppen-Admin), Bob (Empänger, Mitglied), Carol (Drittkonto
 * ohne Gruppe). Je Konto eine gleich benannte Säule (Unique-Index `pillars_name_user_id`
 * erlaubt gleiche Namen über Konten) — Seed-Muster groups-tasks.api.test.ts (#1223).
 *
 * Rot, bis die Routen gegen den Eigentümer prüfen. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('pillar-ownership-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Säulen-Eigentum bei Task-/Series-Beiträgen (#1249)', () => {
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

	/** Alice, Bob, Carol + geteilte Gruppe Alice↔Bob; je Konto eine gleichnamige Säule „Körper“. */
	const seed = async (): Promise<{
		aliceId: number;
		bobId: number;
		carolId: number;
		alicePillar: number;
		bobPillar: number;
		carolPillar: number;
	}> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empänger' });
		await server.login(CAROL, { displayName: 'Carol Dritt' });
		const [aliceId, bobId, carolId] = await Promise.all([ALICE, BOB, CAROL].map(userIdOf));
		const group = await Group.create({ name: 'Spec-Gruppe #1249', description: null });
		await GroupMember.create({ groupId: group.id, userId: aliceId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: bobId, role: 'member', joinedAt: new Date() });
		// Gleicher Name, verschiedene userIds → verschiedene Zeilen/Ids (Unique-Index erlaubt das).
		const [alicePillar, bobPillar, carolPillar] = await Promise.all(
			[aliceId, bobId, carolId].map((ownerId) => Pillar.create({ name: 'Körper', weight: 20, userId: ownerId })),
		);
		return {
			aliceId,
			bobId,
			carolId,
			alicePillar: alicePillar.id,
			bobPillar: bobPillar.id,
			carolPillar: carolPillar.id,
		};
	};

	const postTask = (cookie: string | undefined, body: Record<string, unknown>) =>
		fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body),
		});

	const postSeries = (cookie: string | undefined, body: Record<string, unknown>) =>
		fetch(`${server.baseUrl}/series`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body),
		});

	const patchSeries = (cookie: string | undefined, id: number, body: Record<string, unknown>) =>
		fetch(`${server.baseUrl}/series/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body),
		});

	it('POST /tasks mit Empfänger und Säule des Erstellers → 400, kein Task angelegt (AK1)', async () => {
		const ids = await seed();
		const res = await postTask(await server.login(ALICE), {
			title: 'Fremde Säule',
			userId: ids.bobId,
			pillars: [{ pillarId: ids.alicePillar, share: 100 }],
		});
		assert.equal(res.status, 400, 'Säule des Erstellers gehört nicht zum Empfänger-Konto → 400');
		assert.equal(await Task.count({ where: { title: 'Fremde Säule' } }), 0, 'AK1: kein Task wird angelegt');
		assert.equal(await TaskPillar.count({ where: { pillarId: ids.alicePillar } }), 0, 'AK1: keine Verknüpfung');
	});

	it('POST /tasks mit Empfänger und Säule des Empfängers → 201, verknüpft genau diese Säule (AK2, AK6)', async () => {
		const ids = await seed();
		const res = await postTask(await server.login(ALICE), {
			title: 'Bobs Aufgabe',
			userId: ids.bobId,
			pillars: [{ pillarId: ids.bobPillar, share: 100 }],
		});
		assert.equal(res.status, 201, 'Säule des Empfänger-Kontos ist zulässig → 201');
		const task = await Task.findOne({ where: { title: 'Bobs Aufgabe' } });
		assert.ok(task, 'Task muss existieren');
		assert.equal(task.userId, ids.bobId, 'Task gehört dem Empfänger');
		const links = await TaskPillar.findAll({ where: { taskId: task.id } });
		assert.deepEqual(
			links.map((link) => link.pillarId),
			[ids.bobPillar],
			'AK6: verknüpft ist die Säule-Id des EMPFÄNGERS, nicht die gleichnamige des Erstellers',
		);
		assert.notEqual(links[0]?.pillarId, ids.alicePillar, 'AK6: nicht die Ersteller-Säule trotz gleichem Namen');
	});

	it('POST /series mit Säule, die weder Aufrufer noch Empfänger gehört → 400 (AK3)', async () => {
		const ids = await seed();
		const res = await postSeries(await server.login(ALICE), {
			title: 'Serie mit Carol-Säule',
			rhythm: 'weekly',
			priority: 4,
			estimatedEffort: 0.5,
			startDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
			userId: ids.bobId,
			pillars: [{ pillarId: ids.carolPillar, share: 100 }],
		});
		assert.equal(res.status, 400, 'Drittkonto-Säule gehört weder Aufrufer noch Empfänger → 400 (Status quo: 201)');
		assert.equal(await Series.count({ where: { title: 'Serie mit Carol-Säule' } }), 0, 'AK3: keine Serie angelegt');
	});

	it('PATCH /series/:id prüft Säulen gegen den Eigentümer der Serie (AK4)', async () => {
		const ids = await seed();
		const series = await Series.create({
			title: 'Bobs Serie',
			rhythm: 'weekly',
			startDate: new Date(Date.now() + 86_400_000),
			active: true,
			userId: ids.bobId,
		});
		// Bob (Eigentümer) patchet seine Serie mit Carols Säule → 400; aktuelle Prüfung ohne
		// Kontobezug lässt die global existierende Säule durch (Status quo: 200).
		const res = await patchSeries(await server.login(BOB), series.id, {
			pillars: [{ pillarId: ids.carolPillar, share: 100 }],
		});
		assert.equal(res.status, 400, 'Säule eines Drittkontos ist für den Serien-Eigentümer unzulässig → 400');
	});
});
