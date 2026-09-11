import { describe, it, before, beforeEach, after } from 'node:test';
import { findMcpTool } from './tools.js';
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

/** Legt eine Säule für den Cookie-Besitzer an und gibt ihre ID zurück (Setup für #1379). */
const createPillarViaApi = async (cookie: string, name: string): Promise<number> => {
	const res = await server.json('/pillars', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name }),
	});
	assert.equal(res.status, 201, 'Setup: Säule muss über die API anlegbar sein');
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

	it('der Klartext der gespiegelten Route erreicht den Client samt Statuscode', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		// Der Fehlervertrag der Routen ist `{ message }` (express/http-error.ts). Wurde stattdessen
		// `{ error }` gelesen, fiel JEDER Routen-Fehler auf einen generischen Ersatztext zurück — der
		// Client konnte nicht erfahren, welches Feld ihn scheitern ließ, und probierte blind herum.
		const created = await mcpCall<{ id: number }>(token, 'task_create', {
			title: 'Aufwand außerhalb der Skala',
			estimatedEffort: 5,
		});
		assert.ok(created.error, 'ein Aufwand außerhalb 0.1–1 muss fehlschlagen');
		assert.match(
			created.error.message,
			/estimatedEffort/,
			`Fehlertext muss das schuldige Feld nennen, war: ${created.error.message}`,
		);
		assert.match(
			created.error.message,
			/400/,
			`Fehlertext muss den Statuscode einordnen, war: ${created.error.message}`,
		);
	});

	it('ein nicht-JSON-Antwortkörper der gespiegelten Route meldet Status und Textanfang statt "Unexpected token"', async () => {
		// Antwortet nicht die Route, sondern etwas davor (Reverse Proxy, Express-Default-Handler mit
		// HTML-Fehlerseite), darf der Client keinen rohen `SyntaxError` sehen (tools.ts:47-56).
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response('<html><body>Bad Gateway</body></html>', { status: 502 })) as typeof fetch;
		try {
			const tool = findMcpTool('task_list');
			assert.ok(tool, 'Setup: task_list muss im Katalog existieren');
			await assert.rejects(
				tool!.run({ baseUrl: 'http://example.invalid', authorization: 'Bearer x' }, {}),
				(err: Error) => {
					assert.match(err.message, /HTTP 502/, `Fehlertext muss den Statuscode nennen, war: ${err.message}`);
					assert.match(
						err.message,
						/Bad Gateway/,
						`Fehlertext muss einen Ausschnitt des Fremdtexts enthalten, war: ${err.message}`,
					);
					assert.doesNotMatch(
						err.message,
						/Unexpected token/,
						`Fehlertext darf kein roher JSON-Parse-Fehler sein, war: ${err.message}`,
					);
					return true;
				},
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('task_create rechnet estimatedEffortHours in das Tage-Feld um und kappt an der Skala', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		// 1 Tag ≙ 14 h (openapi.yml) — 7 h sind ein halber Tag.
		const halbtags = await mcpCall<{ estimatedEffort: number }>(token, 'task_create', {
			title: 'Sieben Stunden',
			estimatedEffortHours: 7,
		});
		assert.equal(halbtags.result?.estimatedEffort, 0.5);

		// Die Skala endet bei einem Tag: alles darüber ist „ein voller Tag", kein Fehler.
		const ganztags = await mcpCall<{ estimatedEffort: number }>(token, 'task_create', {
			title: 'Drei Tage',
			estimatedEffortHours: 42,
		});
		assert.equal(ganztags.result?.estimatedEffort, 1);

		// Krumme Divisionen werden gerundet, damit die Aufwands-Spalte keine 17 Nachkommastellen zeigt.
		const krumm = await mcpCall<{ estimatedEffort: number }>(token, 'task_create', {
			title: 'Drei Stunden',
			estimatedEffortHours: 3,
		});
		assert.equal(krumm.result?.estimatedEffort, 0.21);
	});

	it('beide Aufwandsfelder zusammen schlagen fehl und legen nichts an', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const created = await mcpCall(token, 'task_create', {
			title: 'Widersprüchlicher Aufwand',
			estimatedEffort: 0.5,
			estimatedEffortHours: 3,
		});
		assert.ok(created.error, 'widersprüchliche Aufwandsangaben dürfen nicht still eine davon gewinnen lassen');

		const list = await mcpCall<{ title: string }[]>(token, 'task_list');
		assert.ok(!list.result?.some((t) => t.title === 'Widersprüchlicher Aufwand'));
	});

	it('task_update setzt den Status auf "In process"', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Wird angefangen');

		const updated = await mcpCall<{ status: string }>(token, 'task_update', { id: taskId, status: 'In process' });
		assert.equal(updated.result?.status, 'In process');
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

	// ── #1379: Säulenzuordnung über task_create/task_update ─────────────────────────────

	describe('#1379: pillars über task_create/task_update setzen', () => {
		type TaskWithPillars = { id: number; pillars: { pillarId: number; share: number; confidence: number }[] };

		it('AK1: task_create mit gültigem pillars-Array übernimmt die Beiträge (confidence-Default 100)', async () => {
			const cookie = await server.register('mcp-tools-a@example.com', 'password123');
			const token = await createToken(cookie);
			const koerper = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

			const created = await mcpCall<TaskWithPillars>(token, 'task_create', {
				title: 'Mit Säule über MCP',
				pillars: [{ pillarId: koerper, share: 100 }],
			});
			assert.equal(created.error, undefined, 'task_create mit gültigen pillars darf nicht fehlschlagen');
			assert.deepEqual(created.result?.pillars, [{ pillarId: koerper, share: 100, confidence: 100 }]);
		});

		it('AK1: task_create mit zwei Säulen und expliziter confidence übernimmt beide Beiträge', async () => {
			const cookie = await server.register('mcp-tools-a@example.com', 'password123');
			const token = await createToken(cookie);
			const koerper = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);
			const sinn = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

			const created = await mcpCall<TaskWithPillars>(token, 'task_create', {
				title: 'Zwei Säulen über MCP',
				pillars: [
					{ pillarId: koerper, share: 60, confidence: 80 },
					{ pillarId: sinn, share: 40 },
				],
			});
			assert.equal(created.error, undefined, 'task_create mit gültigen pillars darf nicht fehlschlagen');
			assert.deepEqual(created.result?.pillars, [
				{ pillarId: koerper, share: 60, confidence: 80 },
				{ pillarId: sinn, share: 40, confidence: 100 },
			]);
		});

		it('AK2: task_update ersetzt die Zuordnung vollständig, [] leert sie, fehlendes Feld lässt sie unverändert', async () => {
			const cookie = await server.register('mcp-tools-a@example.com', 'password123');
			const token = await createToken(cookie);
			const koerper = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);
			const sinn = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);
			const taskId = await createTaskViaApi(cookie, 'Für Update über MCP');

			const withA = await mcpCall<TaskWithPillars>(token, 'task_update', {
				id: taskId,
				pillars: [{ pillarId: koerper, share: 100 }],
			});
			assert.deepEqual(withA.result?.pillars, [{ pillarId: koerper, share: 100, confidence: 100 }]);

			const withB = await mcpCall<TaskWithPillars>(token, 'task_update', {
				id: taskId,
				pillars: [{ pillarId: sinn, share: 100 }],
			});
			assert.deepEqual(
				withB.result?.pillars,
				[{ pillarId: sinn, share: 100, confidence: 100 }],
				'task_update muss die bestehende Zuordnung vollständig ersetzen, nicht ergänzen',
			);

			const cleared = await mcpCall<TaskWithPillars>(token, 'task_update', { id: taskId, pillars: [] });
			assert.deepEqual(cleared.result?.pillars, [], 'pillars: [] muss alle Beiträge entfernen');

			const untouched = await mcpCall<TaskWithPillars>(token, 'task_update', { id: taskId, title: 'Umbenannt' });
			assert.deepEqual(
				untouched.result?.pillars,
				[],
				'task_update ohne pillars-Feld darf die (hier leere) Zuordnung nicht ändern',
			);
		});

		it('AK3: ungültige Anteilssumme wird abgelehnt, es entsteht keine Aufgabe', async () => {
			const cookie = await server.register('mcp-tools-a@example.com', 'password123');
			const token = await createToken(cookie);
			const koerper = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

			const before = await mcpCall<{ id: number; title: string }[]>(token, 'task_list');
			const countBefore = before.result?.length ?? 0;

			const created = await mcpCall(token, 'task_create', {
				title: 'Ungültige Summe',
				pillars: [{ pillarId: koerper, share: 50 }],
			});
			assert.ok(created.error, 'task_create mit Summe != 100 muss fehlschlagen');
			assert.match(created.error?.message ?? '', /Ungültige Säulen-Beiträge\..*\(HTTP 400\)/);

			const after = await mcpCall<{ id: number; title: string }[]>(token, 'task_list');
			assert.equal(after.result?.length, countBefore, 'ein abgelehnter task_create darf keine Aufgabe anlegen');
		});

		it('AK3: confidence außerhalb 0–100 wird abgelehnt', async () => {
			const cookie = await server.register('mcp-tools-a@example.com', 'password123');
			const token = await createToken(cookie);
			const koerper = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

			const created = await mcpCall(token, 'task_create', {
				title: 'Ungültige confidence',
				pillars: [{ pillarId: koerper, share: 100, confidence: 120 }],
			});
			assert.ok(created.error, 'task_create mit confidence > 100 muss fehlschlagen');
			assert.match(created.error?.message ?? '', /Ungültige Säulen-Beiträge\..*\(HTTP 400\)/);
		});

		it('AK3: eine fremde/unbekannte pillarId wird abgelehnt, die Aufgabe bleibt unverändert', async () => {
			const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
			const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
			const tokenA = await createToken(cookieA);
			const fremdeSaeule = await createPillarViaApi(cookieB, `Testsäule-${idCounter++}`);
			const taskId = await createTaskViaApi(cookieA, 'Für Fremdsäulen-Test');

			const updated = await mcpCall(tokenA, 'task_update', {
				id: taskId,
				pillars: [{ pillarId: fremdeSaeule, share: 100 }],
			});
			assert.ok(updated.error, 'task_update mit fremder pillarId muss fehlschlagen');
			assert.match(updated.error?.message ?? '', /pillars verweist auf eine nicht existierende Säule\..*\(HTTP 400\)/);

			const unchanged = await mcpCall<TaskWithPillars>(tokenA, 'task_update', { id: taskId, title: 'Umbenannt' });
			assert.deepEqual(unchanged.result?.pillars, [], 'ein abgelehnter task_update darf die Zuordnung nicht ändern');
		});

		it('AK4: tools/list deklariert pillars als array mit items-Objektschema für beide Werkzeuge', async () => {
			const cookie = await server.register('mcp-tools-a@example.com', 'password123');
			const token = await createToken(cookie);

			const tools = await mcpListTools(token);
			for (const name of ['task_create', 'task_update']) {
				const tool = tools.find((t) => t.name === name);
				assert.ok(tool, `${name} muss in tools/list enthalten sein`);
				const properties = (
					tool?.inputSchema as { properties?: Record<string, { type?: string; items?: unknown }> } | undefined
				)?.properties;
				const pillarsSchema = properties?.pillars;
				assert.equal(pillarsSchema?.type, 'array', `${name}.inputSchema.properties.pillars muss type "array" sein`);
				const items = pillarsSchema?.items as { properties?: Record<string, unknown> } | undefined;
				assert.ok(items?.properties, `${name}.inputSchema.properties.pillars.items muss ein Objektschema haben`);
				assert.ok(
					'pillarId' in (items?.properties ?? {}) &&
						'share' in (items?.properties ?? {}) &&
						'confidence' in (items?.properties ?? {}),
					`${name}.inputSchema.properties.pillars.items.properties muss pillarId, share, confidence führen`,
				);
			}

			// Der eingefrorene Namens-Snapshot (AK7, #1381) muss unverändert grün bleiben.
			const names = tools.map((t) => t.name).sort();
			assert.ok(names.includes('task_create') && names.includes('task_update'));
		});
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

	it('task_link ohne dependsOnId nennt den fehlenden Schlüssel und verknüpft nichts', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		await createTaskViaApi(cookie, 'Kapitel schreiben');

		// Verknüpft wird ausschließlich über IDs (Titel-Auflösung zurückgebaut): ein Aufruf mit einem
		// Titel statt einer ID muss sagen, welcher Schlüssel fehlt, statt still nichts zu tun.
		const linked = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnTitle: 'Kapitel schreiben' });
		assert.ok(linked.error, 'ohne dependsOnId muss task_link fehlschlagen');
		assert.match(
			linked.error.message,
			/dependsOnId/,
			`Fehlertext muss den fehlenden Schlüssel nennen, war: ${linked.error.message}`,
		);

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(links.result?.dependsOn, [], 'ein abgebrochener Aufruf darf keine Kante hinterlassen');
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

	// Rote Spec-Tests für #1381 (Spec docs/spec/issue-1381.md) — group_list/group_members_list.
	type GroupDto = { id: number; name: string; role: string; memberCount: number };
	type MemberDto = { userId: number; displayName: string; role: string };

	const createGroupViaApi = async (cookie: string, name: string): Promise<GroupDto> => {
		const res = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name }),
		});
		assert.equal(res.status, 201, 'Setup: Gruppe muss über die API anlegbar sein');
		return (await res.json()) as GroupDto;
	};

	/** Legt eine Einladung an und lässt sie vom eingeladenen Konto annehmen. */
	const inviteAndAccept = async (
		adminCookie: string,
		groupId: number,
		invitedUserId: number,
		invitedCookie: string,
	): Promise<void> => {
		const invited = await server.json(`/groups/${groupId}/invitations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
			body: JSON.stringify({ userId: invitedUserId }),
		});
		assert.equal(invited.status, 201, 'Setup: Einladung muss anlegbar sein');
		const { id } = (await invited.json()) as { id: number };
		const accepted = await server.json(`/invitations/${id}/accept`, {
			method: 'POST',
			headers: { Cookie: invitedCookie },
		});
		assert.equal(accepted.status, 200, 'Setup: Einladung muss annehmbar sein');
	};

	/** Ermittelt die eigene userId über einen Suchtreffer auf den eigenen displayName. */
	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await server.json(`/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { Cookie: cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

	it('AK1: group_list liefert genau die Nutzlast von GET /groups', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		await createGroupViaApi(cookie, 'Familie');
		await createGroupViaApi(cookie, 'Team');

		const direct = await server.json('/groups', { headers: { Cookie: cookie } });
		const expected = (await direct.json()) as GroupDto[];

		const viaTool = await mcpCall<GroupDto[]>(token, 'group_list');
		assert.deepEqual(viaTool.result, expected, 'group_list muss die Route 1:1 spiegeln');
		assert.equal(viaTool.result?.length, 2);
	});

	it('AK2: group_members_list liefert genau die Nutzlast von GET /groups/:id/members', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const group = await createGroupViaApi(cookieA, 'Familie');
		const bobId = await ownUserId(cookieB, 'mcp-tools-b@example.com');
		await inviteAndAccept(cookieA, group.id, bobId, cookieB);

		const direct = await server.json(`/groups/${group.id}/members`, { headers: { Cookie: cookieA } });
		const expected = (await direct.json()) as MemberDto[];
		assert.equal(expected.length, 2, 'Vorbedingung: zwei Mitglieder nach dem Beitritt');

		const viaTool = await mcpCall<MemberDto[]>(tokenA, 'group_members_list', { groupId: group.id });
		assert.deepEqual(viaTool.result, expected, 'group_members_list muss die Route 1:1 spiegeln');
	});

	it('AK3: group_members_list auf eine fremde Gruppe liefert einen JSON-RPC-Fehler statt Daten', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const groupOfB = await createGroupViaApi(cookieB, 'Nur Bob');

		const res = await mcpCall<MemberDto[]>(tokenA, 'group_members_list', { groupId: groupOfB.id });
		assert.equal(res.result, undefined, 'fremde Gruppe darf keine Mitgliederdaten liefern');
		assert.match(res.error?.message ?? '', /Gruppe nicht gefunden\./);
		assert.match(res.error?.message ?? '', /HTTP 404/);
	});

	it('AK4: group_members_list ohne bzw. mit ungültiger groupId schlägt fehl, ohne einen Loopback abzusetzen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const missing = await mcpCall<MemberDto[]>(token, 'group_members_list', {});
		assert.ok(missing.error, 'fehlende groupId muss fehlschlagen');
		assert.match(missing.error!.message, /groupId/);

		const zero = await mcpCall<MemberDto[]>(token, 'group_members_list', { groupId: 0 });
		assert.ok(zero.error, 'groupId 0 muss fehlschlagen');
		assert.match(zero.error!.message, /groupId/);

		const asString = await mcpCall<MemberDto[]>(token, 'group_members_list', { groupId: '5' });
		assert.ok(asString.error, 'groupId als String muss fehlschlagen');
		assert.match(asString.error!.message, /groupId/);
	});

	it('AK5: group_list und group_members_list funktionieren mit einem Nur-lese-Token', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);
		const group = await createGroupViaApi(cookie, 'Familie');

		const list = await mcpCall<GroupDto[]>(token, 'group_list');
		assert.ok(list.result, 'group_list muss mit scope read ein Ergebnis liefern');
		assert.equal(list.error, undefined);

		const members = await mcpCall<MemberDto[]>(token, 'group_members_list', { groupId: group.id });
		assert.ok(members.result, 'group_members_list muss mit scope read ein Ergebnis liefern');
		assert.equal(members.error, undefined);
	});

	it('AK6: group_list von A enthält keine Gruppe, in der nur B Mitglied ist', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		await createGroupViaApi(cookieA, 'Von A');
		const groupOfB = await createGroupViaApi(cookieB, 'Von B');

		const list = await mcpCall<GroupDto[]>(tokenA, 'group_list');
		assert.ok(Array.isArray(list.result), `group_list muss ein Ergebnis liefern, Fehler: ${list.error?.message}`);
		assert.ok(!list.result?.some((g) => g.id === groupOfB.id), 'fremde Gruppe darf in group_list nicht sichtbar sein');
	});

	it('AK7: der v1-Werkzeugvertrag wächst um group_list/group_members_list auf zwölf Namen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
		const names = sorted.map((t) => t.name);

		assert.deepEqual(names, [
			'category_list',
			'group_list',
			'group_members_list',
			'next_task',
			'pillar_list',
			'task_complete',
			'task_create',
			'task_link',
			'task_links',
			'task_list',
			'task_unlink',
			'task_update',
		]);
		for (const tool of sorted) {
			assert.ok(tool.inputSchema, `${tool.name} muss ein inputSchema deklarieren`);
		}
	});
});
