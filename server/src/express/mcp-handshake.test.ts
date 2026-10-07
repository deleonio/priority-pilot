import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Handshake-Test für #1353 — `/mcp/v1` aus Sicht eines **echten** MCP-Clients.
 *
 * `mcp-auth.test.ts` deckt Auth und Werkzeugliste mit handgerolltem JSON-RPC ab; dieser Test
 * fährt denselben Endpunkt mit dem offiziellen `@modelcontextprotocol/sdk`-Client — der Referenz-
 * Implementierung, an der sich externe Connectoren (Claude, Cline, …) orientieren. Er validiert
 * damit den kompletten Weg `initialize` → `tools/list` → `tools/call` inklusive Protokoll-Details
 * (Accept-Header, Ergebnis-Schema), die ein roher Fetch nicht sieht.
 *
 * Läuft in der Server-Suite (Coverage-Gate-Step von Verify) gegen einen lokal gestarteten Server
 * mit In-Memory-DB — kein Deployment-, kein Secret-Bezug.
 */

process.env.GOOGLE_ALLOWED_EMAILS = 'mcp-h@example.com,mcp-h-1413@example.com,mcp-h-1935@example.com';
applyTestAuthEnv('mcp-handshake-test');

let server: TestServer;

const createToken = async (cookie: string, name = 'MCP-SDK-Client'): Promise<string> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name, expiresInDays: 365 }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	return ((await res.json()) as { token: string }).token;
};

/** Verbindet einen SDK-Client Bearer-authentifiziert mit dem lokalen MCP-Endpunkt. */
const connectClient = async (token: string, path = '/mcp/v1'): Promise<Client> => {
	const client = new Client({ name: 'mcp-handshake-test', version: '1.0.0' });
	const transport = new StreamableHTTPClientTransport(new URL(`${server.baseUrl}${path}`), {
		requestInit: { headers: { Authorization: `Bearer ${token}` } },
	});
	await client.connect(transport);
	return client;
};

describe('MCP-Endpunkt /mcp/v1 — Handshake mit SDK-Client (#1353)', () => {
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

	it('initialize-Handshake meldet priority-pilot-mcp-v1', async () => {
		const cookie = await server.register('mcp-h@example.com', 'password123');
		const token = await createToken(cookie);

		const client = await connectClient(token);
		try {
			// `connect()` selbst prueft die Protokollversion implizit — eine vom Client nicht
			// unterstuetzte Version wirft bereits beim Handshake. Der Name hier spiegelt serverInfo.
			const serverInfo = client.getServerVersion();
			assert.equal(serverInfo?.name, 'priority-pilot-mcp-v1');
		} finally {
			await client.close().catch(() => {});
		}
	});

	it('tools/list liefert alle sieben v1-Werkzeuge', async () => {
		const cookie = await server.register('mcp-h@example.com', 'password123');
		const token = await createToken(cookie);

		const client = await connectClient(token);
		try {
			const { tools } = await client.listTools();
			const names = tools.map((tool) => tool.name);
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
		} finally {
			await client.close().catch(() => {});
		}
	});

	// Regression zu #1358: eine mit Schrägstrich konfigurierte Endpunkt-URL bedient derselbe Router,
	// die Rechtestufen-Ausnahme verglich den Pfad aber exakt — der Handshake scheiterte seitdem für
	// jedes Nur-lese-Token (und das sind nach der Migration alle Bestands-Tokens) an einer 403.
	it('#1413 AK1: tools/list enthält den erwartenden Katalog (Säulen-CRUD-Werkzeuge seit #1573 entfallen)', async () => {
		const cookie = await server.register('mcp-h-1413@example.com', 'password123');
		const token = await createToken(cookie);

		const client = await connectClient(token);
		try {
			const { tools } = await client.listTools();
			const names = tools.map((tool) => tool.name).sort();
			assert.equal(names.length, 33, `Katalog sollte dreiunddreißig Namen führen, war: ${names.join(', ')}`);
			for (const expected of [
				'task_list',
				'task_create',
				'task_update',
				'task_complete',
				'task_delete',
				'task_link',
				'task_unlink',
				'task_links',
				'next_task',
				'pillar_list',
				'balance_status',
				'category_list',
				'category_create',
				'category_update',
				'category_delete',
				'feedback_send',
				'group_create',
				'group_delete',
				'group_list',
				'group_member_remove',
				'group_member_role_set',
				'group_members_list',
				'group_update',
				'pillar_weights_set',
			]) {
				assert.ok(names.includes(expected), `erwartete Werkzeug "${expected}" in ${JSON.stringify(names)}`);
			}
		} finally {
			await client.close().catch(() => {});
		}
	});

	it('#1358: der Handshake gelingt auch, wenn die Endpunkt-URL auf einen Schrägstrich endet', async () => {
		const cookie = await server.register('mcp-h@example.com', 'password123');
		const token = await createToken(cookie);

		const client = await connectClient(token, '/mcp/v1/');
		try {
			assert.equal(client.getServerVersion()?.name, 'priority-pilot-mcp-v1');
			const { tools } = await client.listTools();
			assert.ok(
				tools.some((tool) => tool.name === 'task_list'),
				'tools/list muss auch über die Slash-Variante antworten',
			);
		} finally {
			await client.close().catch(() => {});
		}
	});

	// #1358: ein Nur-lese-Token darf am Werkzeug scheitern — aber als JSON-RPC-Fehler, den der
	// Client anzeigen kann, nicht als HTTP-403, die der Transport als Verbindungsabbruch meldet.
	it('#1358: ein schreibendes Werkzeug meldet mit Nur-lese-Token einen lesbaren Werkzeugfehler', async () => {
		const cookie = await server.register('mcp-h@example.com', 'password123');
		const token = await createToken(cookie);

		const client = await connectClient(token);
		try {
			await assert.rejects(
				() => client.callTool({ name: 'task_create', arguments: { title: 'Mit Nur-lese-Token' } }),
				/read access only/,
			);
			// Die Verbindung überlebt die Ablehnung — der Client bleibt benutzbar.
			const list = await client.callTool({ name: 'task_list', arguments: {} });
			assert.ok(Array.isArray(list.content), 'lesende Werkzeuge bleiben nach der Ablehnung nutzbar');
		} finally {
			await client.close().catch(() => {});
		}
	});

	it('tools/call pillar_list antwortet mit spec-konformem CallToolResult', async () => {
		const cookie = await server.register('mcp-h@example.com', 'password123');
		const token = await createToken(cookie);

		const client = await connectClient(token);
		try {
			const result = await client.callTool({ name: 'pillar_list', arguments: {} });
			assert.ok(Array.isArray(result.content), 'content muss ein Content-Block-Array sein');
			const first = result.content[0];
			assert.ok(first && first.type === 'text', 'erster Content-Block muss vom Typ "text" sein');
			const pillars: unknown = JSON.parse((first as { type: 'text'; text: string }).text);
			assert.ok(Array.isArray(pillars), 'pillar_list-Payload muss ein Array sein');
		} finally {
			await client.close().catch(() => {});
		}
	});
});

