import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Series, Task, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #2515 — `GET /forest` hebt den Root-Fetch auf denselben Lese-Scope wie die
 * Aufgabenliste (`taskReadScope`): eigene Aufgaben + als Ersteller abgegebene Aufgaben an geteilte
 * Nutzer + unclaimte Gruppen-Aufgaben eigener Gruppen, jeweils an die AKTUELLE Mitgliedschaft
 * gebunden. Vertrag: docs/spec/issue-2515.md, TF1/TF2 für AK1–AK4 (AK5 läuft als E2E).
 *
 * Rollen wie tasks-created-by.test.ts: Alice (Erstellerin), Bob (Empfänger), Carol (Drittkonto
 * ohne gemeinsame Gruppe). Gruppe und Aufgaben werden direkt am Modell geseedet — SUT ist
 * ausschließlich `GET /forest`; der `/tasks`-Halbteil von AK4 ist durch
 * tasks-created-by.test.ts abgedeckt (dedup).
 *
 * Rot, bis `GET /forest` Übergabe-/Gruppen-Aufgaben entsprechend dem Lese-Scope liefert.
 * KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice-forest@example.com,bob-forest@example.com,carol-forest@example.com';
applyTestAuthEnv('forest-read-scope-test');

const ALICE = 'alice-forest@example.com';
const BOB = 'bob-forest@example.com';
const CAROL = 'carol-forest@example.com';

let server: TestServer;

/** User-ID zum Konto nachsehen (Modell-Zugriff nur fürs Seeding/Orakel, nie fürs SUT). */
const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Lese-Scope des Aufgabenwalds (#2515)', () => {
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
	 * Seedet Alice/Bob/Carol (Test-Login legt die Konten an) und eine Zwei-Personen-Gruppe
	 * (Alice admin, Bob member) — Carol teilt mit niemandem eine Gruppe.
	 */
	const seedSharedGroup = async (): Promise<{ groupId: number }> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(CAROL, { displayName: 'Carol Dritte' });
		const group = await Group.create({ name: 'Forest-Spec-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
		return { groupId: group.id };
	};

	/** Seedet eine offene, nicht archivierte Aufgabe direkt am Modell (SUT ist der Lese-Scope). */
	const seedTask = async (data: {
		title: string;
		userId?: number | null;
		createdById?: number | null;
		groupId?: number | null;
		seriesId?: number | null;
	}): Promise<Task> => Task.create({ status: 'Open', archivedAt: null, ...data });

	const listForest = async (cookie: string): Promise<{ id: number; title: string }[]> => {
		const res = await fetch(`${server.baseUrl}/forest`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /forest muss 200 liefern');
		return (await res.json()) as { id: number; title: string }[];
	};

	it('Übergabe-Aufgabe im Wald des Erstellers, nach Gruppenaustritt entfernt, Dritte sieht nichts (AK2/AK3/AK4)', async () => {
		const { groupId } = await seedSharedGroup();
		const aliceId = await userIdOf(ALICE);
		const bobId = await userIdOf(BOB);
		await seedTask({ title: 'Übergebene Aufgabe', userId: bobId, createdById: aliceId });
		// Serien-Instanz mit Einzel-Repräsentant: die Auswahlregel darf sie nicht wegfiltern.
		// Test-Pflege (#2515): seriesId trägt eine FK-Constraint (Series.hasMany) — daher Series-Row
		// anlegen (Muster tree.test.ts), die Spec-Notiz „ohne Series-Row seedbar" war falsch.
		const series = await Series.create({
			title: 'Forest-Serie',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date(),
		});
		await seedTask({ title: 'Serien-Instanz', userId: bobId, createdById: aliceId, seriesId: series.id });
		await seedTask({ title: 'Gruppen-Aufgabe', userId: null, groupId, createdById: aliceId });

		const forest = await listForest(await server.login(ALICE));
		assert.ok(
			forest.some((node) => node.title === 'Übergebene Aufgabe'),
			'AK2: Übergabe-Aufgabe muss im /forest des Erstellers liegen',
		);
		assert.ok(
			forest.some((node) => node.title === 'Serien-Instanz'),
			'Serien-Instanz muss als Repräsentant sichtbar bleiben',
		);
		assert.ok(
			forest.some((node) => node.title === 'Gruppen-Aufgabe'),
			'AK1: unclaimte Gruppen-Aufgabe muss im /forest des Erstellers liegen',
		);

		// AK3: Gruppenaustritt entzieht die Sicht — gleiche aktive-Mitgliedschafts-Basis wie die Liste.
		await GroupMember.destroy({ where: { groupId, userId: aliceId } });
		const afterLeave = await listForest(await server.login(ALICE));
		assert.ok(
			!afterLeave.some((node) => node.title === 'Übergebene Aufgabe'),
			'AK3: Übergabe-Aufgabe muss nach dem Gruppenaustritt verschwinden',
		);
		assert.ok(
			!afterLeave.some((node) => node.title === 'Gruppen-Aufgabe'),
			'AK3: unclaimte Gruppen-Aufgabe muss nach dem Austritt verschwinden',
		);
		assert.ok(
			!afterLeave.some((node) => node.title === 'Serien-Instanz'),
			'AK3: auch die Serien-Instanz verschwindet mit der Mitgliedschaft',
		);

		// AK4: Drittkonto ohne gemeinsame Gruppe sieht nichts davon (der /tasks-Halbteil läuft in
		// tasks-created-by.test.ts — hier nur der /forest-Halbteil).
		const carolForest = await listForest(await server.login(CAROL));
		assert.ok(
			!carolForest.some((node) => ['Übergebene Aufgabe', 'Serien-Instanz', 'Gruppen-Aufgabe'].includes(node.title)),
			'AK4: Dritte ohne gemeinsame Gruppe darf die Aufgaben nicht sehen',
		);
	});

	it('Unclaimte Gruppen-Aufgabe im Wald des anlegenden Mitglieds (AK1)', async () => {
		const { groupId } = await seedSharedGroup();
		await seedTask({ title: 'Gruppen-Aufgabe solo', userId: null, groupId, createdById: await userIdOf(ALICE) });

		const forest = await listForest(await server.login(ALICE));
		assert.ok(
			forest.some((node) => node.title === 'Gruppen-Aufgabe solo'),
			'AK1: unclaimte Gruppen-Aufgabe muss im /forest des anlegenden Mitglieds liegen',
		);

		const carolForest = await listForest(await server.login(CAROL));
		assert.ok(
			!carolForest.some((node) => node.title === 'Gruppen-Aufgabe solo'),
			'AK4: Dritte ohne gemeinsame Gruppe darf die Gruppen-Aufgabe nicht sehen',
		);
	});
});
