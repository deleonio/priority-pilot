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

/** Rückgabe von `task_links`: die Nachbarn einer Aufgabe in beide Richtungen, je mit Kantengewicht. */
type TaskLinks = {
	id: number;
	title: string;
	dependsOn: { id: number; title: string; weight: number }[];
	requiredBy: { id: number; title: string; weight: number }[];
};

// Test-Pflege (#1356): Diese Tests aus #1353 prüfen die Werkzeug-Spiegelung (task_create/
// task_update), nicht die Rechtestufe — seit #1356 startet ein neuer Token aber immer als
// `scope: "read"` (AK2) und würde die schreibenden Aufrufe hier sonst mit 403 blockieren. Das
// Hochstufen auf `readwrite` gehört daher zum Setup dieses generischen Helpers; die dedizierten
// Scope-Tests unten nutzen bewusst `createReadOnlyToken` statt dieser Funktion.
const createToken = async (cookie: string): Promise<string> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: `Client-${idCounter++}`, expiresInDays: 365 }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	const { id, token } = (await res.json()) as { id: number; token: string };
	const patched = await server.json(`/api-tokens/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ scope: 'readwrite' }),
	});
	assert.equal(patched.status, 200, 'Setup: Hochstufen auf readwrite muss gelingen');
	return token;
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
	const body = (await res.json()) as {
		result?: { content?: { type: string; text: string }[] };
		error?: { message: string };
	};
	// CallToolResult-Envelope auflösen: das Roh-Payload reist als JSON-Text im ersten Text-Block
	// (server/src/mcp/server.ts) — die AK-Assertions sehen weiterhin das Payload selbst.
	const text = body.result?.content?.[0]?.text;
	return {
		result: text === undefined ? undefined : (JSON.parse(text) as T),
		error: body.error,
	};
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

const createReadOnlyToken = async (cookie: string): Promise<{ id: number; token: string }> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: `Client-${idCounter++}`, expiresInDays: 365 }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	const body = (await res.json()) as { id: number; token: string; scope?: string };
	assert.equal(body.scope, 'read', 'Vorbedingung: ein neu angelegter Token startet als read');
	return { id: body.id, token: body.token };
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
			[
				'category_list',
				'next_task',
				'pillar_list',
				'task_complete',
				'task_create',
				'task_link',
				'task_links',
				'task_list',
				'task_unlink',
				'task_update',
			],
			'v1-Werkzeugnamen sind ab dem Merge eingefroren (AK8) — eine unbeabsichtigte Änderung muss diesen Test rot machen',
		);
		for (const tool of sorted) {
			assert.ok(tool.inputSchema, `${tool.name} muss ein inputSchema deklarieren`);
		}
	});

	it('AK6 (#1356): ein Nur-lese-Token liest über task_list, task_create schlägt fehl und legt nichts an', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);
		await createTaskViaApi(cookie, 'Über Session angelegt');

		const list = await mcpCall<{ title: string }[]>(token, 'task_list');
		assert.ok(
			list.result?.some((t) => t.title === 'Über Session angelegt'),
			'lesende Werkzeuge bleiben mit scope read erreichbar',
		);

		const created = await mcpCall<{ id: number }>(token, 'task_create', { title: 'Über MCP mit Nur-lese-Token' });
		assert.ok(created.error, 'task_create muss mit einem Nur-lese-Token fehlschlagen');
		// #1358: der Fehler muss sagen, was zu tun ist — ein durchgereichtes „403" aus der
		// gespiegelten Route erreicht den Nutzer im MCP-Client sonst als Text ohne Handlungshinweis.
		assert.match(
			created.error.message,
			/nur lesenden Zugriff/,
			`Fehlertext muss die Rechtestufe benennen, war: ${created.error.message}`,
		);
		assert.match(
			created.error.message,
			/Lesen und Schreiben/,
			`Fehlertext muss den Ausweg nennen, war: ${created.error.message}`,
		);

		const afterFailedCreate = await mcpCall<{ title: string }[]>(token, 'task_list');
		assert.ok(
			!afterFailedCreate.result?.some((t) => t.title === 'Über MCP mit Nur-lese-Token'),
			'ein fehlgeschlagener task_create darf keine Aufgabe anlegen',
		);
	});

	it('AK6 (#1356): nach dem Umschalten auf readwrite gelingt task_create mit demselben Token', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const { id, token } = await createReadOnlyToken(cookie);

		const patch = await server.json(`/api-tokens/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ scope: 'readwrite' }),
		});
		assert.equal(patch.status, 200, 'Setup: Umschalten auf readwrite muss gelingen');

		const created = await mcpCall<{ id: number; title: string }>(token, 'task_create', {
			title: 'Nach Hochstufen über MCP',
		});
		assert.equal(created.result?.title, 'Nach Hochstufen über MCP');
	});

	it('task_link setzt das Gewicht, task_links zeigt beide Richtungen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		const linked = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0.8 });
		assert.ok(!linked.error, `task_link sollte gelingen, war: ${linked.error?.message}`);

		const parentLinks = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(parentLinks.result?.dependsOn, [{ id: childId, title: 'Kapitel schreiben', weight: 0.8 }]);
		assert.deepEqual(parentLinks.result?.requiredBy, []);

		const childLinks = await mcpCall<TaskLinks>(token, 'task_links', { taskId: childId });
		assert.deepEqual(childLinks.result?.requiredBy, [{ id: parentId, title: 'Projekt abschließen', weight: 0.8 }]);
	});

	it('task_link ohne Gewichtsangabe legt die Kante mit dem Standardwert 1 an', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId });

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.equal(links.result?.dependsOn[0]?.weight, 1);
	});

	it('task_link mit Gewicht 0 bleibt beim Auslesen 0', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0 });

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.equal(links.result?.dependsOn[0]?.weight, 0);
	});

	it('task_link auf einer bestehenden Kante ändert nur das Gewicht', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0.8 });
		await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0.3 });

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.equal(links.result?.dependsOn.length, 1, 'ein zweiter Aufruf darf keine zweite Kante anlegen');
		assert.equal(links.result?.dependsOn[0]?.weight, 0.3);
	});

	it('task_unlink löst die Verknüpfung wieder', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');
		await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId });

		const unlinked = await mcpCall(token, 'task_unlink', { taskId: parentId, dependsOnId: childId });
		assert.ok(!unlinked.error, `task_unlink sollte gelingen, war: ${unlinked.error?.message}`);

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(links.result?.dependsOn, []);
	});

	it('beide Enden lassen sich über den Titel statt über die ID benennen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		const linked = await mcpCall(token, 'task_link', {
			taskTitle: 'Projekt abschließen',
			dependsOnTitle: 'Kapitel schreiben',
			weight: 0.8,
		});
		assert.ok(!linked.error, `Titel-Auflösung sollte gelingen, war: ${linked.error?.message}`);

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(links.result?.dependsOn, [{ id: childId, title: 'Kapitel schreiben', weight: 0.8 }]);
	});

	it('ein mehrdeutiger Titel bricht mit der Trefferliste ab und verknüpft nichts', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const firstId = await createTaskViaApi(cookie, 'Bericht schreiben');
		const secondId = await createTaskViaApi(cookie, 'Bericht prüfen');

		const linked = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnTitle: 'Bericht' });
		assert.ok(linked.error, 'ein mehrdeutiger Titel muss fehlschlagen');
		assert.match(linked.error.message, new RegExp(`${firstId}`), 'der Fehler muss die Treffer-IDs nennen');
		assert.match(linked.error.message, new RegExp(`${secondId}`), 'der Fehler muss die Treffer-IDs nennen');

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(links.result?.dependsOn, [], 'ein abgebrochener Aufruf darf keine Kante hinterlassen');
	});

	it('ein Titel ohne Treffer bricht ab und verknüpft nichts', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');

		const linked = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnTitle: 'Gibt es nicht' });
		assert.ok(linked.error, 'ein Titel ohne Treffer muss fehlschlagen');

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(links.result?.dependsOn, []);
	});

	it('eine Verknüpfung, die einen Zyklus erzeugen würde, wird abgelehnt', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const firstId = await createTaskViaApi(cookie, 'Erste Aufgabe');
		const secondId = await createTaskViaApi(cookie, 'Zweite Aufgabe');
		await mcpCall(token, 'task_link', { taskId: firstId, dependsOnId: secondId });

		const cyclic = await mcpCall(token, 'task_link', { taskId: secondId, dependsOnId: firstId });
		assert.ok(cyclic.error, 'die Gegenrichtung schließt den Kreis und muss fehlschlagen');
	});

	it('eine Verknüpfung zu einer fremden Aufgabe schlägt fehl', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const ownId = await createTaskViaApi(cookieA, 'Eigene Aufgabe');
		const foreignId = await createTaskViaApi(cookieB, 'Fremde Aufgabe');

		const linked = await mcpCall(tokenA, 'task_link', { taskId: ownId, dependsOnId: foreignId });
		assert.ok(linked.error, 'eine fremde Aufgabe darf nicht verknüpfbar sein');

		const links = await mcpCall<TaskLinks>(tokenA, 'task_links', { taskId: ownId });
		assert.deepEqual(links.result?.dependsOn, []);
	});

	it('ein Nur-lese-Token liest task_links, scheitert aber an task_link und task_unlink', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const writeToken = await createToken(cookie);
		const { token: readToken } = await createReadOnlyToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');
		await mcpCall(writeToken, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0.8 });

		const links = await mcpCall<TaskLinks>(readToken, 'task_links', { taskId: parentId });
		assert.equal(links.result?.dependsOn[0]?.weight, 0.8, 'lesen bleibt mit scope read erlaubt');

		const linked = await mcpCall(readToken, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0.1 });
		assert.ok(linked.error, 'task_link muss mit einem Nur-lese-Token fehlschlagen');

		const unlinked = await mcpCall(readToken, 'task_unlink', { taskId: parentId, dependsOnId: childId });
		assert.ok(unlinked.error, 'task_unlink muss mit einem Nur-lese-Token fehlschlagen');

		const unchanged = await mcpCall<TaskLinks>(writeToken, 'task_links', { taskId: parentId });
		assert.deepEqual(unchanged.result?.dependsOn, [{ id: childId, title: 'Kapitel schreiben', weight: 0.8 }]);
	});
});
