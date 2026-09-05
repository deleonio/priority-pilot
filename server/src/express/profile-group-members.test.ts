import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, registerOn, type TestServer } from '../test/helpers.js';

/**
 * Roter Spec-Test für #1238 AK3 (Spec docs/spec/issue-1238.md) — Regressionsschutz:
 * `PUT /profile` muss unverändert SOFORT auf `GET /groups/:id/members` wirken
 * (Mitgliederliste liest den Namen live aus `users`, routes/groups.ts:251-257;
 * `group_members` speichert bewusst keine Namens-Kopie).
 *
 * Heute bereits grün (bestehendes Verhalten) — der Test sichert den Vertrag gegen die
 * OAuth-Sync-Änderung aus #1238 ab. KEIN Produktivcode.
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
