import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Task, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1213 — Aufgabe für ein Gruppenmitglied anlegen
 * (Vertrag: docs/spec/issue-1213.md, TF1–TF6 für AK1–AK6).
 *
 * Rollen: Alice (Ersteller, Gruppen-Admin), Bob (Empfänger, Gruppen-Mitglied),
 * Carol (Drittkonto ohne gemeinsame Gruppe). Die Gruppe wird direkt am Modell geseedet —
 * die Gruppen-API selbst ist über #1211/#1212 abgedeckt (dedup, groups*.test.ts).
 *
 * Rot, bis POST /tasks das optionale `userId` auswertet und das Task-DTO `createdById`,
 * `createdByName`, `forUserId` und `forUserName` liefert. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('tasks-created-by-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

/** Erwartete Task-DTO-Felder gemäß Spec #1213 (in der Implementierung nullable hinzuzufügen). */
interface CreatedByTaskDto {
	id: number;
	title: string;
	createdById?: number | null;
	createdByName?: string | null;
	forUserId?: number | null;
	forUserName?: string | null;
}

/** User-ID zum Konto nachsehen (Modell-Zugriff nur fürs Seeding/Orakel, nie fürs SUT). */
const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Aufgabe für ein Gruppenmitglied (#1213)', () => {
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
	 * Seedet Alice/Bob/Carol (Test-Login legt die Konten an, inkl. Anzeigenamen) und eine
	 * Zwei-Personen-Gruppe (Alice admin, Bob member) — Carol teilt mit niemandem eine Gruppe.
	 */
	const seedSharedGroup = async (): Promise<void> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(CAROL, { displayName: 'Carol Dritte' });
		const group = await Group.create({ name: 'Spec-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
	};

	const postTask = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const listTasks = async (cookie: string): Promise<CreatedByTaskDto[]> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /tasks muss 200 liefern');
		return (await res.json()) as CreatedByTaskDto[];
	};

	// ── AK1: ohne `userId` wie bisher ────────────────────────────────────────────────

	it('POST ohne userId gehört dem Aufrufer: createdById = eigenes Konto, kein Empfänger (AK1)', async () => {
		await seedSharedGroup();
		const aliceCookie = await server.login(ALICE);

		const res = await postTask(aliceCookie, { title: 'Ganz normale Aufgabe' });
		assert.equal(res.status, 201, 'POST ohne userId muss weiterhin 201 liefern');
		const dto = (await res.json()) as CreatedByTaskDto;

		assert.equal(dto.createdById, await userIdOf(ALICE), 'createdById ist das eigene Konto');
		assert.equal(dto.createdByName, 'Alice Erstellerin', 'createdByName ist der eigene Anzeigename');
		assert.equal(dto.forUserId, null, 'forUserId bleibt null (nicht für ein anderes Mitglied)');
		assert.equal(dto.forUserName, null, 'forUserName bleibt null');
	});

	// ── AK2: fremde userId ohne gemeinsame Gruppe → 403, kein Datensatz ──────────────

	it('POST mit userId ohne gemeinsame Gruppe → 403 und kein Datensatz (AK2)', async () => {
		await seedSharedGroup();
		const aliceCookie = await server.login(ALICE);
		const carolId = await userIdOf(CAROL);

		const res = await postTask(aliceCookie, { title: 'Verbotene Aufgabe', userId: carolId });
		assert.equal(res.status, 403, 'ohne gemeinsame Gruppe muss 403 kommen (nicht 201)');

		const carolList = await listTasks(await server.login(CAROL));
		assert.ok(
			!carolList.some((task) => task.title === 'Verbotene Aufgabe'),
			'beim Empfänger darf kein Datensatz entstanden sein',
		);
		const aliceList = await listTasks(aliceCookie);
		assert.ok(
			!aliceList.some((task) => task.title === 'Verbotene Aufgabe'),
			'auch beim Aufrufer darf kein Datensatz entstanden sein',
		);
	});

	// ── AK3 + AK4: fremde Aufgabe gehört dem Empfänger, Ersteller ist Creator ────────

	it('POST mit fremder userId: Aufgabe erscheint beim Empfänger mit Ersteller-Namen (AK3, AK4)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);

		const res = await postTask(await server.login(ALICE), { title: 'Bobs neue Aufgabe', userId: bobId });
		assert.equal(res.status, 201, 'POST mit gemeinsamer Gruppen-userId muss 201 liefern');

		const bobList = await listTasks(await server.login(BOB));
		const task = bobList.find((candidate) => candidate.title === 'Bobs neue Aufgabe');
		assert.ok(task, 'Aufgabe muss in der Empfängerliste stehen (Lese-Scope um createdById)');

		assert.equal(task.createdById, await userIdOf(ALICE), 'createdById ist der Ersteller, nicht der Empfänger');
		assert.equal(task.createdByName, 'Alice Erstellerin', 'AK4: Anzeigename des Erstellers');
		assert.equal(task.forUserId, null, 'für den Empfänger selbst gibt es kein Für-Kennzeichen');
	});

	it('POST mit userId = eigene ID verhält sich wie ohne das Feld (AK3, Selbst-Empfänger)', async () => {
		await seedSharedGroup();
		const aliceId = await userIdOf(ALICE);

		const res = await postTask(await server.login(ALICE), { title: 'Für mich selbst', userId: aliceId });
		assert.equal(res.status, 201);
		const dto = (await res.json()) as CreatedByTaskDto;

		assert.equal(dto.createdById, aliceId, 'beide Felder gleich: Ersteller ist Empfänger');
		assert.equal(dto.forUserId, null, 'kein Für-Kennzeichen bei Selbst-Empfänger');
	});

	// ── AK5: Ersteller lesend + Kennzeichen, schreibend 404; Drittkonto unsichtbar ──

	it('Ersteller sieht die Aufgabe mit Für-Kennzeichen, PATCH/DELETE → 404; Drittkonto → unsichtbar (AK5)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const aliceCookie = await server.login(ALICE);

		const res = await postTask(aliceCookie, { title: 'Übergabe an Bob', userId: bobId });
		assert.equal(res.status, 201);
		const taskId = ((await res.json()) as CreatedByTaskDto).id;

		// Ersteller-Liste: enthalten, mit Empfänger-Kennzeichen (UI „Für: Bob Empfänger“).
		const aliceList = await listTasks(aliceCookie);
		const task = aliceList.find((candidate) => candidate.id === taskId);
		assert.ok(task, 'Ersteller muss die Aufgabe lesend sehen');
		assert.equal(task.forUserId, bobId, 'Für-Kennzeichen nennt das Empfänger-Konto');
		assert.equal(task.forUserName, 'Bob Empfänger', 'Für-Kennzeichen nennt den Empfänger-Namen');

		// Schreibzugriff des Erstellers: 404 (Schreib-Scope bleibt ownerScope).
		const patchRes = await fetch(`${server.baseUrl}/tasks/${taskId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
			body: JSON.stringify({ title: 'Unerlaubter Umbau' }),
		});
		assert.equal(patchRes.status, 404, 'PATCH des Erstellers muss 404 liefern');

		const deleteRes = await fetch(`${server.baseUrl}/tasks/${taskId}`, {
			method: 'DELETE',
			headers: { Cookie: aliceCookie },
		});
		assert.equal(deleteRes.status, 404, 'DELETE des Erstellers muss 404 liefern');

		// Drittkonto ohne gemeinsame Gruppe: weder in der Liste noch per :id auffindbar.
		const carolList = await listTasks(await server.login(CAROL));
		assert.ok(!carolList.some((candidate) => candidate.id === taskId), 'Drittkonto sieht die Aufgabe nicht');
		const detailRes = await fetch(`${server.baseUrl}/tasks/${taskId}`, {
			headers: { Cookie: await server.login(CAROL) },
		});
		assert.equal(detailRes.status, 404, 'GET /tasks/:id des Drittkontos muss 404 liefern');
	});

	// ── AK6: Bestandsaufgaben ohne createdById bleiben unverändert ───────────────────

	it('Bestandsaufgabe ohne createdById bleibt lesbar und patchbar (AK6)', async () => {
		await seedSharedGroup();
		const bobCookie = await server.login(BOB);

		// Altbestand direkt am Modell: kein createdById gesetzt (Spalte fehlt noch bzw. NULL).
		const legacy = await Task.create({ title: 'Altbestand', userId: await userIdOf(BOB) });

		const list = await listTasks(bobCookie);
		const task = list.find((candidate) => candidate.id === legacy.id);
		assert.ok(task, 'Bestandsaufgabe bleibt in der Liste');
		// Ohne `?? null`: Die Felder MÜSSEN vorhanden und null sein (missing field = rot).
		assert.equal(task.createdById, null, 'createdById bleibt null');
		assert.equal(task.createdByName, null, 'createdByName bleibt null');
		assert.equal(task.forUserId, null, 'forUserId bleibt null');

		const patchRes = await fetch(`${server.baseUrl}/tasks/${legacy.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
			body: JSON.stringify({ title: 'Altbestand editiert' }),
		});
		assert.equal(patchRes.status, 200, 'Owner darf die Bestandsaufgabe weiter patchen (kein Über-Scoping)');
	});
});

