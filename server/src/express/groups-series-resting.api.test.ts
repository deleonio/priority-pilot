import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupInvitation, GroupMember, Series, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1251 — Gruppenlöschung/Austritt räumen Einladungen ab und
 * stillagen Cross-Member-Serien (Vertrag: docs/spec/issue-1251.md, AK1–AK5).
 *
 * Rollen: Alice (Admin/Erstellerin), Bob (Mitglied/Empfänger), Carol (Drittkonto).
 * Rot, bis DELETE /groups/:id und DELETE /groups/:id/members/:userId in
 * server/src/express/routes/groups.ts die Aufräumarbeit mitführen. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('groups-series-resting-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

type ReceivedInvitationDto = { id: number; groupId: number; groupName: string; invitedByName: string };
type SeriesDto = { id: number; title: string; active?: boolean };

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

/** Legt eine Gruppe mit den genannten Mitgliedern direkt am Modell an (Alice admin). */
const seedGroup = async (memberEmails: string[], extraAdminEmails: string[] = []): Promise<number> => {
	const group = await Group.create({ name: 'Spec-Gruppe 1251', description: null });
	await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
	for (const email of memberEmails) {
		await GroupMember.create({
			groupId: group.id,
			userId: await userIdOf(email),
			role: extraAdminEmails.includes(email) ? 'admin' : 'member',
			joinedAt: new Date(),
		});
	}
	return group.id;
};

/** Legt eine fällige aktive Serie für `ownerEmail` an, erstellt von `creatorEmail` (API-Weg #1222). */
const createCrossSeries = async (creatorCookie: string, ownerEmail: string, title: string): Promise<number> => {
	const res = await fetch(`${server.baseUrl}/series`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: creatorCookie },
		body: JSON.stringify({
			title,
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: '2026-01-05T00:00:00.000Z',
			userId: await userIdOf(ownerEmail),
		}),
	});
	assert.equal(res.status, 201, `Setup: Serie "${title}" muss anlegbar sein`);
	return ((await res.json()) as SeriesDto).id;
};

const removeMember = (cookie: string, groupId: number, targetUserId: number): Promise<Response> =>
	fetch(`${server.baseUrl}/groups/${groupId}/members/${targetUserId}`, {
		method: 'DELETE',
		headers: { Cookie: cookie },
	});

const listInvitations = async (cookie: string): Promise<ReceivedInvitationDto[]> => {
	const res = await fetch(`${server.baseUrl}/invitations`, { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'GET /invitations muss 200 liefern');
	return (await res.json()) as ReceivedInvitationDto[];
};

const generateAll = async (cookie: string): Promise<number> => {
	const res = await fetch(`${server.baseUrl}/series/generate-all`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: '{}',
	});
	assert.equal(res.status, 200, 'POST /series/generate-all muss 200 liefern');
	return ((await res.json()) as { created: number }).created;
};

