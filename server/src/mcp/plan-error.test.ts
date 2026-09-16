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

	// Test-Pflege (#1460): `createToken()` liefert seit T5 einen Token, der bei jedem Paket ohne
	// `mcp_readwrite` (alle außer `ultimate`) am Werkzeug selbst (mcp/server.ts) abgewiesen wird,
	// bevor der Loopback-Request die tool-eigene `graph_write`-Prüfung überhaupt erreicht — der
	// generische Scope-Deckel aus #1460 tritt vor die spezifischere Feature-Prüfung aus #1457.
	// Für `free` war das schon vorher blockiert (fehlt beides), nur der Fehlertext nennt jetzt
	// `mcp_readwrite`/`ultimate` statt `graph_write`/`max`.
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
			assert.match(error.message, /ultimate/, 'Fehlertext muss das erforderliche Paket nennen');
			assert.doesNotMatch(error.message, /HTTP 403/, 'kein nacktes „HTTP 403" mehr');
		});
	}
});

/**
 * #1524 AK4/AK5 (Spec docs/spec/issue-1524.md) — `mcp_read` deckelt JEDEN lesenden MCP-Loopback ab
 * `max`. Ersetzt die beiden Tests oben (Test-Pflege: `task_links (Leseoperation) bleibt für
 * free-Nutzer erfolgreich` und `group_list (Leseoperation) bleibt für free-Nutzer erfolgreich
 * (AK4)`), die #1524 AK4 direkt widersprechen — #1457 AK4 galt nur für die dort geprüften
 * `graph_write`-Werkzeuge, nicht für einen paketweiten Lese-Deckel. Rot, bis der `mcp_read`-Guard
 * existiert (heute: `task_links`/`group_list` liefern für `free` weiterhin ein Ergebnis).
 */
describe('MCP-Loopback — Plan-Deckel für lesende Werkzeuge (#1524 AK4/AK5)', () => {
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

	for (const tool of ['task_links', 'group_list'] as const) {
		it(`${tool}: ein free-Nutzer erhält einen JSON-RPC-Fehler, der max und mcp_read nennt (AK4)`, async () => {
			const email = `mcp-plan-read-${tool}@example.com`;
			const cookie = await server.register(email);
			const token = await createToken(cookie);
			const taskId = await createTask(cookie, 'A');
			await setPlan(email, 'free');
			process.env.MONETIZATION_ENFORCED = 'true';

			const { error, text } = await mcpCall(token, tool, tool === 'task_links' ? { taskId } : {});

			assert.ok(error, `${tool} muss einen JSON-RPC-Fehler liefern`);
			assert.match(error.message, /max/, 'Fehlertext muss das erforderliche Paket nennen');
			assert.equal(text, undefined, `${tool} darf bei Ablehnung kein Ergebnis liefern`);
		});

		it(`${tool}: ein max-Nutzer erhält weiterhin ein Ergebnis (AK5, keine Regression)`, async () => {
			const email = `mcp-plan-read-ok-${tool}@example.com`;
			const cookie = await server.register(email);
			const token = await createToken(cookie);
			const taskId = await createTask(cookie, 'A');
			await setPlan(email, 'max');
			process.env.MONETIZATION_ENFORCED = 'true';

			const { error, text } = await mcpCall(token, tool, tool === 'task_links' ? { taskId } : {});

			assert.equal(error, undefined, `${tool} darf für max nicht am Paket scheitern`);
			assert.ok(text, `${tool} muss ein Ergebnis liefern`);
		});
	}
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
