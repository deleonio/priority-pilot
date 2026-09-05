import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für #1212 (AK3–AK10) — API-Vertrag laut docs/spec/issue-1212.md.
// Die Routen POST/GET .../invitations, GET .../members und DELETE .../members/:userId
// existieren noch nicht; die Tests werden grün, sobald server/src/express/routes/groups.ts
// (bzw. users.ts) den Vertrag umsetzt.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('groups-invitations-test');

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';
const TEST_EMAIL_CAROL = 'carol@example.com';

let server: TestServer;

type GroupDto = { id: number; name: string; role: string; memberCount: number };
type InvitationDto = { id: number; groupId: number; userId?: number; status: string; message?: string };
type MemberDto = { userId: number; displayName: string; role: string };
type ReceivedInvitationDto = { id: number; groupId: number; groupName: string; invitedByName: string };

describe('Gruppen-Einladungen und Mitgliedschaftspflege (#1212)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const createGroup = async (cookie: string, name: string): Promise<GroupDto> => {
		const res = await fetch(`${server.baseUrl}/groups`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ name }),
		});
		assert.equal(res.status, 201, 'Setup: Gruppe muss anlegbar sein');
		return (await res.json()) as GroupDto;
	};

	/** Legt eine Einladung an und liefert die rohe Response. */
	const invite = (cookie: string, groupId: number, targetUserId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/invitations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ userId: targetUserId }),
		});

	/** Ermittelt die eigene userId über einen Suchtreffer auf den eigenen displayName. */
	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await fetch(`${server.baseUrl}/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

	// ── AK3/AK4: POST /groups/{id}/invitations ────────────────────────────────────────

	it('POST /groups/{id}/invitations legt als Admin eine pending-Einladung an (AK3)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');

		const res = await invite(aliceCookie, group.id, bobId);
		assert.equal(res.status, 201);
		const body = (await res.json()) as InvitationDto;
		assert.equal(body.status, 'pending');
		assert.equal(body.groupId, group.id);
	});

	it('doppelte Einladung für dasselbe Konto + Gruppe während pending → 409 (AK3)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');

		const first = await invite(aliceCookie, group.id, bobId);
		assert.equal(first.status, 201);
		const second = await invite(aliceCookie, group.id, bobId);
		assert.equal(second.status, 409, 'zweite pending-Einladung für dasselbe Konto ist ein Duplikat');
	});

	it('Nicht-Admin-Mitglied erhält 403 auf POST invitations, Nicht-Mitglied 404 (AK4)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const carolCookie = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Chef' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		const carolId = await ownUserId(carolCookie, 'Carol Chef');

		// Bob als member in die Gruppe holen (Admin lädt ein, Bob nimmt an).
		const inviteRes = await invite(aliceCookie, group.id, bobId);
		const invitation = (await inviteRes.json()) as InvitationDto;
		const acceptRes = await fetch(`${server.baseUrl}/invitations/${invitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: bobCookie },
		});
		assert.equal(acceptRes.status, 200, 'Setup: Bob muss annehmen können');

		// Bob (jetzt member, nicht admin) versucht Carol einzuladen → 403.
		const nonAdminRes = await invite(bobCookie, group.id, carolId);
		assert.equal(nonAdminRes.status, 403, 'Nicht-Admin-Mitglied darf nicht einladen');

		// Carol ist kein Mitglied der Gruppe → 404 statt 403 (kein Leak der Gruppenexistenz).
		const nonMemberRes = await invite(carolCookie, group.id, bobId);
		assert.equal(nonMemberRes.status, 404, 'Nicht-Mitglied bekommt 404, nicht 403');
	});

	// ── AK5: GET /invitations (Sicht des Eingeladenen) ────────────────────────────────

	it('GET /invitations liefert dem Eingeladenen offene Einladungen mit Gruppenname und Einladenden-Namen (AK5)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(aliceCookie, 'Familie Müller');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		await invite(aliceCookie, group.id, bobId);

		const res = await fetch(`${server.baseUrl}/invitations`, { headers: { cookie: bobCookie } });
		assert.equal(res.status, 200);
		const list = (await res.json()) as ReceivedInvitationDto[];
		assert.equal(list.length, 1);
		assert.equal(list[0].groupName, 'Familie Müller');
		assert.equal(list[0].invitedByName, 'Alice Admin');
	});

	// ── AK6/AK7/AK8: accept / decline / fremde Einladung ──────────────────────────────

	it('nach accept steht der Eingeladene als member in GET /groups/{id}/members und die Gruppe in seinem GET /groups (AK6)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		const inviteRes = await invite(aliceCookie, group.id, bobId);
		const invitation = (await inviteRes.json()) as InvitationDto;

		const acceptRes = await fetch(`${server.baseUrl}/invitations/${invitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: bobCookie },
		});
		assert.equal(acceptRes.status, 200);

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		assert.ok(
			members.some((m) => m.userId === bobId && m.role === 'member'),
			'Bob ist als member gelistet',
		);

		const groupsRes = await fetch(`${server.baseUrl}/groups`, { headers: { cookie: bobCookie } });
		const groups = (await groupsRes.json()) as GroupDto[];
		assert.ok(
			groups.some((g) => g.id === group.id),
			'die Gruppe erscheint in Bobs GET /groups',
		);
	});

	it('nach decline bleibt die Mitgliederliste unverändert und die Einladung verschwindet aus GET /invitations (AK7)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		const inviteRes = await invite(aliceCookie, group.id, bobId);
		const invitation = (await inviteRes.json()) as InvitationDto;

		const declineRes = await fetch(`${server.baseUrl}/invitations/${invitation.id}/decline`, {
			method: 'POST',
			headers: { cookie: bobCookie },
		});
		assert.equal(declineRes.status, 200);

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		assert.ok(!members.some((m) => m.userId === bobId), 'Bob ist nach decline nicht Mitglied');

		const invitationsRes = await fetch(`${server.baseUrl}/invitations`, { headers: { cookie: bobCookie } });
		const invitations = (await invitationsRes.json()) as ReceivedInvitationDto[];
		assert.equal(invitations.length, 0, 'abgelehnte Einladung ist weg');
	});

	it('fremde Einladung annehmen oder ablehnen → 404 (AK8)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const carolCookie = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Chef' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		const inviteRes = await invite(aliceCookie, group.id, bobId);
		const invitation = (await inviteRes.json()) as InvitationDto;

		const foreignAccept = await fetch(`${server.baseUrl}/invitations/${invitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: carolCookie },
		});
		assert.equal(foreignAccept.status, 404, 'fremde Einladung annehmen → 404');

		const foreignDecline = await fetch(`${server.baseUrl}/invitations/${invitation.id}/decline`, {
			method: 'POST',
			headers: { cookie: carolCookie },
		});
		assert.equal(foreignDecline.status, 404, 'fremde Einladung ablehnen → 404');
	});

	// ── AK9/AK10: DELETE /groups/{id}/members/{userId} ────────────────────────────────

	it('Admin entfernt ein Mitglied (204); Mitglied entfernt fremdes Konto → 403 (AK9)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const carolCookie = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Chef' });
		const group = await createGroup(aliceCookie, 'Familie');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		const carolId = await ownUserId(carolCookie, 'Carol Chef');

		const inviteBob = await invite(aliceCookie, group.id, bobId);
		const bobInvitation = (await inviteBob.json()) as InvitationDto;
		await fetch(`${server.baseUrl}/invitations/${bobInvitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: bobCookie },
		});

		const inviteCarol = await invite(aliceCookie, group.id, carolId);
		const carolInvitation = (await inviteCarol.json()) as InvitationDto;
		await fetch(`${server.baseUrl}/invitations/${carolInvitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: carolCookie },
		});

		// Bob (member) versucht, Carol (anderes Konto) zu entfernen → 403.
		const forbidden = await fetch(`${server.baseUrl}/groups/${group.id}/members/${carolId}`, {
			method: 'DELETE',
			headers: { cookie: bobCookie },
		});
		assert.equal(forbidden.status, 403, 'Mitglied darf kein fremdes Konto entfernen');

		// Admin entfernt Bob → 204.
		const removed = await fetch(`${server.baseUrl}/groups/${group.id}/members/${bobId}`, {
			method: 'DELETE',
			headers: { cookie: aliceCookie },
		});
		assert.equal(removed.status, 204);

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		assert.ok(!members.some((m) => m.userId === bobId), 'Bob ist entfernt');
	});

	it('letzter Admin wird nicht entfernt → 409 mit erklärender Meldung (AK10)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const group = await createGroup(aliceCookie, 'Familie');
		const aliceId = await ownUserId(aliceCookie, 'Alice Admin');

		const res = await fetch(`${server.baseUrl}/groups/${group.id}/members/${aliceId}`, {
			method: 'DELETE',
			headers: { cookie: aliceCookie },
		});
		assert.equal(res.status, 409);
		const body = (await res.json()) as { message?: string };
		assert.ok(typeof body.message === 'string' && body.message.length > 0, 'erklärende Meldung vorhanden');

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		assert.equal(members.length, 1, 'letzter Admin bleibt Mitglied');
	});
});

