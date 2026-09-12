import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { ApiToken } from '../models/index.js';

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
 *
 * Ergänzung #1357 (Spec docs/spec/issue-1357.md, Pflicht-Ablaufdatum): `createToken()` schickt ab
 * hier immer ein gültiges `expiresInDays` mit (Test-Pflege, Präzedenz api-tokens.test.ts). Die neuen
 * AK4/AK5-Fälle unten prüfen das Ablaufverhalten selbst über einen direkt in die DB geschriebenen
 * `expiresAt`-Wert (die Route legt bislang keinen kurzlebigen Token an).
 *
 * Ergänzung #1417 (Spec docs/spec/issue-1417.md, `api-key`-Header): AK1/AK2/AK3/AK6/AK7 —
 * derselbe Token muss auch über `api-key`/`x-api-key` statt `Authorization` funktionieren, mit
 * unveränderter Vorrangregel. Rot, bis `readBearerToken()` diese Header liest (heute: nur
 * `Authorization` wird ausgewertet, jeder Request ohne ihn bleibt bei 401 hängen).
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
		body: JSON.stringify({ name, expiresInDays: 365 }),
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

const postTaskViaBearer = (token: string, title: string): Promise<Response> =>
	fetch(`${server.baseUrl}/tasks`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ title }),
	});

const countTasks = async (cookie: string): Promise<number> => {
	const res = await server.json('/tasks', { headers: { Cookie: cookie } });
	return ((await res.json()) as unknown[]).length;
};

const patchTokenScopeViaSession = (cookie: string, id: number, scope: string): Promise<Response> =>
	server.json(`/api-tokens/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ scope }),
	});

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

	// Die Bearer-Middleware hängt global vor allen Routen — ein kaputter Header darf die bewusst
	// öffentlichen Endpunkte nicht mitreißen (Review-Anmerkung zu PR #1354).
	it('ein ungültiger Bearer-Token lässt die öffentliche Route GET /health erreichbar', async () => {
		const res = await fetch(`${server.baseUrl}/health`, {
			headers: { Authorization: 'Bearer pp_does-not-exist' },
		});
		assert.equal(res.status, 200);
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

	it('AK4: ein Nur-lese-Token liest weiterhin GET /tasks, ein schreibender Request liefert 403 ohne Datenänderung', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);
		const before = await countTasks(cookie);

		const read = await withBearer(token);
		assert.equal(read.status, 200, 'GET bleibt mit scope read erlaubt');

		const write = await postTaskViaBearer(token, 'Über Nur-lese-Token versucht');
		assert.equal(write.status, 403, 'POST muss mit scope read abgewiesen werden');

		const after = await countTasks(cookie);
		assert.equal(after, before, 'ein abgewiesener Schreibversuch darf keine Aufgabe anlegen');
	});

	it('AK5: nach dem Umschalten auf readwrite gelingt derselbe schreibende Request mit demselben Token', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { id, token } = await createToken(cookie);

		const blocked = await postTaskViaBearer(token, 'Erster Versuch');
		assert.equal(blocked.status, 403, 'Vorbedingung: Token startet als read');

		const patch = await patchTokenScopeViaSession(cookie, id, 'readwrite');
		assert.equal(patch.status, 200, 'Setup: Umschalten auf readwrite muss gelingen');

		const write = await postTaskViaBearer(token, 'Nach Hochstufen');
		assert.equal(write.status, 201, 'derselbe Token muss nach dem Umschalten schreiben dürfen');
	});

	it('AK7: /api-tokens ist über einen Bearer-Token gesperrt (403), über die Session unverändert nutzbar', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { id, token } = await createToken(cookie);

		const listViaBearer = await fetch(`${server.baseUrl}/api-tokens`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		assert.equal(listViaBearer.status, 403, 'ein Token darf die eigene Token-Verwaltung nicht lesen');

		const patchViaBearer = await fetch(`${server.baseUrl}/api-tokens/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ scope: 'readwrite' }),
		});
		assert.equal(patchViaBearer.status, 403, 'ein Token darf sich nicht selbst hochstufen');

		const listViaSession = await server.json('/api-tokens', { headers: { Cookie: cookie } });
		assert.equal(listViaSession.status, 200, 'die Browser-Session bleibt unverändert nutzbar');
	});

	// Regression zu #1358: die Ausnahme für die MCP-Transportroute verglich `req.path` exakt gegen
	// '/mcp/v1'. Der Router bedient (strict: false) aber auch '/mcp/v1/' — ein Client, dessen URL
	// mit Slash endet, fiel damit in die Schreibregel und bekam auf den Handshake eine nackte 403,
	// die MCP-Clients ohne Fehlertext als „Verbindung fehlgeschlagen" anzeigen.
	it('#1358: der MCP-Handshake gelingt mit einem Nur-lese-Token auch bei Pfad mit Schrägstrich', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);

		for (const path of ['/mcp/v1', '/mcp/v1/']) {
			const res = await fetch(`${server.baseUrl}${path}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
			});
			assert.equal(res.status, 200, `${path} muss den Handshake bedienen, war ${res.status}`);
			const body = (await res.json()) as { result?: { serverInfo?: { name?: string } } };
			assert.equal(body.result?.serverInfo?.name, 'priority-pilot-mcp-v1', `${path} liefert kein serverInfo`);
		}
	});

	// Gegenprobe zum Test darüber: die Normalisierung darf die Schreibsperre nicht aufweichen —
	// eine Fachroute mit Schrägstrich bleibt für ein Nur-lese-Token gesperrt.
	it('#1358: POST /tasks/ bleibt mit einem Nur-lese-Token 403', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);

		const res = await fetch(`${server.baseUrl}/tasks/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ title: 'Mit Schrägstrich versucht' }),
		});
		assert.equal(res.status, 403);
	});

	it('#1358: /api-tokens/ bleibt über einen Bearer-Token gesperrt', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);

		const res = await fetch(`${server.baseUrl}/api-tokens/`, { headers: { Authorization: `Bearer ${token}` } });
		assert.equal(res.status, 403);
	});
});

