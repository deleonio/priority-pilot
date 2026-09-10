import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { CATEGORY_COLORS } from '../models/categoryColors.js';

/**
 * Rote Spec-Tests für #1353 (Spec docs/spec/issue-1353.md) — MCP-Werkzeuge v1.
 *
 * AK3: task_list/task_create/task_update/task_complete spiegeln die vorhandene Task-Logik.
 * AK4: next_task liefert dasselbe wie GET /next.
 * AK5: pillar_list/category_list liefern die eigenen Stammdaten.
 * AK6: Datenisolation — Token von A liefert keine Daten von B, Schreiben auf B-Ressourcen scheitert.
 * AK7: kein Werkzeug trägt "admin" im Namen.
 * AK8: die Werkzeugliste (Namen + Schemas) ist als Snapshot stabil.
 *
 * Rot, bis `/mcp/v1` und die Werkzeug-Handler existieren (heute: Route fehlt, 404). KEIN Produktivcode.
 */

process.env.GOOGLE_ALLOWED_EMAILS = 'mcp-tools-a@example.com,mcp-tools-b@example.com';
applyTestAuthEnv('mcp-tools-test');

let server: TestServer;
let idCounter = 1;

type JsonRpcResponse<T> = { result?: T; error?: { message: string } };

const createToken = async (cookie: string): Promise<string> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: `Client-${idCounter++}` }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	return ((await res.json()) as { token: string }).token;
};

const mcpCall = async <T>(
	token: string,
	tool: string,
	args: Record<string, unknown> = {},
): Promise<JsonRpcResponse<T>> => {
	const res = await fetch(`${server.baseUrl}/mcp/v1`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: idCounter++,
			method: 'tools/call',
			params: { name: tool, arguments: args },
		}),
	});
	assert.equal(res.status, 200, `tools/call ${tool} sollte 200 liefern`);
	return (await res.json()) as JsonRpcResponse<T>;
};

const mcpListTools = async (
	token: string,
): Promise<{ name: string; inputSchema?: unknown; outputSchema?: unknown }[]> => {
	const res = await fetch(`${server.baseUrl}/mcp/v1`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: idCounter++, method: 'tools/list', params: {} }),
	});
	assert.equal(res.status, 200, 'tools/list sollte 200 liefern');
	const body = (await res.json()) as {
		result: { tools: { name: string; inputSchema?: unknown; outputSchema?: unknown }[] };
	};
	return body.result.tools;
};

const createTaskViaApi = async (cookie: string, title: string): Promise<number> => {
	const res = await server.json('/tasks', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ title }),
	});
	assert.equal(res.status, 201, 'Setup: Task muss über die API anlegbar sein');
	return ((await res.json()) as { id: number }).id;
};

describe('MCP-Werkzeuge v1 (#1353 AK3–AK8)', () => {
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

	it('AK3: task_create legt eine Aufgabe an, die task_list anschließend enthält', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const created = await mcpCall<{ id: number; title: string }>(token, 'task_create', { title: 'Über MCP angelegt' });
		assert.equal(created.result?.title, 'Über MCP angelegt');

		const list = await mcpCall<{ id: number; title: string }[]>(token, 'task_list');
		assert.ok(list.result?.some((t) => t.title === 'Über MCP angelegt'));
	});

	it('AK3: task_update ändert eine eigene Aufgabe, task_complete setzt sie auf erledigt', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Wird geändert');

		const updated = await mcpCall<{ id: number; title: string }>(token, 'task_update', {
			id: taskId,
			title: 'Neuer Titel',
		});
		assert.equal(updated.result?.title, 'Neuer Titel');

		const completed = await mcpCall<{ id: number; status: string }>(token, 'task_complete', { id: taskId });
		assert.equal(completed.result?.status, 'Done');
	});

	it('AK4: next_task liefert dieselbe Aufgabe wie GET /next', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		await createTaskViaApi(cookie, 'Einzige offene Aufgabe');

		const httpNext = await server.json('/next', { headers: { Cookie: cookie } });
		const httpBody = (await httpNext.json()) as { id: number } | null;

		const mcpNext = await mcpCall<{ id: number } | null>(token, 'next_task');
		assert.deepEqual(mcpNext.result, httpBody);
	});

	it('AK4: next_task liefert null, wenn es keine freie Aufgabe gibt', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const mcpNext = await mcpCall<{ id: number } | null>(token, 'next_task');
		assert.equal(mcpNext.result, null);
	});

	it('AK5: pillar_list und category_list liefern die eigenen Stammdaten', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const created = await server.json('/categories', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'Eigene Kategorie', color: CATEGORY_COLORS[0] }),
		});
		assert.equal(created.status, 201, 'Setup: Kategorie muss anlegbar sein');

		const pillars = await mcpCall<{ id: number; name: string }[]>(token, 'pillar_list');
		assert.ok(Array.isArray(pillars.result));

		const categories = await mcpCall<{ id: number; name: string }[]>(token, 'category_list');
		assert.ok(categories.result?.some((c) => c.name === 'Eigene Kategorie'));
	});

	it('AK6: Werkzeuge liefern keine fremden Daten, Schreiben auf fremde Aufgabe schlägt fehl', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		await createTaskViaApi(cookieA, 'Von A');
		const taskIdOfB = await createTaskViaApi(cookieB, 'Von B');

		const list = await mcpCall<{ title: string }[]>(tokenA, 'task_list');
		assert.ok(!list.result?.some((t) => t.title === 'Von B'), 'fremde Aufgabe darf nicht sichtbar sein');

		const res = await fetch(`${server.baseUrl}/mcp/v1`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${tokenA}`,
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: idCounter++,
				method: 'tools/call',
				params: { name: 'task_update', arguments: { id: taskIdOfB, title: 'Übernommen' } },
			}),
		});
		const body = (await res.json()) as JsonRpcResponse<unknown>;
		assert.ok(body.error, 'task_update auf fremde Aufgabe muss fehlschlagen');

		const stillB = await server.json(`/tasks/${taskIdOfB}`, { headers: { Cookie: cookieB } });
		const stillBBody = (await stillB.json()) as { title: string };
		assert.equal(
			stillBBody.title,
			'Von B',
			'fremde Aufgabe darf durch den fehlgeschlagenen Aufruf nicht geändert sein',
		);
	});

	it('AK7: keine Werkzeugliste enthält ein Admin-Werkzeug', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		assert.ok(
			tools.every((t) => !t.name.toLowerCase().includes('admin')),
			`Werkzeugliste enthält ein Admin-Werkzeug: ${JSON.stringify(tools.map((t) => t.name))}`,
		);
	});

	it('AK8: der v1-Werkzeugvertrag (Namen + Schemas) entspricht dem eingecheckten Snapshot', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
		const names = sorted.map((t) => t.name);

		assert.deepEqual(
			names,
			['category_list', 'next_task', 'pillar_list', 'task_complete', 'task_create', 'task_list', 'task_update'],
			'v1-Werkzeugnamen sind ab dem Merge eingefroren (AK8) — eine unbeabsichtigte Änderung muss diesen Test rot machen',
		);
		for (const tool of sorted) {
			assert.ok(tool.inputSchema, `${tool.name} muss ein inputSchema deklarieren`);
		}
	});
});
