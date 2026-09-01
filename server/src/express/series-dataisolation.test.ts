import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Rote Spec-Tests für #1157 (AK1/AK2): Serien sind nutzer-eigen (ownerScope) — analog
// pillars-dataisolation.test.ts (#428). Die Serien-Routen scopen aktuell nicht: GET /series
// liefert alle Serien aller Nutzer, GET/PATCH/DELETE /series/:id und
// POST /series/:id/:generate arbeiten auf fremden Serien. Diese Tests werden grün, sobald
// die Routen das etablierte ownerScope(userId)-Muster (vgl. tasks.ts findOwnTask) nutzen.
// Pass-Through (ohne Auth, leerer Scope) bleibt unverändert — abgesichert durch
// series.api.test.ts (ohne Cookie/Scope).
//
// Auth-Env über die Plural-Variable, damit der Test gegen eine lokale .env gewinnt
// (Begründung: pillars-dataisolation.test.ts:11-14).
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('series-iso-test');

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';

let server: TestServer;

/** gültiger Serien-Body (Pflichtfelder laut validateSeriesFields), Titel variierbar. */
const validSeries = (title: string) => ({
	title,
	rhythm: 'weekly',
	priority: 4,
	estimatedEffort: 0.5,
	active: true,
	startDate: '2030-01-07T00:00:00.000Z', // Montag — konsistent mit rhythm 'weekly' (kein Wochentag-Zwang)
});

describe('Serien-Datenisolation — nutzer-eigene Serien (#1157)', () => {
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

	/** Legt mit dem gegebenen Cookie eine Serie an und liefert deren ID. */
	const createSeries = async (cookie: string, title: string): Promise<number> => {
		const res = await fetch(`${server.baseUrl}/series`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify(validSeries(title)),
		});
		assert.equal(res.status, 201, 'Setup: Serie muss anlegbar sein');
		return ((await res.json()) as { id: number }).id;
	};

	// ── AK1: GET /series — nur eigene Serien ───────────────────────────────────────────

	it('GET /series liefert mit Session von Alice nur ihre eigenen Serien (AK1)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceSeriesId = await createSeries(aliceCookie, 'Alices Serie');
		const bobSeriesId = await createSeries(bobCookie, 'Bobs Serie');

		const res = await fetch(`${server.baseUrl}/series`, { headers: { cookie: aliceCookie } });
		assert.equal(res.status, 200);
		const list = (await res.json()) as { id: number }[];

		assert.ok(
			list.some((series) => series.id === aliceSeriesId),
			'Alices eigene Serie ist gelistet',
		);
		assert.ok(!list.some((series) => series.id === bobSeriesId), 'Bobs Serie darf für Alice nicht gelistet sein');
		assert.equal(list.length, 1, 'Alice sieht genau ihre eine Serie');
	});

	// ── AK2: fremde Serien-ID → 404 auf allen :id-Routen ───────────────────────────────

	it('GET /series/:id liefert 404 für fremde Serie, 200 für eigene (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceId = await createSeries(aliceCookie, 'Alices Serie');
		const bobId = await createSeries(bobCookie, 'Bobs Serie');

		const foreignRes = await fetch(`${server.baseUrl}/series/${bobId}`, { headers: { cookie: aliceCookie } });
		assert.equal(foreignRes.status, 404, 'fremde Serie muss 404 liefern');

		const ownRes = await fetch(`${server.baseUrl}/series/${aliceId}`, { headers: { cookie: aliceCookie } });
		assert.equal(ownRes.status, 200, 'eigene Serie bleibt lesbar (kein Über-Scoping)');
	});

	it('PATCH /series/:id liefert 404 für fremde Serie, 200 für eigene (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceId = await createSeries(aliceCookie, 'Alices Serie');
		const bobId = await createSeries(bobCookie, 'Bobs Serie');

		const foreignRes = await fetch(`${server.baseUrl}/series/${bobId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ title: 'Geklaut' }),
		});
		assert.equal(foreignRes.status, 404, 'fremde Serie darf nicht änderbar sein');

		const ownRes = await fetch(`${server.baseUrl}/series/${aliceId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ title: 'AliceUmbenannt' }),
		});
		assert.equal(ownRes.status, 200, 'eigene Serie bleibt änderbar (kein Über-Scoping)');
	});

	it('DELETE /series/:id liefert 404 für fremde Serie, 204 für eigene (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceId = await createSeries(aliceCookie, 'Alices Serie');
		const bobId = await createSeries(bobCookie, 'Bobs Serie');

		const foreignRes = await fetch(`${server.baseUrl}/series/${bobId}`, {
			method: 'DELETE',
			headers: { cookie: aliceCookie },
		});
		assert.equal(foreignRes.status, 404, 'fremde Serie darf nicht löschbar sein');

		const ownRes = await fetch(`${server.baseUrl}/series/${aliceId}`, {
			method: 'DELETE',
			headers: { cookie: aliceCookie },
		});
		assert.equal(ownRes.status, 204, 'eigene Serie bleibt löschbar (kein Über-Scoping)');
	});

	it('POST /series/:id/generate liefert 404 für fremde Serie, 201 für eigene (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		const bobCookie = await server.login(TEST_EMAIL_BOB);

		const aliceId = await createSeries(aliceCookie, 'Alices Serie');
		const bobId = await createSeries(bobCookie, 'Bobs Serie');

		const until = '2030-02-01T00:00:00.000Z';
		const foreignRes = await fetch(`${server.baseUrl}/series/${bobId}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ until }),
		});
		assert.equal(foreignRes.status, 404, 'für fremde Serie dürfen keine Instanzen erzeugt werden');

		const ownRes = await fetch(`${server.baseUrl}/series/${aliceId}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie: aliceCookie },
			body: JSON.stringify({ until }),
		});
		assert.equal(ownRes.status, 201, 'eigene Serie bleibt generierbar (kein Über-Scoping)');
	});
});