/**
 * #1935 (Spec docs/spec/issue-1935.md) — Dialog-Vorgaben im `initialize`-Handshake.
 * Rot, bis `initialize` `result.instructions` liefert (AK2); AK3/AK4 sichern den Bestand ab.
 */
describe('MCP-Endpunkt /mcp/v1 — Dialog-Vorgaben (#1935)', () => {
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

	// Test-Pflege #1935: `Record<string, any>` → `RpcBody` (Lint `no-explicit-any`, Verhalten unverändert).
	type RpcBody = { result: Record<string, unknown>; error?: { message?: string } };
	const rpc = async (token: string, method: string, params: unknown = {}): Promise<RpcBody> => {
		const res = await fetch(`${server.baseUrl}/mcp/v1`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
		});
		return (await res.json()) as RpcBody;
	};

	const setInstructions = async (cookie: string, instructions: string): Promise<void> => {
		const res = await server.json('/mcp-instructions', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ instructions }),
		});
		assert.equal(res.status, 200, 'Setup: Vorgaben müssen speicherbar sein');
	};

	it('AK2: initialize liefert result.instructions mit dem gespeicherten Text', async () => {
		const cookie = await server.register('mcp-h-1935@example.com', 'password123');
		const token = await createToken(cookie);
		await setInstructions(cookie, 'Antworte kurz und knapp.');

		const body = await rpc(token, 'initialize', {
			protocolVersion: '2025-06-18',
			capabilities: {},
			clientInfo: { name: 't', version: '1' },
		});
		assert.equal(body.result.instructions, 'Antworte kurz und knapp.');
	});

	it('AK3: ohne Vorgaben (oder nach dem Löschen) fehlt der instructions-Schlüssel', async () => {
		const cookie = await server.register('mcp-h-1935@example.com', 'password123');
		const token = await createToken(cookie);
		const init = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } };

		const before = await rpc(token, 'initialize', init);
		assert.ok(before.result, 'initialize muss ein Ergebnis liefern');
		assert.equal('instructions' in before.result, false);

		await setInstructions(cookie, 'Temporär');
		await setInstructions(cookie, '');
		const after = await rpc(token, 'initialize', init);
		assert.deepEqual(after.result, before.result);
	});

	it('AK4: Vorgaben ändern weder tools/list noch das Rechte-Gate eines Read-Tokens', async () => {
		const cookie = await server.register('mcp-h-1935@example.com', 'password123');
		const token = await createToken(cookie);
		const listBefore = await rpc(token, 'tools/list');

		await setInstructions(cookie, 'Antworte kurz und knapp.');

		assert.deepEqual(await rpc(token, 'tools/list'), listBefore);
		const denied = await rpc(token, 'tools/call', { name: 'task_create', arguments: { title: 'x' } });
		assert.match(denied.error?.message ?? '', /writes data, but this token allows read access only/);
	});
});
