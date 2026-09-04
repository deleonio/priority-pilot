import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für #1212 (AK1/AK2) — API-Vertrag laut docs/spec/issue-1212.md.
// Die Route GET /users/search existiert noch nicht; die Tests werden grün, sobald
// server/src/express/routes/users.ts den Vertrag umsetzt.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('users-search-test');

const TEST_EMAIL_ALICE = 'alice@example.com';
const TEST_EMAIL_BOB = 'bob@example.com';
const TEST_EMAIL_CAROL = 'carol@example.com';

let server: TestServer;

type UserSearchHit = { id: number; displayName: string; email?: string };

describe('Nutzersuche — GET /users/search (#1212)', () => {
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

	const search = async (cookie: string, query: string): Promise<{ status: number; body: UserSearchHit[] }> => {
		const res = await fetch(`${server.baseUrl}/users/search?query=${encodeURIComponent(query)}`, {
			headers: { cookie },
		});
		return { status: res.status, body: (await res.json().catch(() => [])) as UserSearchHit[] };
	};

	// ── AK1: Treffer bei voller E-Mail oder displayName ab 3 Zeichen ─────────────────────

	it('liefert einen Treffer bei vollständiger E-Mail-Adresse (AK1)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });

		const { status, body } = await search(aliceCookie, TEST_EMAIL_BOB);
		assert.equal(status, 200);
		assert.equal(body.length, 1, 'genau ein Treffer bei voller E-Mail');
		assert.equal(body[0].displayName, 'Bob Baumeister');
	});

	it('liefert Treffer ab 3 Zeichen Namensfragment (AK1)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });

		const { status, body } = await search(aliceCookie, 'Bau');
		assert.equal(status, 200);
		assert.ok(
			body.some((hit) => hit.displayName === 'Bob Baumeister'),
			'Fragment "Bau" trifft "Bob Baumeister"',
		);
	});

	it('Treffer enthalten ausschließlich id und displayName, nie die E-Mail eines fremden Kontos (AK1)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });

		const { body } = await search(aliceCookie, TEST_EMAIL_BOB);
		assert.equal(body.length, 1);
		const hit = body[0] as Record<string, unknown>;
		assert.equal(typeof hit.id, 'number');
		assert.equal(typeof hit.displayName, 'string');
		assert.equal(hit.email, undefined, 'DTO darf keine E-Mail enthalten');
		assert.deepEqual(Object.keys(hit).sort(), ['displayName', 'id'], 'DTO hat ausschließlich id+displayName');
	});

	it('E-Mail-Fragment (Teiltreffer) liefert keinen Treffer auf die E-Mail-Adresse (AK1)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		await server.login(TEST_EMAIL_CAROL, { displayName: 'Zzz Zzz' });

		// "carol" ist ein Teil von carol@example.com, aber keine vollständige Adresse und
		// kein Fragment des abweichenden displayName → darf nicht treffen.
		const { status, body } = await search(aliceCookie, 'carol');
		assert.equal(status, 200);
		assert.ok(
			!body.some((hit) => hit.displayName === 'Zzz Zzz'),
			'Teiltreffer auf die E-Mail darf nicht zum Treffer führen',
		);
	});

	// ── AK2: keine Treffer → 200 mit leerer Liste ────────────────────────────────────────

	it('liefert 200 mit leerer Liste ohne Treffer, nicht 404 (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);

		const { status, body } = await search(aliceCookie, 'niemand-mit-diesem-namen');
		assert.equal(status, 200);
		assert.deepEqual(body, []);
	});

	it('liefert 200 mit leerer Liste bei zu kurzer Anfrage (<3 Zeichen, keine E-Mail) (AK2)', async () => {
		const aliceCookie = await server.login(TEST_EMAIL_ALICE);
		await server.login(TEST_EMAIL_BOB, { displayName: 'Bob Baumeister' });

		const { status, body } = await search(aliceCookie, 'Bo');
		assert.equal(status, 200);
		assert.deepEqual(body, [], 'unter 3 Zeichen löst keine Suche aus');
	});
});