describe('api-key-Header — Token auch ohne Authorization annehmen (#1417 AK1/AK2/AK3/AK6/AK7)', () => {
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

	it('AK1: GET /tasks mit api-key liefert denselben Body wie Authorization: Bearer', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		await createTask(cookie, 'Über api-key angelegt');
		const { token } = await createToken(cookie);

		const viaBearer = await withBearer(token);
		const viaApiKey = await fetch(`${server.baseUrl}/tasks`, { headers: { 'api-key': token } });

		assert.equal(viaApiKey.status, 200);
		assert.equal(viaBearer.status, viaApiKey.status);
		assert.deepEqual(await viaApiKey.json(), await viaBearer.json());
	});

	it('AK2: GET /tasks mit x-api-key liefert ebenfalls 200 mit demselben Body', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		await createTask(cookie, 'Über x-api-key angelegt');
		const { token } = await createToken(cookie);

		const viaBearer = await withBearer(token);
		const viaXApiKey = await fetch(`${server.baseUrl}/tasks`, { headers: { 'x-api-key': token } });

		assert.equal(viaXApiKey.status, 200);
		assert.deepEqual(await viaXApiKey.json(), await viaBearer.json());
	});

	it('AK3: api-key mit versehentlichem Bearer-Präfix (auch gemischter Groß-/Kleinschreibung) liefert 200', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);

		const withPrefix = await fetch(`${server.baseUrl}/tasks`, { headers: { 'api-key': `Bearer ${token}` } });
		assert.equal(withPrefix.status, 200);

		const withMixedCasePrefix = await fetch(`${server.baseUrl}/tasks`, { headers: { 'api-key': `bEaReR ${token}` } });
		assert.equal(withMixedCasePrefix.status, 200);
	});

	it('AK6: ein widerrufener Token liefert über api-key 401 auf GET /tasks', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { id, token } = await createToken(cookie);
		const record = await ApiToken.findByPk(id);
		assert.ok(record, 'Setup: Token-Zeile muss existieren');
		await record!.update({ revokedAt: new Date() });

		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { 'api-key': token } });
		assert.equal(res.status, 401);
	});

	it('AK6: ein abgelaufener Token liefert über api-key 401 auf GET /tasks', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { id, token } = await createToken(cookie);
		const record = await ApiToken.findByPk(id);
		assert.ok(record, 'Setup: Token-Zeile muss existieren');
		await record!.update({ expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });

		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { 'api-key': token } });
		assert.equal(res.status, 401);
	});

	it('AK7: gültiges Authorization + unsinniges api-key liefert 200 (Authorization gewinnt)', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);

		const res = await fetch(`${server.baseUrl}/tasks`, {
			headers: { Authorization: `Bearer ${token}`, 'api-key': 'pp_does-not-exist' },
		});
		assert.equal(res.status, 200);
	});

	it('AK7: unsinniges Authorization + gültiges api-key liefert 401 (api-key wird nicht als Fallback genutzt)', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { token } = await createToken(cookie);

		const res = await fetch(`${server.baseUrl}/tasks`, {
			headers: { Authorization: 'Bearer pp_does-not-exist', 'api-key': token },
		});
		assert.equal(res.status, 401);
	});
});

describe('Bearer-Token-Auth — Pflicht-Ablaufdatum (#1357 AK4/AK5)', () => {
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

	it('AK4: ein Token mit expiresAt in der Vergangenheit liefert 401 auf einer geschützten Route, lastUsedAt bleibt null', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { id, token } = await createToken(cookie);
		const record = await ApiToken.findByPk(id);
		assert.ok(record, 'Setup: Token-Zeile muss existieren');
		await record!.update({ expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });

		const res = await withBearer(token);
		assert.equal(res.status, 401, 'ein abgelaufener Token darf keinen Zugriff mehr gewähren');

		const afterRecord = await ApiToken.findByPk(id);
		assert.equal(afterRecord!.get('lastUsedAt'), null, 'ein abgewiesener Request darf lastUsedAt nicht setzen');
	});

	it('AK5: derselbe Token vor seinem Ablaufdatum liefert weiterhin 200', async () => {
		const cookie = await server.register('bearer-a@example.com', 'password123');
		const { id, token } = await createToken(cookie);
		const record = await ApiToken.findByPk(id);
		assert.ok(record, 'Setup: Token-Zeile muss existieren');
		await record!.update({ expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });

		const res = await withBearer(token);
		assert.equal(res.status, 200, 'ein noch gültiger Token darf weiterhin Zugriff gewähren');
	});
});
