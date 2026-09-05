import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Task, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1223 — Gruppenübersicht der füreinander angelegten Aufgaben
 * (Vertrag: docs/spec/issue-1223.md, TF1/TF2 für AK1–AK6).
 *
 * Rollen: Alice (Gruppen-Admin, legt für andere an), Bob und Anna (Mitglieder),
 * Carol (Drittkonto ohne gemeinsame Gruppe). Geseedet wird direkt an den Modellen —
 * Muster tasks-created-by.test.ts (#1213); die Gruppen-CRUD ist über #1211 abgedeckt (dedup).
 *
 * Rot, bis GET /groups/:id/tasks existiert (aktuell 404). KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,anna@example.com,carol@example.com';
applyTestAuthEnv('groups-tasks-api-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const ANNA = 'anna@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

/** Eintrag der Gruppen-Task-Liste gemäß Spec #1223 (exakt dieser Feldsatz, AK4). */
interface GroupTaskDto {
	id: number;
	title: string;
	deadline: string | null;
	status: string;
	recipientName: string;
	creatorName: string;
}

/** User-ID zum Konto nachsehen (Modell-Zugriff nur fürs Seeding/Orakel, nie fürs SUT). */
const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Gruppen-Task-Liste „Füreinander angelegt“ (#1223)', () => {
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

	/**
	 * Seedet Alice (Admin), Bob und Anna (Mitglieder) plus Carol ohne Gruppenbezug und legt
	 * die Gruppe an. Anzeigenamen bewusst so gewählt, dass case-insensitive und Byte-Sortierung
	 * auseinanderlaufen (AK6: „anna …“ vor „Bob …“, byte- wäre umgekehrt).
	 */
	const seedGroup = async (): Promise<Group> => {
		await server.login(ALICE, { displayName: 'Alice Admin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(ANNA, { displayName: 'anna mitarbeiterin' });
		await server.login(CAROL, { displayName: 'Carol Fremd' });
		const group = await Group.create({ name: 'Spec-Gruppe #1223', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ANNA), role: 'member', joinedAt: new Date() });
		return group;
	};

	const getGroupTasks = async (cookie: string | undefined, groupId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/tasks`, {
			headers: cookie ? { Cookie: cookie } : {},
		});

	/** Task direkt am Modell seeden (SUT ist der GET-Endpunkt, nicht POST /tasks). */
	const seedTask = async (values: {
		title: string;
		creatorId: number | null;
		receiverId: number;
		status?: 'Open' | 'In process' | 'Done';
		deadline?: Date | null;
	}): Promise<Task> =>
		Task.create({
			title: values.title,
			userId: values.receiverId,
			...(values.creatorId === null ? {} : { createdById: values.creatorId }),
			status: values.status ?? 'Open',
			...(values.deadline === undefined ? {} : { deadline: values.deadline }),
		});

	it('liefert genau die füreinander angelegten offenen Aufgaben der Gruppe mit reduziertem Feldsatz (AK1, AK2, AK3, AK4)', async () => {
		const group = await seedGroup();
		const [aliceId, bobId, annaId, carolId] = await Promise.all([ALICE, BOB, ANNA, CAROL].map(userIdOf));

		const contained = await seedTask({
			title: 'Übergabe an Bob',
			creatorId: aliceId,
			receiverId: bobId,
			deadline: new Date('2026-10-02T12:00:00Z'),
		});
		const containedTwo = await seedTask({ title: 'Hilfe für Anna', creatorId: bobId, receiverId: annaId });

		// Ausschlusssfälle (AK2/AK3 + Nicht-Mitglied-Ersteller + Altbestand ohne Ersteller).
		await seedTask({ title: 'Privat für mich', creatorId: aliceId, receiverId: aliceId });
		await seedTask({ title: 'Erledigte Übergabe', creatorId: aliceId, receiverId: bobId, status: 'Done' });
		await seedTask({ title: 'Fremder legt für Mitglied an', creatorId: carolId, receiverId: bobId });
		await seedTask({ title: 'Altbestand ohne Ersteller', creatorId: null, receiverId: bobId });

		const res = await getGroupTasks(await server.login(ALICE), group.id);
		assert.equal(res.status, 200, 'GET /groups/:id/tasks muss als Mitglied 200 liefern');
		const list = (await res.json()) as GroupTaskDto[];

		assert.deepEqual(
			list.map((entry) => entry.id).sort((a, b) => a - b),
			[contained.id, containedTwo.id].sort((a, b) => a - b),
			'AK1–AK3: genau die zwei füreinander angelegten, offenen Aufgaben — Selbst-Aufgaben, Done, Fremd-Ersteller und Altbestand fehlen (auch für den Admin)',
		);

		// AK4: exakt dieser Feldsatz, Anzeigenamen statt E-Mails, keine Beschreibung/Checkliste.
		const entry = list.find((candidate) => candidate.id === contained.id);
		assert.ok(entry, 'Übergabe-Task muss enthalten sein');
		assert.deepEqual(
			Object.keys(entry).sort(),
			['creatorName', 'deadline', 'id', 'recipientName', 'status', 'title'],
			'AK4: Feldsatz ist genau id, title, deadline, status, recipientName, creatorName',
		);
		assert.equal(entry.recipientName, 'Bob Empfänger', 'AK4: Anzeigename des Empfängers');
		assert.equal(entry.creatorName, 'Alice Admin', 'AK4: Anzeigename des Erstellers');
		const raw = JSON.stringify(list);
		assert.ok(!raw.includes('@'), 'AK4: keine E-Mail-Adressen in der Antwort');
		assert.ok(!raw.includes('description') && !raw.includes('checklist'), 'AK4: weder description noch checklist');
	});

	it('sortiert stabil: Empfänger case-insensitive, dann deadline aufsteigend (ohne zuletzt), dann id (AK6)', async () => {
		const group = await seedGroup();
		const [aliceId, annaId, bobId] = await Promise.all([ALICE, ANNA, BOB].map(userIdOf));

		// Erwartete Reihenfolge: „anna …“ (case-insensitive vor „Bob …“) mit Deadline, dann die
		// deadline-lose anna-Aufgabe; „Bob …“ dahinter — byte-weise wäre „Bob …“ zuerst.
		const annaFirst = await seedTask({
			title: 'Anna A',
			creatorId: aliceId,
			receiverId: annaId,
			deadline: new Date('2026-10-01T09:00:00Z'),
		});
		const annaSecond = await seedTask({
			title: 'Anna B',
			creatorId: aliceId,
			receiverId: annaId,
			deadline: new Date('2026-10-01T09:00:00Z'),
		});
		const annaWithoutDeadline = await seedTask({
			title: 'Anna ohne Fälligkeit',
			creatorId: aliceId,
			receiverId: annaId,
			deadline: null,
		});
		const bobEntry = await seedTask({
			title: 'Bob früh',
			creatorId: aliceId,
			receiverId: bobId,
			deadline: new Date('2026-09-01T09:00:00Z'),
		});
		assert.ok(annaSecond.id > annaFirst.id, 'Setup: Id-Reihenfolge für den Tie-Breaker');

		const res = await getGroupTasks(await server.login(ANNA), group.id);
		assert.equal(res.status, 200, 'GET /groups/:id/tasks muss als Mitglied 200 liefern');
		const list = (await res.json()) as GroupTaskDto[];

		assert.deepEqual(
			list.map((entry) => entry.id),
			[annaFirst.id, annaSecond.id, annaWithoutDeadline.id, bobEntry.id],
			'AK6: Empfänger case-insensitive vor „Bob“, innerhalb deadline aufsteigend mit null zuletzt, Tie per id',
		);
	});

	it('Nichtmitglied erhält 404, unauthentifizierter Request 401 (AK5)', async () => {
		const group = await seedGroup();

		const carolRes = await getGroupTasks(await server.login(CAROL), group.id);
		assert.equal(carolRes.status, 404, 'Konto ohne Membership muss 404 bekommen (keine Existenz-Leckage)');

		const anonRes = await getGroupTasks(undefined, group.id);
		assert.equal(anonRes.status, 401, 'Request ohne Session muss 401 bekommen (globales requireAuth)');
	});
});