// Rote Spec-Tests für #1221 (AK1–AK6) — API-Vertrag laut docs/spec/issue-1221.md.
// Die Route PATCH /groups/{id}/members/{userId} existiert noch nicht.
describe('Rolle eines Gruppenmitglieds ändern (#1221)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const createGroup = async (cookie: string, name: string): Promise<GroupDto> => {
		const res = await fetch(`${server.baseUrl}/groups`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ name }),
		});
		assert.equal(res.status, 201, 'Setup: Gruppe muss anlegbar sein');
		return (await res.json()) as GroupDto;
	};

	const invite = (cookie: string, groupId: number, targetUserId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/invitations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ userId: targetUserId }),
		});

	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await fetch(`${server.baseUrl}/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

	const patchRole = (cookie: string, groupId: number, targetUserId: number, role: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/members/${targetUserId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ role }),
		});

	/** Legt eine Gruppe mit Alice (Admin) und Bob (Mitglied) an. */
	const setupGroupWithMember = async (): Promise<{
		aliceCookie: string;
		bobCookie: string;
		group: GroupDto;
		aliceId: number;
		bobId: number;
	}> => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bobCookie = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(aliceCookie, 'Familie');
		const aliceId = await ownUserId(aliceCookie, 'Alice Admin');
		const bobId = await ownUserId(bobCookie, 'Bob Baumeister');
		const invitation = (await (await invite(aliceCookie, group.id, bobId)).json()) as InvitationDto;
		await fetch(`${server.baseUrl}/invitations/${invitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: bobCookie },
		});
		return { aliceCookie, bobCookie, group, aliceId, bobId };
	};

	it('Admin befördert ein Mitglied zum Administrator → 200, Rolle danach admin (AK1)', async () => {
		const { aliceCookie, group, bobId } = await setupGroupWithMember();

		const res = await patchRole(aliceCookie, group.id, bobId, 'admin');
		assert.equal(res.status, 200);

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		const bob = members.find((m) => m.userId === bobId);
		assert.equal(bob?.role, 'admin', 'Bob ist jetzt Administrator');
	});

	it('Admin stuft einen Administrator zurück, sofern nicht der letzte → 200, Rolle danach member (AK2)', async () => {
		const { aliceCookie, group, bobId } = await setupGroupWithMember();
		await patchRole(aliceCookie, group.id, bobId, 'admin');

		const res = await patchRole(aliceCookie, group.id, bobId, 'member');
		assert.equal(res.status, 200);

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		const bob = members.find((m) => m.userId === bobId);
		assert.equal(bob?.role, 'member', 'Bob ist wieder Mitglied');
	});

	it('ungültiger Rollenwert → 400 (AK3)', async () => {
		const { aliceCookie, group, bobId } = await setupGroupWithMember();

		const res = await patchRole(aliceCookie, group.id, bobId, 'owner');
		assert.equal(res.status, 400);
	});

	it('Mitglied ohne Adminrolle darf keine Rolle ändern → 403 (AK4)', async () => {
		const { bobCookie, group, aliceId } = await setupGroupWithMember();

		const res = await patchRole(bobCookie, group.id, aliceId, 'member');
		assert.equal(res.status, 403);
	});

	it('Nicht-Mitglied bekommt 404 statt 403 (kein Existenz-Leak) (AK5)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const carolCookie = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Chef' });
		const group = await createGroup(aliceCookie, 'Familie');
		const aliceId = await ownUserId(aliceCookie, 'Alice Admin');

		const res = await patchRole(carolCookie, group.id, aliceId, 'member');
		assert.equal(res.status, 404);
	});

	it('Rückstufung des letzten Administrators → 409 mit erklärender Meldung; dieselbe Prüfung wie DELETE (AK6)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const group = await createGroup(aliceCookie, 'Familie');
		const aliceId = await ownUserId(aliceCookie, 'Alice Admin');

		const res = await patchRole(aliceCookie, group.id, aliceId, 'member');
		assert.equal(res.status, 409);
		const body = (await res.json()) as { message?: string };
		assert.ok(typeof body.message === 'string' && body.message.length > 0, 'erklärende Meldung vorhanden');

		const membersRes = await fetch(`${server.baseUrl}/groups/${group.id}/members`, {
			headers: { cookie: aliceCookie },
		});
		const members = (await membersRes.json()) as MemberDto[];
		const alice = members.find((m) => m.userId === aliceId);
		assert.equal(alice?.role, 'admin', 'Alice bleibt Administrator');
	});
});
