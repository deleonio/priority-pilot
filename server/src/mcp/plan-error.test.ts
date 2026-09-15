/**
 * Übersetzung paketbedingter Ablehnungen im MCP-Loopback (Issue #1457, AK6).
 *
 * `callApi()` (tools.ts) erkennt eine 403-Antwort generisch an `code === 'plan_required'` — nicht an
 * einer Werkzeugliste — und meldet dem Client Feature und erforderliches Paket statt eines nackten
 * „HTTP 403". Leseoperationen (`group_list`) bleiben auch für `free` erfolgreich (AK4).
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import type { Plan } from '../logics/plans.js';

applyTestAuthEnv('mcp-plan-error-test');

let server: TestServer;
let idCounter = 1;

/** Readwrite-Token für den Nutzer hinter `cookie` (Muster: tools.test.ts). */
const createToken = async (cookie: string): Promise<string> => {
	const created = await fetch(`${server.baseUrl}/api-tokens`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: `Client-${idCounter++}`, expiresInDays: 365 }),
	});
	assert.equal(created.status, 201, 'Setup: Token muss anlegbar sein');
	const { id, token } = (await created.json()) as { id: number; token: string };
	const patched = await fetch(`${server.baseUrl}/api-tokens/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ scope: 'readwrite' }),
	});
	assert.equal(patched.status, 200, 'Setup: Hochstufen auf readwrite muss gelingen');
	return token;
};

const mcpCall = async (
	token: string,
	tool: string,
	args: Record<string, unknown> = {},
): Promise<{ text?: string; error?: { message: string } }> => {
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
	const body = (await res.json()) as {
		result?: { content?: { type: string; text: string }[] };
		error?: { message: string };
	};
	return { text: body.result?.content?.[0]?.text, error: body.error };
};

/** Setzt den Plan eines per E-Mail bekannten Nutzers direkt in der DB (Test-Only-Shortcut). */
const setPlan = (email: string, plan: Plan): Promise<unknown> => User.update({ plan }, { where: { email } });

const createTask = async (cookie: string, title: string): Promise<number> => {
	const res = await fetch(`${server.baseUrl}/tasks`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort: 0.5 }),
	});
	assert.equal(res.status, 201, 'Setup: Task muss anlegbar sein');
	return ((await res.json()) as { id: number }).id;
};

describe('MCP-Loopback übersetzt plan_required (#1457 AK6)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		delete process.env.MONETIZATION_ENFORCED;
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	for (const tool of ['task_link', 'task_unlink'] as const) {
		it(`${tool}: free-Nutzer erhält Feature und Paket im Fehlertext statt „HTTP 403"`, async () => {
			const email = `mcp-plan-${tool}@example.com`;
			const cookie = await server.register(email);
			const token = await createToken(cookie);
			const from = await createTask(cookie, 'A');
			const to = await createTask(cookie, 'B');
			await setPlan(email, 'free');
			process.env.MONETIZATION_ENFORCED = 'true';

			const { error } = await mcpCall(token, tool, { taskId: from, dependsOnId: to });

			assert.ok(error, `${tool} muss einen JSON-RPC-Fehler liefern`);
			assert.match(error.message, /graph_write/, 'Fehlertext muss das fehlende Feature nennen');
			assert.match(error.message, /max/, 'Fehlertext muss das erforderliche Paket nennen');
			assert.doesNotMatch(error.message, /HTTP 403/, 'kein nacktes „HTTP 403" mehr');
		});
	}

	it('task_links (Leseoperation) bleibt für free-Nutzer erfolgreich', async () => {
		const email = 'mcp-plan-task-links@example.com';
		const cookie = await server.register(email);
		const token = await createToken(cookie);
		const taskId = await createTask(cookie, 'A');
		await setPlan(email, 'free');
		process.env.MONETIZATION_ENFORCED = 'true';

		const { text, error } = await mcpCall(token, 'task_links', { taskId });

		assert.equal(error, undefined, 'Lesen darf nicht am Paket scheitern');
		assert.ok(text, 'task_links muss ein Ergebnis liefern');
	});

	it('group_list (Leseoperation) bleibt für free-Nutzer erfolgreich (AK4)', async () => {
		const email = 'mcp-plan-group-list@example.com';
		const cookie = await server.register(email);
		const token = await createToken(cookie);
		await setPlan(email, 'free');
		process.env.MONETIZATION_ENFORCED = 'true';

		const { text, error } = await mcpCall(token, 'group_list');

		assert.equal(error, undefined, 'Gruppenliste bleibt nach einem Downgrade lesbar');
		assert.ok(text, 'group_list muss ein Ergebnis liefern');
	});
});

describe('MCP-Loopback — Plan-Deckel für schreibende Werkzeuge (#1460 AK7, Spec docs/spec/issue-1460.md)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		delete process.env.MONETIZATION_ENFORCED;
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('task_link: ein readwrite-Token eines max-Nutzers erhält bei eingeschaltetem Rollout einen JSON-RPC-Fehler, der ultimate nennt', async () => {
		const email = 'mcp-plan-cap-max@example.com';
		const cookie = await server.register(email);
		const token = await createToken(cookie);
		const from = await createTask(cookie, 'A');
		const to = await createTask(cookie, 'B');
		await setPlan(email, 'max');
		process.env.MONETIZATION_ENFORCED = 'true';

		const { error } = await mcpCall(token, 'task_link', { taskId: from, dependsOnId: to });

		assert.ok(error, 'task_link muss einen JSON-RPC-Fehler liefern');
		assert.match(error.message, /ultimate/, 'Fehlertext muss das erforderliche Paket nennen');
		assert.doesNotMatch(error.message, /read access only/, 'kein generischer Nur-lese-Text mehr');
	});
});
