import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1353 (Spec docs/spec/issue-1353.md) — MCP-Server-Endpunkt `/mcp/v1`.
 *
 * AK1: gültiger Bearer-Token → Verbindungsaufbau liefert eine Werkzeugliste.
 * AK2: kein/unbekannter/zurückgezogener Token → 401, kein Werkzeug aufrufbar.
 * Zusätzlich: GET /mcp/v1 → 405 mit `Allow: POST` (Streamable HTTP ohne SSE-Strom, ADR 0012).
 *
 * Rot, bis `/mcp/v1` existiert (heute: Route fehlt komplett, 404). KEIN Produktivcode.
 *
 * Ergänzung #1417 (Spec docs/spec/issue-1417.md, `api-key`-Header): AK4/AK5 — ein `tools/call`,
 * der ausschließlich über `api-key` angemeldet ist, muss ein Werkzeugergebnis liefern statt 401,
 * und die Scope-Sperre für schreibende Werkzeuge muss unverändert gelten. Rot, weil der
 * MCP-Loopback (`mcp/tools.ts`) heute nur den rohen `Authorization`-Header weiterreicht — ein
 * über `api-key` angemeldeter Request hat dort keinen, der Loopback scheitert an der gespiegelten
 * HTTP-Route mit 401.
 */

process.env.GOOGLE_ALLOWED_EMAILS = 'mcp-a@example.com';
applyTestAuthEnv('mcp-auth-test');

let server: TestServer;

const createToken = async (cookie: string, name = 'MCP-Client'): Promise<string> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name, expiresInDays: 365 }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	return ((await res.json()) as { token: string }).token;
};

const mcpListTools = (token?: string): Promise<Response> =>
	fetch(`${server.baseUrl}/mcp/v1`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
	});

describe('MCP-Endpunkt /mcp/v1 — Auth (#1353 AK1/AK2)', () => {
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

	it('AK2: ohne Token liefert /mcp/v1 401', async () => {
		const res = await mcpListTools();
		assert.equal(res.status, 401);
	});

	it('AK2: ein unbekannter Bearer-Token liefert 401', async () => {
		const res = await mcpListTools('pp_does-not-exist');
		assert.equal(res.status, 401);
	});

	it('AK2: ein zurückgezogener Token liefert 401', async () => {
		const cookie = await server.register('mcp-a@example.com', 'password123');
		const tokenRes = await server.json('/api-tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'Wird zurückgezogen', expiresInDays: 365 }),
		});
		const created = (await tokenRes.json()) as { id: number; token: string };
		const revokeRes = await server.json(`/api-tokens/${created.id}`, {
			method: 'DELETE',
			headers: { Cookie: cookie },
		});
		assert.equal(revokeRes.status, 204, 'Setup: Token muss zurückziehbar sein');

		const res = await mcpListTools(created.token);
		assert.equal(res.status, 401);
	});

	it('AK1: ein gültiger Bearer-Token liefert eine Werkzeugliste mit v1-Namensraum', async () => {
		const cookie = await server.register('mcp-a@example.com', 'password123');
		const token = await createToken(cookie);

		const res = await mcpListTools(token);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { result: { tools: { name: string }[] } };
		const names = body.result.tools.map((t) => t.name);
		for (const expected of [
			'task_list',
			'task_create',
			'task_update',
			'task_complete',
			'next_task',
			'pillar_list',
			'category_list',
		]) {
			assert.ok(names.includes(expected), `erwartete Werkzeug "${expected}" in ${JSON.stringify(names)}`);
		}
	});

	it('GET /mcp/v1 antwortet mit 405 und Allow: POST (Streamable HTTP ohne SSE-Strom)', async () => {
		const cookie = await server.register('mcp-a@example.com', 'password123');
		const token = await createToken(cookie);

		const res = await fetch(`${server.baseUrl}/mcp/v1`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		});
		assert.equal(res.status, 405);
		assert.equal(res.headers.get('allow'), 'POST');
	});
});

const mcpCallTool = (token: string, name: string, args: Record<string, unknown> = {}): Promise<Response> =>
	fetch(`${server.baseUrl}/mcp/v1`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'api-key': token,
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
	});

describe('MCP-Endpunkt /mcp/v1 — Anmeldung über api-key (#1417 AK4/AK5)', () => {
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

	it('AK4: tools/call für task_list, allein über api-key angemeldet, liefert ein Werkzeugergebnis', async () => {
		const cookie = await server.register('mcp-a@example.com', 'password123');
		const token = await createToken(cookie);

		const res = await mcpCallTool(token, 'task_list');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { result?: { content?: { text?: string }[] }; error?: unknown };
		assert.equal(body.error, undefined, 'darf keinen JSON-RPC-Fehler liefern');
		assert.ok(body.result?.content?.[0]?.text, 'result.content[0].text muss die Nutzdaten enthalten');
	});

	it('AK5: ein Nur-lese-Token, allein über api-key angemeldet, wird bei task_create mit dem Scope-Hinweis abgewiesen', async () => {
		const cookie = await server.register('mcp-a@example.com', 'password123');
		const token = await createToken(cookie);

		const res = await mcpCallTool(token, 'task_create', { title: 'Über api-key versucht' });
		assert.equal(res.status, 200, 'JSON-RPC-Fehler kommt mit HTTP 200');
		const body = (await res.json()) as { error?: { message?: string } };
		assert.match(
			body.error?.message ?? '',
			/schreibt, dieser Token erlaubt nur lesenden Zugriff/,
			'Scope-Hinweistext muss identisch zum Authorization-Pfad sein',
		);
	});
});
