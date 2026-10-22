import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { GroupInviteLink, NotificationLog, PushSubscription } from '../models/index.js';
import type { PushSender } from '../logics/push.js';

// Rote Spec-Tests für #1226 (AK1–AK4) — API-Vertrag laut docs/spec/issue-1226.md.
// Die Routen POST/DELETE …/invite-links, GET /invite-links/{token} (öffentlich, VOR requireAuth)
// und POST /invite-links/{token}/redeem existieren noch nicht; die Tests werden grün, sobald
// server/src/express/routes/groups.ts (bzw. der öffentliche Teil-Router in express/index.ts)
// den Vertrag umsetzt.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('groups-invite-links-test');

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';
const TEST_EMAIL_CAROL = 'carol@example.com';

let server: TestServer;

// #2854 TF2 (AK3): injizierter Push-Sender — der Redeem-Route-Push läuft über den Seam
// (Muster groups-invitations.api.test.ts).
interface SentPush {
	endpoint: string;
	body: string;
}
const pushCalls: SentPush[] = [];
const mockSender: PushSender = (subscription, payload) => {
	pushCalls.push({ endpoint: subscription.endpoint, body: payload });
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

/** Push-Trigger laufen nach dem Commit, asynchron zur HTTP-Antwort — kurz auf sie warten. */
const waitForPushes = async (expected: number): Promise<void> => {
	for (let i = 0; i < 150; i += 1) {
		if (pushCalls.length >= expected) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

type GroupDto = { id: number; name: string; role: string };
type InviteLinkDto = { id: number; token: string; expiresAt?: string };
type PublicLinkDto = { name: string; invitedByName: string };
type MemberDto = { userId: number; displayName: string; role: string };

describe('Gruppen-Beitritt über Einladungslink (#1226)', () => {
	before(async () => {
		server = await startTestServer({ pushSender: mockSender });
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

	/** Macht `cookie` (noch kein Mitglied) über Einladung+Annahme zum `member` der Gruppe. */
	const joinViaInvitation = async (
		adminCookie: string,
		memberCookie: string,
		groupId: number,
		memberDisplayName: string,
	): Promise<void> => {
		const hits = (await (
			await fetch(`${server.baseUrl}/users/search?query=${encodeURIComponent(memberDisplayName)}`, {
				headers: { cookie: memberCookie },
			})
		).json()) as { id: number; displayName: string }[];
		const ownId = hits.find((hit) => hit.displayName === memberDisplayName)?.id;
		assert.ok(ownId, `Setup: "${memberDisplayName}" muss über die Suche auffindbar sein`);
		const inviteRes = await fetch(`${server.baseUrl}/groups/${groupId}/invitations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: adminCookie },
			body: JSON.stringify({ userId: ownId }),
		});
		assert.equal(inviteRes.status, 201, 'Setup: Einladung muss anlegbar sein');
		const received = (await (
			await fetch(`${server.baseUrl}/invitations`, { headers: { cookie: memberCookie } })
		).json()) as { id: number; groupId: number }[];
		const invitation = received.find((entry) => entry.groupId === groupId);
		assert.ok(invitation, 'Setup: offene Einladung muss sichtbar sein');
		const acceptRes = await fetch(`${server.baseUrl}/invitations/${invitation.id}/accept`, {
			method: 'POST',
			headers: { cookie: memberCookie },
		});
		assert.equal(acceptRes.status, 200, 'Setup: Annahme muss gelingen');
	};

	const createLink = async (cookie: string, groupId: number): Promise<InviteLinkDto> => {
		const res = await fetch(`${server.baseUrl}/groups/${groupId}/invite-links`, {
			method: 'POST',
			headers: { cookie },
		});
		assert.equal(res.status, 201, 'Setup: Einladungslink muss anlegbar sein');
		return (await res.json()) as InviteLinkDto;
	};

	// ── AK1: POST /groups/{id}/invite-links ──────────────────────────────────────────

	it('Admin erhält 201 mit Token ≥ 32 Zeichen; ein zweiter Link bekommt einen anderen Token (AK1)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const group = await createGroup(alice, 'Wohnprojekt');

		const first = await createLink(alice, group.id);
		assert.equal(typeof first.token, 'string');
		assert.ok(first.token.length >= 32, `Token muss mindestens 32 Zeichen lang sein, war ${first.token.length}`);
		assert.ok(first.id, 'Antwort muss die Link-Id enthalten');

		const second = await createLink(alice, group.id);
		assert.notEqual(second.token, first.token, 'jeder Aufruf muss einen neuen Token liefern');
	});

	it('Mitglied (nicht Admin) erhält 403, Nicht-Mitglied 404 (AK1)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bob = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Mitglied' });
		const carol = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Draußen' });
		const group = await createGroup(alice, 'Verein');
		await joinViaInvitation(alice, bob, group.id, 'Bob Mitglied');

		const memberRes = await fetch(`${server.baseUrl}/groups/${group.id}/invite-links`, {
			method: 'POST',
			headers: { cookie: bob },
		});
		assert.equal(memberRes.status, 403);

		const outsiderRes = await fetch(`${server.baseUrl}/groups/${group.id}/invite-links`, {
			method: 'POST',
			headers: { cookie: carol },
		});
		assert.equal(outsiderRes.status, 404);
	});

	// ── AK2: GET /invite-links/{token} (öffentlich) ──────────────────────────────────

	it('GET ohne Session liefert Gruppenname + Einladenden, keine Mitglieder/E-Mail (AK2)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const group = await createGroup(alice, 'Familie');
		const link = await createLink(alice, group.id);

		const res = await fetch(`${server.baseUrl}/invite-links/${link.token}`);
		assert.equal(res.status, 200, 'GET muss ohne Session antworten (Mount vor requireAuth)');
		const body = (await res.json()) as PublicLinkDto;
		assert.equal(body.name, 'Familie');
		assert.equal(body.invitedByName, 'Alice Admin');
		const raw = JSON.stringify(body);
		assert.ok(!('members' in body), 'GET darf keine Mitgliederliste preisgeben');
		assert.ok(!raw.includes('alice@example.com'), 'GET darf keine E-Mail preisgeben');
	});

	it('unbekanntes Token → 404 (AK2)', async () => {
		const res = await fetch(`${server.baseUrl}/invite-links/does-not-exist`);
		assert.equal(res.status, 404);
	});

	it('abgelaufener Link (expiresAt zurückdatiert) → 410 (AK2)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const group = await createGroup(alice, 'Altlink');
		const link = await createLink(alice, group.id);
		await GroupInviteLink.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: link.id } });

		const res = await fetch(`${server.baseUrl}/invite-links/${link.token}`);
		assert.equal(res.status, 410);
	});

	// ── AK3: POST /invite-links/{token}/redeem ───────────────────────────────────────

	it('redeem ohne Session → 401; mit Session wird der Aufrufer Mitglied mit Rolle member (AK3)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const carol = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Neuzugang' });
		const group = await createGroup(alice, 'WG');
		const link = await createLink(alice, group.id);

		const anonRes = await fetch(`${server.baseUrl}/invite-links/${link.token}/redeem`, { method: 'POST' });
		assert.equal(anonRes.status, 401);

		const res = await fetch(`${server.baseUrl}/invite-links/${link.token}/redeem`, {
			method: 'POST',
			headers: { cookie: carol },
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as { groupId: number };
		assert.equal(body.groupId, group.id);

		// Rolle member in der Mitgliederliste nachprüfen — nicht nur 200 vertrauen.
		const members = (await (
			await fetch(`${server.baseUrl}/groups/${group.id}/members`, { headers: { cookie: alice } })
		).json()) as MemberDto[];
		const carolEntry = members.find((member) => member.displayName === 'Carol Neuzugang');
		assert.ok(carolEntry, 'Carol muss nach dem Einlösen Mitglied sein');
		assert.equal(carolEntry.role, 'member');
	});

	it('Zweit-Einlösen desselben Kontos → 409; auch wenn die Mitgliedschaft anderweitig entstand (AK3)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bob = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Zweifach' });
		const group = await createGroup(alice, 'Chor');
		const link = await createLink(alice, group.id);

		const first = await fetch(`${server.baseUrl}/invite-links/${link.token}/redeem`, {
			method: 'POST',
			headers: { cookie: bob },
		});
		assert.equal(first.status, 200);

		const second = await fetch(`${server.baseUrl}/invite-links/${link.token}/redeem`, {
			method: 'POST',
			headers: { cookie: bob },
		});
		assert.equal(second.status, 409);

		// Anderer Weg zur Mitgliedschaft (persönliche Einladung) → ebenfalls 409, kein Duplikat.
		const otherGroup = await createGroup(alice, 'Chor Zwei');
		const otherLink = await createLink(alice, otherGroup.id);
		await joinViaInvitation(alice, bob, otherGroup.id, 'Bob Zweifach');
		const late = await fetch(`${server.baseUrl}/invite-links/${otherLink.token}/redeem`, {
			method: 'POST',
			headers: { cookie: bob },
		});
		assert.equal(late.status, 409);
	});

	// ── AK4: DELETE /invite-links/{id} ───────────────────────────────────────────────

	it('DELETE als Admin widerruft: redeem und öffentliches GET danach 410; Mitglied erhält 403 (AK4)', async () => {
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bob = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Mitglied' });
		const carol = await server.login(TEST_EMAIL_CAROL, { displayName: 'Carol Spät' });
		const group = await createGroup(alice, 'Sport');
		await joinViaInvitation(alice, bob, group.id, 'Bob Mitglied');
		const link = await createLink(alice, group.id);

		const memberDelete = await fetch(`${server.baseUrl}/invite-links/${link.id}`, {
			method: 'DELETE',
			headers: { cookie: bob },
		});
		assert.equal(memberDelete.status, 403);

		const adminDelete = await fetch(`${server.baseUrl}/invite-links/${link.id}`, {
			method: 'DELETE',
			headers: { cookie: alice },
		});
		assert.equal(adminDelete.status, 204);

		const getRes = await fetch(`${server.baseUrl}/invite-links/${link.token}`);
		assert.equal(getRes.status, 410, 'widerrufener Link muss auch öffentlich als 410 erscheinen');
		const redeemRes = await fetch(`${server.baseUrl}/invite-links/${link.token}/redeem`, {
			method: 'POST',
			headers: { cookie: carol },
		});
		assert.equal(redeemRes.status, 410);
	});

	// ── #2854 TF2: Push-Trigger der Redeem-Route ────────────────────────────────────────

	it('#2854 AK3: POST /invite-links/{token}/redeem benachrichtigt den Link-Ersteller (group-member)', async () => {
		pushCalls.length = 0;
		const alice = await server.login(TEST_EMAIL_ALICE, { displayName: 'Alice Admin' });
		const bob = await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });
		const group = await createGroup(alice, 'Wohnprojekt');
		const link = await createLink(alice, group.id);
		// Ids der realen Konten (Link-Ersteller + Beigetreten) über die Nutzersuche.
		const idVon = async (cookie: string, name: string): Promise<number> => {
			const hits = (await (
				await fetch(`${server.baseUrl}/users/search?query=${encodeURIComponent(name)}`, { headers: { cookie } })
			).json()) as { id: number; displayName: string }[];
			const hit = hits.find((kandidat) => kandidat.displayName === name);
			assert.ok(hit, `Setup: "${name}" muss über die Suche auffindbar sein`);
			return hit.id;
		};
		const aliceId = await idVon(alice, 'Alice Admin');
		const bobId = await idVon(bob, 'Bob Baumeister');
		await PushSubscription.create({
			endpoint: 'https://push.example/alice-link',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: aliceId,
		});

		const res = await fetch(`${server.baseUrl}/invite-links/${link.token}/redeem`, {
			method: 'POST',
			headers: { cookie: bob },
		});
		assert.equal(res.status, 200, 'Setup: Einlösen muss gelingen');
		await waitForPushes(1);

		assert.equal(pushCalls.length, 1, 'genau ein Push an den Link-Ersteller');
		assert.equal(pushCalls[0].endpoint, 'https://push.example/alice-link');
		const payload = JSON.parse(pushCalls[0].body) as { url?: string };
		assert.equal(payload.url, `/settings/gruppen#gruppe-${group.id}`);
		const log = await NotificationLog.findOne({
			where: { kind: 'group-member', dedupeKey: `member:${group.id}:${bobId}` },
		});
		assert.ok(log, 'Beitritts-Push muss mit dedupeKey member:<groupId>:<userId> protokolliert sein');
	});
});
