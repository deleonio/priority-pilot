import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, registerOn, type TestServer } from '../test/helpers.js';
import { upsertOAuthUser } from '../logics/oauthUser.js';

/**
 * Roter Spec-Test für #1238 AK3 (Spec docs/spec/issue-1238.md) — Regressionsschutz:
 * `PUT /profile` muss unverändert SOFORT auf `GET /groups/:id/members` wirken
 * (Mitgliederliste liest den Namen live aus `users`, routes/groups.ts:251-257;
 * `group_members` speichert bewusst keine Namens-Kopie).
 *
 * Heute bereits grün (bestehendes Verhalten) — der Test sichert den Vertrag gegen die
 * OAuth-Sync-Änderung aus #1238 ab. KEIN Produktivcode.
 *
 * #1256 AK2 (Spec docs/spec/issue-1256.md): der eigene Name übersteht nicht nur den
 * PUT, sondern auch den NÄCHSTEN OAuth-Login — `upsertOAuthUser` (gleicher Pfad wie die
 * GoogleStrategy-Verify) darf `displayName` bei gesetzter Eigen-Speicherung nicht
 * überschreiben; die Live-Lese der Mitgliederliste zeigt weiterhin den eigenen Namen.
 * Heute rot: der OAuth-Sync zieht den Google-Namen vorbehaltlos nach.
 */

type MemberDto = { userId: number; displayName: string; role: string };

let server: TestServer;

describe('#1238 AK3 — PUT /profile wirkt sofort auf GET /groups/:id/members', () => {
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

	it('Namensaenderung ueber PUT /profile erscheint ohne erneuten Login in der Mitgliederliste', async () => {
		const cookie = await registerOn(server, 'members-sync@example.com', 'S3hr-gut!');
		const createRes = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'WG 42' }),
		});
		assert.equal(createRes.status, 201, 'Gruppe muss angelegt werden');
		const groupId = ((await createRes.json()) as { id: number }).id;

		const put = await server.json('/profile', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ displayName: 'Anna Neu' }),
		});
		assert.equal(put.status, 200, 'PUT /profile muss 200 liefern');
		await put.body?.cancel();

		const membersRes = await server.json(`/groups/${groupId}/members`, {
			headers: { Cookie: cookie },
		});
		assert.equal(membersRes.status, 200);
		const members = (await membersRes.json()) as MemberDto[];
		const own = members.find((m) => m.role === 'admin');
		assert.ok(own, 'Ersteller muss als Mitglied gelistet sein');
		assert.equal(
			own.displayName,
			'Anna Neu',
			'Mitgliederliste muss den Live-Namen aus users zeigen, nicht den Registrierungs-Snapshot',
		);
	});
});

describe('#1256 AK2 — eigener Name übersteht OAuth-Login in der Mitgliederliste', () => {
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

	it('nach PUT /profile und OAuth-Login mit abweichendem Google-Namen zeigt GET /groups/:id/members weiterhin den eigenen Namen', async () => {
		const cookie = await registerOn(server, 'oauth-members@example.com', 'S3hr-gut!');
		const createRes = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'WG 1256' }),
		});
		assert.equal(createRes.status, 201, 'Gruppe muss angelegt werden');
		const groupId = ((await createRes.json()) as { id: number }).id;

		const put = await server.json('/profile', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ displayName: 'Anna Eigen' }),
		});
		assert.equal(put.status, 200, 'PUT /profile muss 200 liefern');
		await put.body?.cancel();

		// OAuth-(Re-)Login simulieren — derselbe upsertOAuthUser-Pfad wie die GoogleStrategy-Verify,
		// mit abweichendem Google-Profilnamen.
		const result = await upsertOAuthUser({
			email: 'oauth-members@example.com',
			displayName: 'Google Name',
			avatarUrl: null,
		});
		assert.equal(result.displayName, 'Anna Eigen', 'AK1-Kern: Rueckgabe traegt den eigenen Namen');

		const membersRes = await server.json(`/groups/${groupId}/members`, {
			headers: { Cookie: cookie },
		});
		assert.equal(membersRes.status, 200);
		const members = (await membersRes.json()) as MemberDto[];
		const own = members.find((m) => m.role === 'admin');
		assert.ok(own, 'Ersteller muss als Mitglied gelistet sein');
		assert.equal(
			own.displayName,
			'Anna Eigen',
			'AK2: Mitgliederliste (Live-Lese aus users) zeigt den eigenen Namen, nicht den Google-Namen',
		);
	});
});
