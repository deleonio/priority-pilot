import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1352 (Spec docs/spec/issue-1352.md) — Bearer-Auth neben Session.
 *
 * AK3: ein gültiger Bearer-Token verhält sich exakt wie die Session seines Besitzers.
 * AK5: Datenisolation gilt identisch für Bearer-Requests (Muster groups-dataisolation.test.ts).
 * AK6: ein Member-Token auf einem Admin-Endpunkt liefert 403 (Muster admin.api.test.ts).
 * AK7: ohne Session UND ohne Token liefert jeder geschützte Endpunkt 401.
 *
 * Rot, bis die Bearer-Middleware existiert (heute: Bearer-Header wirkungslos, Requests bleiben
 * bei 401 hängen). KEIN Produktivcode.
 */

process.env.GOOGLE_ALLOWED_EMAILS =
	'bearer-a@example.com,bearer-b@example.com,bearer-admin@example.com,bearer-member@example.com';
applyTestAuthEnv('api-token-auth-test');

type CreatedToken = { id: number; name: string; token: string };

let server: TestServer;

const createToken = async (cookie: string, name = 'CLI'): Promise<CreatedToken> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	return (await res.json()) as CreatedToken;
};

const withBearer = (token: string): Promise<Response> =>
	fetch(`${server.baseUrl}/tasks`, { headers: { Authorization: `Bearer ${token}` } });

const createTask = async (cookie: string, title: string): Promise<number> => {
	const res = await server.json('/tasks', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ title }),
	});
	assert.equal(res.status, 201, 'Setup: Task muss anlegbar sein');
	return ((await res.json()) as { id: number }).id;
};

describe('Bearer-Token-Auth — verhält sich wie Session (#1352 AK3/AK5/AK6/AK7)', () => {
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

	it('AK7: ohne Session und ohne Token liefert GET /tasks 401', async () => {
		const res = await fetch(`${server.baseUrl}/tasks`);
		assert.equal(res.status, 401);
	});

	it('AK7: ein unbekannter/erfundener Bearer-Token liefert 401', async () => {
		const res = await withBearer('pp_does-not-exist');
		assert.equal(res.status, 401);
	});

	it('AK3: GET /tasks mit gültigem Bearer-Token liefert dieselbe Antwort wie die Session des Besitzers', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		await createTask(cookie, 'Über Session angelegt');
		const { token } = await createToken(cookie);

		const viaSession = await server.json('/tasks', { headers: { Cookie: cookie } });
		const viaBearer = await withBearer(token);

		assert.equal(viaBearer.status, 200);
		assert.equal(viaSession.status, viaBearer.status);
		assert.deepEqual(await viaBearer.json(), await viaSession.json());
	});

	it('AK5: das Token von Nutzer A liefert keine Aufgabe von Nutzer B', async () => {
		const cookieA = await server.register('bearer-a@example.com', 'password123');
		const cookieB = await server.register('bearer-b@example.com', 'password123');
		await createTask(cookieA, 'Von A');
		await createTask(cookieB, 'Von B');
		const { token } = await createToken(cookieA);

		const res = await withBearer(token);
		assert.equal(res.status, 200);
		const list = (await res.json()) as { title: string }[];
		assert.ok(list.some((t) => t.title === 'Von A'));
		assert.ok(!list.some((t) => t.title === 'Von B'), 'fremde Aufgabe darf über Bearer nicht sichtbar sein');
	});

	it('AK5: PATCH /tasks/:id mit fremdem Bearer-Token auf eine Aufgabe von B liefert 404/403', async () => {
		const cookieA = await server.register('bearer-a@example.com', 'password123');
		const cookieB = await server.register('bearer-b@example.com', 'password123');
		const taskIdOfB = await createTask(cookieB, 'Nur B gehörend');
		const { token } = await createToken(cookieA);

		const res = await fetch(`${server.baseUrl}/tasks/${taskIdOfB}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ title: 'Übernommen' }),
		});
		assert.ok([403, 404].includes(res.status), `erwartete 403 oder 404, war ${res.status}`);
	});

	it('AK6: ein Member-Token auf GET /admin/users liefert 403', async () => {
		const memberCookie = await server.login('bearer-member@example.com', { role: 'member' });
		const { token } = await createToken(memberCookie);

		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
		assert.equal(res.status, 403);
	});

	it('AK6: ein Admin-Token auf GET /admin/users liefert 200', async () => {
		const adminCookie = await server.login('bearer-admin@example.com', { role: 'admin' });
		const { token } = await createToken(adminCookie);

		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
		assert.equal(res.status, 200);
	});
});