describe('Gruppenauflösung räumt Einladungen ab und stillagt Cross-Member-Serien (#1251)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		await server.login(ALICE, { displayName: 'Alice Admin' });
		await server.login(BOB, { displayName: 'Bob Besitzer' });
		await server.login(CAROL, { displayName: 'Carol Chef' });
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	// ── AK1: DELETE /groups/{id} räumt alle Einladungen der Gruppe ab ─────────────────

	it('nach DELETE /groups/{id} existiert keine group_invitations-Zeile der Gruppe; GET /invitations bleibt sauber (AK1)', async () => {
		const groupId = await seedGroup([BOB]);
		await GroupInvitation.create({
			groupId,
			invitedUserId: await userIdOf(CAROL),
			invitedByUserId: await userIdOf(ALICE),
			status: 'pending',
			createdAt: new Date(),
		});

		const res = await fetch(`${server.baseUrl}/groups/${groupId}`, {
			method: 'DELETE',
			headers: { Cookie: await server.login(ALICE) },
		});
		assert.equal(res.status, 204, 'Setup: Gruppenlöschung als Admin muss 204 liefern');

		assert.equal(
			await GroupInvitation.count({ where: { groupId } }),
			0,
			'AK1: keine group_invitations-Zeile der gelöschten Gruppe (alle Status)',
		);

		const invitations = await listInvitations(await server.login(CAROL));
		assert.ok(
			!invitations.some((invitation) => invitation.groupId === groupId),
			'AK1: Geister-Eintrag mit leerem Namen darf nicht mehr erscheinen',
		);
		// Bob (Mitglied ohne Einladung) bleibt unberührt — reine Gegenprobe auf 200.
		assert.equal((await listInvitations(await server.login(BOB))).length, 0);
	});

	// ── AK2: Entfernung/Selbstaustritt räumt pending-Einladungen des Entfernten ab ────

	it('Admin entfernt Mitglied mit pending-Einladung → GET /invitations ohne Eintrag (AK2)', async () => {
		const groupId = await seedGroup([BOB]);
		const bobId = await userIdOf(BOB);
		// Legacy-Zustand (API erzeugt ihn nicht mehr): Mitglied MIT offener Einladung.
		await GroupInvitation.create({
			groupId,
			invitedUserId: bobId,
			invitedByUserId: await userIdOf(ALICE),
			status: 'pending',
			createdAt: new Date(),
		});

		const res = await removeMember(await server.login(ALICE), groupId, bobId);
		assert.equal(res.status, 204, 'Setup: Admin-Entfernung muss 204 liefern');

		const invitations = await listInvitations(await server.login(BOB));
		assert.ok(
			!invitations.some((invitation) => invitation.groupId === groupId),
			'AK2: offene Einladung der Gruppe darf nach Entfernung nicht mehr erscheinen',
		);
	});

	it('Selbstaustritt mit pending-Einladung → GET /invitations ohne Eintrag (AK2)', async () => {
		// Zwei Admins, damit self-leave nicht am letzten-Admin-409 hängt.
		const groupId = await seedGroup([BOB], [BOB]);
		const bobId = await userIdOf(BOB);
		await GroupInvitation.create({
			groupId,
			invitedUserId: bobId,
			invitedByUserId: await userIdOf(ALICE),
			status: 'pending',
			createdAt: new Date(),
		});

		const res = await removeMember(await server.login(BOB), groupId, bobId);
		assert.equal(res.status, 204, 'Setup: Selbstaustritt muss 204 liefern');

		const invitations = await listInvitations(await server.login(BOB));
		assert.ok(
			!invitations.some((invitation) => invitation.groupId === groupId),
			'AK2: offene Einladung der Gruppe darf nach Selbstaustritt nicht mehr erscheinen',
		);
	});

	// ── AK3: Cross-Member-Serie des Entfernten wird stillgelegt ───────────────────────

	it('Serie für den Entfernten wird active:false; generate-all erzeugt keine Aufgaben mehr (AK3)', async () => {
		const groupId = await seedGroup([BOB]);
		const bobId = await userIdOf(BOB);
		const seriesId = await createCrossSeries(await server.login(ALICE), BOB, 'Bobs Gruppe-Routine');

		const res = await removeMember(await server.login(ALICE), groupId, bobId);
		assert.equal(res.status, 204, 'Setup: Entfernung muss 204 liefern');

		const series = await Series.findByPk(seriesId);
		assert.ok(series, 'Serie existiert weiterhin');
		assert.equal(series.active, false, 'AK3: Serie ist stillgelegt (active:false)');

		const created = await generateAll(await server.login(BOB));
		assert.equal(created, 0, 'AK3: generate-all des Eigentümers erzeugt aus der ruhenden Serie nichts');
	});

	// ── AK4: Bestands-Aufgaben bleiben Eigentum des Empfängers ───────────────────────

	it('vor der Entfernung erzeugte Aufgaben bleiben im Bestand des Empfängers (AK4, Schutz-Guard)', async () => {
		const groupId = await seedGroup([BOB]);
		const bobId = await userIdOf(BOB);
		const seriesId = await createCrossSeries(await server.login(ALICE), BOB, 'Bestands-Routine');

		const createdBefore = await generateAll(await server.login(BOB));
		assert.ok(createdBefore > 0, 'Setup: vor der Entfernung muss die Serie Instanzen erzeugen');

		const res = await removeMember(await server.login(ALICE), groupId, bobId);
		assert.equal(res.status, 204, 'Setup: Entfernung muss 204 liefern');

		const tasksRes = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: await server.login(BOB) } });
		assert.equal(tasksRes.status, 200);
		const tasks = (await tasksRes.json()) as { seriesId: number | null }[];
		assert.ok(
			tasks.some((task) => task.seriesId === seriesId),
			'AK4: Bestands-Aufgabe bleibt unverändert Eigentum des Empfängers',
		);
	});

	// ── AK5: Massenaustritt bei Gruppenlöschung ──────────────────────────────────────

	it('DELETE /groups/{id} stillagt Cross-Serien beider Paar-Richtungen und räumt Einladungen (AK5)', async () => {
		const groupId = await seedGroup([BOB, CAROL]);
		const aliceToBob = await createCrossSeries(await server.login(ALICE), BOB, 'Für Bob');
		const bobToAlice = await createCrossSeries(await server.login(BOB), ALICE, 'Für Alice');

		const res = await fetch(`${server.baseUrl}/groups/${groupId}`, {
			method: 'DELETE',
			headers: { Cookie: await server.login(ALICE) },
		});
		assert.equal(res.status, 204, 'Setup: Gruppenlöschung muss 204 liefern');

		assert.equal((await Series.findByPk(aliceToBob))?.active, false, 'AK5: Serie Alice→Bob ruhend');
		assert.equal((await Series.findByPk(bobToAlice))?.active, false, 'AK5: Serie Bob→Alice ruhend');
		assert.equal(await GroupInvitation.count({ where: { groupId } }), 0, 'AK5: Einladungen der Gruppe leer');
	});
});
