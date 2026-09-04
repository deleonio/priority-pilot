import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für #1211 (AK2/AK3/AK9): Gruppen-Sichtbarkeit läuft über
// group_members-Membership, NICHT über ownerScope (Group hat kein userId-Feld).
// Muster: series-dataisolation.test.ts — zwei Konten, fremde Gruppe → 404 (nicht 403).
// Auth-Env über die Plural-Variable, damit der Test gegen eine lokale .env gewinnt.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('groups-iso-test');

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';

let server: TestServer;

describe('Gruppen-Datenisolation — Membership statt ownerScope (#1211)', () => {
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

	/** Legt mit dem gegebenen Cookie eine Gruppe an und liefert deren ID. */
	const createGroup = async (cookie: string, name: string): Promise<number> => {
		const res = await fetch(`${server.baseUrl}/groups`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ name }),
		});
		assert.equal(res.status, 201, 'Setup: Gruppe muss anlegbar sein');
		return ((await res.json()) as { id: number }).id;
	};

	// ── AK2: GET /groups listet nur Gruppen eigener Membership ────────────────────────

	it('GET /groups liefert nur Gruppen mit Membership des angemeldeten Nutzers (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceGroupId = await createGroup(aliceCookie, 'Alices Familie');
		const bobGroupId = await createGroup(bobCookie, 'Bobs Sportgruppe');

		const res = await fetch(`${server.baseUrl}/groups`, { headers: { cookie: aliceCookie } });
		assert.equal(res.status, 200);
		const list = (await res.json()) as { id: number; role: string; memberCount: number }[];

		assert.ok(list.some((group) => group.id === aliceGroupId), 'eigene Gruppe ist gelistet');
		assert.ok(!list.some((group) => group.id === bobGroupId), 'fremde Gruppe ist nicht gelistet');
		assert.equal(list.length, 1, 'Alice sieht genau ihre eine Gruppe');
		assert.equal(list[0].role, 'admin', 'eigene Rolle wird mitgeliefert');
		assert.equal(list[0].memberCount, 1, 'Mitgliederzahl wird mitgeliefert');
	});

	// ── AK3: fremde Gruppe → 404 auf allen :id-Routen ─────────────────────────────────

	it('GET /groups/:id liefert 404 für fremde Gruppe, 200 für eigene (AK3)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceGroupId = await createGroup(aliceCookie, 'Alices Familie');
		const bobGroupId = await createGroup(bobCookie, 'Bobs Sportgruppe');

		const foreignRes = await fetch(`${server.baseUrl}/groups/${bobGroupId}`, { headers: { cookie: aliceCookie } });
		assert.equal(foreignRes.status, 404, 'fremde Gruppe muss 404 liefern (nicht 403)');

		const ownRes = await fetch(`${server.baseUrl}/groups/${aliceGroupId}`, { headers: { cookie: aliceCookie } });
		assert.equal(ownRes.status, 200, 'eigene Gruppe bleibt lesbar (kein Über-Scoping)');
	});

	it('PATCH /groups/:id liefert 404 für fremde Gruppe, 200 für eigene (AK3)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceGroupId = await createGroup(aliceCookie, 'Alices Familie');
		const bobGroupId = await createGroup(bobCookie, 'Bobs Sportgruppe');

		const foreignRes = await fetch(`${server.baseUrl}/groups/${bobGroupId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ name: 'Geklaut' }),
		});
		assert.equal(foreignRes.status, 404, 'fremde Gruppe darf nicht änderbar sein');

		const ownRes = await fetch(`${server.baseUrl}/groups/${aliceGroupId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ name: 'Umbenannt' }),
		});
		assert.equal(ownRes.status, 200, 'eigene Gruppe bleibt änderbar');
	});

	it('DELETE /groups/:id liefert 404 für fremde Gruppe, 204 für eigene (AK3)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceGroupId = await createGroup(aliceCookie, 'Alices Familie');
		const bobGroupId = await createGroup(bobCookie, 'Bobs Sportgruppe');

		const foreignRes = await fetch(`${server.baseUrl}/groups/${bobGroupId}`, {
			method: 'DELETE',
			headers: { cookie: aliceCookie },
		});
		assert.equal(foreignRes.status, 404, 'fremde Gruppe darf nicht löschbar sein');

		const ownRes = await fetch(`${server.baseUrl}/groups/${aliceGroupId}`, {
			method: 'DELETE',
			headers: { cookie: aliceCookie },
		});
		assert.equal(ownRes.status, 204, 'eigene Gruppe bleibt löschbar');

		// Nach-Wirkung prüfen: Bobs Gruppe muss unangetastet weiter existieren.
		const bobStillThere = await fetch(`${server.baseUrl}/groups/${bobGroupId}`, { headers: { cookie: bobCookie } });
		assert.equal(bobStillThere.status, 200, 'fehlgeschlagener Fremd-Delete darf nichts zerstören');
	});
});