/**
 * Rote Spec-Tests für #1250 — Erststeller-Lesezugriff endet mit der Gruppenmitgliedschaft
 * (Vertrag: docs/spec/issue-1250.md, TF1–TF4 + TF6 für AK1–AK4, AK6, AK7).
 *
 * Erwartung: der `createdById`-Zweig von `taskReadScope` wird an die AKTUELLE gemeinsame
 * Gruppenmitgliedschaft gebunden. Rot, solange der Zweig `createdById: requesterId` bedingungslos
 * gilt (Aufgabe bleibt nach Austritt/Gruppenlöschung sichtbar). KEIN Produktivcode.
 */
describe('Ersteller-Lesezugriff endet mit der Gruppenmitgliedschaft (#1250, Tasks)', () => {
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
	 * Seedet Alice/Bob/Carol und eine Gruppe mit Alice UND Bob als Admin — nur so kann Alice
	 * self-leave testen, ohne am letzten-Admin-Schutz (409) zu scheitern. Liefert die Gruppen-ID.
	 */
	const seedGroupWithTwoAdmins = async (): Promise<number> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(CAROL, { displayName: 'Carol Dritte' });
		const group = await Group.create({ name: 'Spec-Gruppe', description: null });
		const aliceId = await userIdOf(ALICE);
		const bobId = await userIdOf(BOB);
		await GroupMember.create({ groupId: group.id, userId: aliceId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: bobId, role: 'admin', joinedAt: new Date() });
		return group.id;
	};

	/** Alice legt eine Aufgabe für Bob an; liefert die Task-ID. */
	const createTaskForBob = async (): Promise<number> => {
		const res = await postTaskFor1250(await server.login(ALICE), {
			title: 'Bobs Aufgabe aus der Gruppe',
			userId: await userIdOf(BOB),
		});
		assert.equal(res.status, 201, 'Setup: Aufgabe für Gruppenmitglied muss anlegbar sein');
		return ((await res.json()) as CreatedByTaskDto).id;
	};

	const postTaskFor1250 = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const aliceSees = async (taskId: number): Promise<boolean> => {
		const list = await listTasksFor1250(await server.login(ALICE));
		return list.some((task) => task.id === taskId);
	};

	const listTasksFor1250 = async (cookie: string): Promise<CreatedByTaskDto[]> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /tasks muss 200 liefern');
		return (await res.json()) as CreatedByTaskDto[];
	};

	const leaveGroup = async (cookie: string, groupId: number, targetUserId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/members/${targetUserId}`, {
			method: 'DELETE',
			headers: { Cookie: cookie },
		});

	// ── AK1: Sichtbarkeit folgt der aktuellen Mitgliedschaft ──────────────────────────

	it('AK1/TF1: Aufgabe verschwindet aus Alices Liste nach self-leave und kommt mit Wiedereintritt zurück', async () => {
		const groupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const taskId = await createTaskForBob();

		// AK7-Deckel: solange die Gruppe geteilt wird, bleibt der SCHREIB-/Detail-Scope owner-only.
		const detailRes = await fetch(`${server.baseUrl}/tasks/${taskId}`, {
			headers: { Cookie: await server.login(ALICE) },
		});
		assert.equal(detailRes.status, 404, 'AK7: GET /tasks/:id bleibt für die Erstellerin 404');

		assert.ok(await aliceSees(taskId), 'mit gemeinsamer Gruppe sieht Alice die Aufgabe');

		const leaveRes = await leaveGroup(await server.login(ALICE), groupId, aliceId);
		assert.equal(leaveRes.status, 204, 'Setup: self-leave muss 204 liefern (zwei Admins geseedet)');
		assert.ok(!(await aliceSees(taskId)), 'nach Austritt darf Alice die Aufgabe nicht mehr sehen');

		// Wiedereintritt (Mitgliedschaft ist Eingabe, nicht SUT) → wieder sichtbar.
		await GroupMember.create({ groupId, userId: aliceId, role: 'member', joinedAt: new Date() });
		assert.ok(await aliceSees(taskId), 'nach Wiedereintritt sieht Alice die Aufgabe wieder');
	});

	it('AK1/TF1: Admin-Entfernung von Alice aus der Gruppe beendet den Lesezugriff genauso', async () => {
		const groupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const taskId = await createTaskForBob();
		assert.ok(await aliceSees(taskId), 'mit gemeinsamer Gruppe sieht Alice die Aufgabe');

		const removeRes = await leaveGroup(await server.login(BOB), groupId, aliceId);
		assert.equal(removeRes.status, 204, 'Setup: Admin-Entfernung muss 204 liefern');
		assert.ok(!(await aliceSees(taskId)), 'nach Admin-Entfernung darf Alice die Aufgabe nicht mehr sehen');
	});

	// ── AK2: Gruppenlöschung ─────────────────────────────────────────────────────────

	it('AK2/TF2: nach Löschen der gemeinsamen Gruppe fehlt die Aufgabe in Alices Liste', async () => {
		const groupId = await seedGroupWithTwoAdmins();
		const taskId = await createTaskForBob();
		assert.ok(await aliceSees(taskId), 'mit gemeinsamer Gruppe sieht Alice die Aufgabe');

		const deleteRes = await fetch(`${server.baseUrl}/groups/${groupId}`, {
			method: 'DELETE',
			headers: { Cookie: await server.login(ALICE) },
		});
		assert.equal(deleteRes.status, 204, 'Setup: Gruppenlöschung als Admin muss 204 liefern');
		assert.ok(!(await aliceSees(taskId)), 'nach Gruppenlöschung darf Alice die Aufgabe nicht mehr sehen');
	});

	// ── AK3: Eigentümer-Sicht unberührt ──────────────────────────────────────────────

	it('AK3/TF3: Bob sieht die Aufgabe mit Ersteller-Kennzeichen vor und nach Alices Austritt', async () => {
		const groupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const taskId = await createTaskForBob();

		const checkBobsView = async (): Promise<void> => {
			const bobList = await listTasksFor1250(await server.login(BOB));
			const task = bobList.find((candidate) => candidate.id === taskId);
			assert.ok(task, 'Bob (Eigentümer) sieht die Aufgabe immer');
			assert.equal(task.createdById, aliceId, 'createdById bleibt auf der Erstellerin (kein Nullen)');
			assert.equal(task.createdByName, 'Alice Erstellerin', 'createdByName bleibt die Erstellerin');
		};
		await checkBobsView();

		const leaveRes = await leaveGroup(await server.login(ALICE), groupId, aliceId);
		assert.equal(leaveRes.status, 204, 'Setup: self-leave muss 204 liefern');
		await checkBobsView();
	});

	// ── AK4: mehrere gemeinsame Gruppen ──────────────────────────────────────────────

	it('AK4/TF4: eine verbleibende gemeinsame Gruppe genügt für den Lesezugriff', async () => {
		const firstGroupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const secondGroup = await Group.create({ name: 'Zweite Gruppe', description: null });
		await GroupMember.create({ groupId: secondGroup.id, userId: aliceId, role: 'member', joinedAt: new Date() });
		await GroupMember.create({
			groupId: secondGroup.id,
			userId: await userIdOf(BOB),
			role: 'member',
			joinedAt: new Date(),
		});
		const taskId = await createTaskForBob();
		assert.ok(await aliceSees(taskId), 'mit zwei gemeinsamen Gruppen sieht Alice die Aufgabe');

		const leaveRes = await leaveGroup(await server.login(ALICE), firstGroupId, aliceId);
		assert.equal(leaveRes.status, 204, 'Setup: Austritt aus der ersten Gruppe muss 204 liefern');
		assert.ok(await aliceSees(taskId), 'AK4: eine verbleibende gemeinsame Gruppe genügt');
	});

	// ── AK6: Bestandsaufgaben laufen weiter über den userId-Zweig ─────────────────────

	it('AK6/TF6: Bestandsaufgabe ohne createdById bleibt gruppenunabhängig Eigentümer-only', async () => {
		await seedGroupWithTwoAdmins();
		const legacy = await Task.create({ title: 'Altbestand 1250', userId: await userIdOf(BOB) });

		const bobList = await listTasksFor1250(await server.login(BOB));
		assert.ok(
			bobList.some((task) => task.id === legacy.id),
			'Eigentümer sieht die Bestandsaufgabe',
		);
		assert.ok(!(await aliceSees(legacy.id)), 'trotz gemeinsamer Gruppe: kein createdById-Zweig für Bestand');
	});
});
