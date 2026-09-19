import { describe, it, before, beforeEach, after } from 'node:test';
import { findMcpTool } from './tools.js';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { CATEGORY_COLORS } from '../models/categoryColors.js';
import { ScoreEntry } from '../models/index.js';

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

process.env.GOOGLE_ALLOWED_EMAILS =
	'mcp-tools-a@example.com,mcp-tools-b@example.com,mcp-tools-c@example.com,mcp-tools-balance-a@example.com,' +
	'mcp-tools-balance-b@example.com,mcp-tools-balance-c@example.com,mcp-tools-balance-d-a@example.com,' +
	'mcp-tools-balance-d-b@example.com,mcp-tools-pillar-a@example.com,mcp-tools-pillar-b@example.com,' +
	'mcp-tools-history-a@example.com,mcp-tools-history-b@example.com,mcp-tools-history-c@example.com';
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

/**
 * Gibt eine id aus dem Säulen-Bestand des Cookie-Besitzers zurück (Setup für #1379/#1413).
 * Seit #1573 ist Säulen-CRUD gesperrt — die Registrierung sät fünf feste Standard-Säulen; statt
 * anzulegen, zyklisch durch diesen Bestand gehen (aufeinanderfolgende Aufrufe: unterschiedliche ids).
 */
let seedPillarCursor = 0;
const createPillarViaApi = async (cookie: string, _name: string): Promise<number> => {
	const res = await server.json('/pillars', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'Setup: Säulen müssen über die API lesbar sein');
	const pillars = (await res.json()) as { id: number }[];
	assert.ok(pillars.length > 1, 'Setup: Registrierung sollte fünf Standard-Säulen säen');
	return pillars[seedPillarCursor++ % pillars.length]!.id;
};

/**
 * Baut die vollständige Gewichtsliste für pillar_weights_set: jede Registrierung sät 5
 * Standard-Säulen (SEED_PILLARS), die Route verlangt exakte ID-Abdeckung aller Säulen des
 * Nutzers. Seed-Säulen ohne expliziten Wert bekommen Gewicht 0.
 */
const weightsForAllPillars = async (
	token: string,
	overrides: Record<number, number>,
): Promise<{ id: number; weight: number }[]> => {
	const list = await mcpCall<PillarResult[]>(token, 'pillar_list');
	return (list.result ?? []).map((p) => ({ id: p.id, weight: overrides[p.id] ?? 0 }));
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

	it('#1438 AK8: task_update mit inhaltlichem Feld auf einer erledigten Aufgabe schlägt fehl, Reopen per task_update bleibt möglich', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Wird erledigt');

		const completed = await mcpCall<{ id: number; status: string }>(token, 'task_complete', { id: taskId });
		assert.equal(completed.result?.status, 'Done', 'Setup: Aufgabe muss zuerst erledigt sein');

		const blocked = await mcpCall<{ id: number; title: string }>(token, 'task_update', {
			id: taskId,
			title: 'Sollte nicht durchgehen',
		});
		assert.ok(blocked.error, 'eine inhaltliche Änderung ohne Statuswechsel muss an einer erledigten Aufgabe scheitern');

		const reopened = await mcpCall<{ id: number; status: string }>(token, 'task_update', {
			id: taskId,
			status: 'Open',
		});
		assert.equal(reopened.result?.status, 'Open', 'Reopen per task_update muss weiterhin funktionieren');
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
			/read access only/,
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

	// #1429: Der gültige Bereich für weight ist 0,1 bis 1 (bisher nur >= 0 geprüft). Ersetzt den
	// alten Test „mit Gewicht 0 bleibt beim Auslesen 0" (Test-Pflege-Bedarf) — 0 gilt jetzt als
	// außerhalb des Bereichs und muss fehlschlagen, statt gespeichert zu werden.
	it('task_link mit Gewicht außerhalb 0,1–1 (0, 0.05, 1.1) schlägt fehl und nennt den Bereich', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		for (const weight of [0, 0.05, 1.1]) {
			const linked = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight });
			assert.ok(linked.error, `weight=${weight} sollte fehlschlagen`);
			assert.match(linked.error!.message, /0\.1/);
		}

		const links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.deepEqual(links.result?.dependsOn, [], 'keine der abgelehnten Kanten darf angelegt worden sein');
	});

	it('task_link mit Gewicht an den Grenzen 0,1 und 1 gelingt', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const parentId = await createTaskViaApi(cookie, 'Projekt abschließen');
		const childId = await createTaskViaApi(cookie, 'Kapitel schreiben');

		const low = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 0.1 });
		assert.ok(!low.error, `weight=0.1 sollte gelingen, war: ${low.error?.message}`);
		let links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.equal(links.result?.dependsOn[0]?.weight, 0.1);

		const high = await mcpCall(token, 'task_link', { taskId: parentId, dependsOnId: childId, weight: 1 });
		assert.ok(!high.error, `weight=1 sollte gelingen, war: ${high.error?.message}`);
		links = await mcpCall<TaskLinks>(token, 'task_links', { taskId: parentId });
		assert.equal(links.result?.dependsOn[0]?.weight, 1);
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

	it('AK1 (#1423): der v1-Werkzeugvertrag wächst um balance_status auf achtzehn Namen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
		const names = sorted.map((t) => t.name);

		assert.deepEqual(names, [
			'balance_history',
			'balance_status',
			'category_create',
			'category_delete',
			'category_list',
			'category_update',
			// #1542: die drei Gruppen-Schreibwerkzeuge kommen alphabetisch vor/hinter group_list.
			'group_create',
			'group_delete',
			// #1544: die beiden Gruppen-Einladungswerkzeuge kommen alphabetisch vor group_list.
			'group_invitation_create',
			'group_invitation_list',
			'group_list',
			// #1543: die beiden Mitglieder-Werkzeuge kommen alphabetisch vor group_members_list.
			'group_member_remove',
			'group_member_role_set',
			'group_members_list',
			'group_update',
			// #1544: die persönlichen Einladungs- und Einladungslink-Werkzeuge vor next_task.
			'invitation_accept',
			'invitation_decline',
			'invitation_list',
			'invite_link_create',
			'invite_link_delete',
			'next_task',
			'pillar_list',
			'pillar_weights_set',
			'task_complete',
			'task_create',
			'task_delete',
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

/**
 * Rote Spec-Tests für #1396 (Spec docs/spec/issue-1396.md) — task_delete.
 *
 * AK1: Katalog-Snapshot wächst auf dreizehn Namen inkl. task_delete.
 * AK2: readwrite-Token löscht eine eigene Aufgabe endgültig.
 * AK3: fremde Aufgabe löschen → JSON-RPC-Fehler mit HTTP 404, Aufgabe bleibt beim Eigentümer.
 * AK4: Nur-lese-Token → Scope-Fehlertext, Aufgabe bleibt erhalten.
 * AK5: fehlende/ungültige id → Fehlertext "id must be an integer >= 1.", nichts gelöscht.
 * AK6: bestehende Suite bleibt (bis auf die Katalog-Assertion oben) grün.
 *
 * Rot, bis das Werkzeug task_delete in mcpTools existiert. KEIN Produktivcode.
 */
describe('MCP-Werkzeug task_delete (#1396)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		closeDb();
	});

	it('AK1: tools/list enthält task_delete mit inputSchema.required = ["id"], Katalog wächst auf einundzwanzig Namen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const names = tools.map((t) => t.name).sort();
		// Zähler wächst mit dem Katalog (#1423: balance_status, #1412: drei Kategorie-Werkzeuge,
		// #1413: zwei Säulen-Werkzeuge — die CRUD-Werkzeuge sind mit #1573 entfallen —,
		// #1542: drei Gruppen-Schreibwerkzeuge). Der Vertrag ist „task_delete ist drin", nicht
		// „es gibt genau dreizehn Werkzeuge" — die vollständige Namensliste prüft der Snapshot-Test.
		assert.equal(names.length, 31, `Katalog sollte einunddreißig Namen führen, war: ${names.join(', ')}`);
		assert.ok(names.includes('task_delete'), 'task_delete muss im Katalog stehen');

		const tool = tools.find((t) => t.name === 'task_delete');
		const schema = tool?.inputSchema as { required?: string[] } | undefined;
		assert.deepEqual(schema?.required, ['id'], 'task_delete.inputSchema.required muss genau ["id"] sein');
	});

	it('AK2: ein readwrite-Token löscht über task_delete eine eigene Aufgabe endgültig', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Wird über MCP gelöscht');

		const deleted = await mcpCall(token, 'task_delete', { id: taskId });
		assert.equal(deleted.error, undefined, `task_delete sollte keinen Fehler liefern: ${deleted.error?.message}`);

		const list = await mcpCall<{ id: number }[]>(token, 'task_list');
		assert.ok(
			!list.result?.some((t) => t.id === taskId),
			'die gelöschte Aufgabe darf in task_list nicht mehr auftauchen',
		);
	});

	it('AK3: task_delete auf eine fremde Aufgabe liefert HTTP 404 und löscht nichts', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const taskIdOfB = await createTaskViaApi(cookieB, 'Von B, bleibt erhalten');

		const res = await mcpCall(tokenA, 'task_delete', { id: taskIdOfB });
		assert.ok(res.error, 'fremde Aufgabe löschen muss fehlschlagen');
		assert.match(res.error!.message, /Task nicht gefunden\./);
		assert.match(res.error!.message, /HTTP 404/);

		const listB = await mcpCall<{ id: number }[]>(await createToken(cookieB), 'task_list');
		assert.ok(
			listB.result?.some((t) => t.id === taskIdOfB),
			'die Aufgabe von B muss nach dem gescheiterten Löschversuch weiterhin existieren',
		);
	});

	it('AK4: ein Nur-lese-Token scheitert mit dem Scope-Fehlertext, die Aufgabe bleibt erhalten', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Bleibt bei read-only erhalten');

		const res = await mcpCall(token, 'task_delete', { id: taskId });
		assert.ok(res.error, 'task_delete muss mit einem Nur-lese-Token fehlschlagen');
		assert.match(
			res.error!.message,
			/read access only/,
			`Fehlertext muss die Rechtestufe benennen, war: ${res.error!.message}`,
		);

		const readwriteToken = await createToken(cookie);
		const list = await mcpCall<{ id: number }[]>(readwriteToken, 'task_list');
		assert.ok(
			list.result?.some((t) => t.id === taskId),
			'die Aufgabe muss nach dem abgelehnten Löschversuch weiterhin existieren',
		);
	});

	it('AK5: task_delete ohne bzw. mit ungültiger id liefert den festen Fehlertext und löscht nichts', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Bleibt bei ungültiger id erhalten');

		const missing = await mcpCall(token, 'task_delete', {});
		assert.ok(missing.error, 'fehlende id muss fehlschlagen');
		assert.equal(missing.error!.message, 'id must be an integer >= 1.');

		const nonInteger = await mcpCall(token, 'task_delete', { id: 'abc' });
		assert.ok(nonInteger.error, 'nicht-ganzzahlige id muss fehlschlagen');
		assert.equal(nonInteger.error!.message, 'id must be an integer >= 1.');

		const list = await mcpCall<{ id: number }[]>(token, 'task_list');
		assert.ok(
			list.result?.some((t) => t.id === taskId),
			'ein abgelehnter task_delete-Aufruf darf keine Aufgabe löschen',
		);
	});
});

/**
 * #1420: autoDeleteAfterDeadline über task_create/task_update setzbar (docs/spec/issue-1420.md).
 *
 * AK1/AK2: tools/list deklariert für task_create und task_update autoDeleteAfterDeadline als
 * optionales boolean-Feld, dessen Beschreibung "deadline" nennt.
 * AK3: task_create mit autoDeleteAfterDeadline: true + deadline übernimmt den Wert in die Antwort.
 * AK4: task_update setzt den Wert nachträglich auf true und wieder auf false.
 * AK5: task_update ohne das Feld lässt einen zuvor gesetzten Wert true unverändert.
 * AK6: ein nicht-boolescher Wert liefert die Routen-Fehlermeldung (HTTP 400), nichts wird angelegt.
 * AK7: der Katalog-Namens-Snapshot (14 Namen, s. oben AK1 task_delete-Block) bleibt unberührt.
 *
 * Rot, weil taskFieldProperties/pickTaskFields autoDeleteAfterDeadline noch nicht kennen. KEIN
 * Produktivcode in diesem Commit.
 */
describe('#1420: autoDeleteAfterDeadline über task_create/task_update setzen', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		closeDb();
	});

	it('AK1/AK2: tools/list deklariert autoDeleteAfterDeadline als optionales boolean-Feld für beide Werkzeuge', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		for (const { name, requiredKey } of [
			{ name: 'task_create', requiredKey: 'title' },
			{ name: 'task_update', requiredKey: 'id' },
		]) {
			const tool = tools.find((t) => t.name === name);
			assert.ok(tool, `${name} muss in tools/list enthalten sein`);
			const schema = tool?.inputSchema as
				{ properties?: Record<string, { type?: string; description?: string }>; required?: string[] } | undefined;
			const property = schema?.properties?.autoDeleteAfterDeadline;
			assert.equal(
				property?.type,
				'boolean',
				`${name}.inputSchema.properties.autoDeleteAfterDeadline muss type "boolean" sein`,
			);
			assert.match(
				property?.description ?? '',
				/deadline/i,
				`${name}.inputSchema.properties.autoDeleteAfterDeadline.description muss "deadline" nennen`,
			);
			assert.ok(
				!schema?.required?.includes('autoDeleteAfterDeadline'),
				`${name}.inputSchema.required darf autoDeleteAfterDeadline nicht enthalten`,
			);
			assert.ok(
				schema?.required?.includes(requiredKey),
				`${name}.inputSchema.required muss weiterhin "${requiredKey}" enthalten`,
			);
		}
	});

	it('AK3: task_create mit autoDeleteAfterDeadline: true und gesetzter deadline übernimmt den Wert in die Antwort', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const created = await mcpCall<{ id: number; autoDeleteAfterDeadline: boolean }>(token, 'task_create', {
			title: 'Mit Auto-Löschung über MCP',
			deadline: '2030-01-01T00:00:00.000Z',
			autoDeleteAfterDeadline: true,
		});
		assert.equal(created.error, undefined, 'task_create mit gültigem autoDeleteAfterDeadline darf nicht fehlschlagen');
		assert.equal(created.result?.autoDeleteAfterDeadline, true);
	});

	it('AK4/AK5: task_update setzt autoDeleteAfterDeadline auf true und false; ein Update ohne das Feld lässt true unverändert', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const taskId = await createTaskViaApi(cookie, 'Für Auto-Löschung-Update über MCP');

		const setTrue = await mcpCall<{ autoDeleteAfterDeadline: boolean }>(token, 'task_update', {
			id: taskId,
			deadline: '2030-01-01T00:00:00.000Z',
			autoDeleteAfterDeadline: true,
		});
		assert.equal(setTrue.error, undefined);
		assert.equal(setTrue.result?.autoDeleteAfterDeadline, true);

		const untouched = await mcpCall<{ autoDeleteAfterDeadline: boolean }>(token, 'task_update', {
			id: taskId,
			title: 'Umbenannt',
		});
		assert.equal(
			untouched.result?.autoDeleteAfterDeadline,
			true,
			'task_update ohne autoDeleteAfterDeadline-Feld darf einen zuvor gesetzten Wert true nicht ändern',
		);

		const setFalse = await mcpCall<{ autoDeleteAfterDeadline: boolean }>(token, 'task_update', {
			id: taskId,
			autoDeleteAfterDeadline: false,
		});
		assert.equal(setFalse.error, undefined);
		assert.equal(setFalse.result?.autoDeleteAfterDeadline, false);
	});

	it('AK6: ein nicht-boolescher Wert wird abgelehnt, es entsteht keine Aufgabe', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const before = await mcpCall<{ id: number }[]>(token, 'task_list');
		const countBefore = before.result?.length ?? 0;

		const created = await mcpCall(token, 'task_create', {
			title: 'Ungültiges autoDeleteAfterDeadline',
			autoDeleteAfterDeadline: 'ja',
		});
		assert.ok(created.error, 'task_create mit nicht-booleschem autoDeleteAfterDeadline muss fehlschlagen');
		assert.match(created.error?.message ?? '', /autoDeleteAfterDeadline muss ein Boolean sein\..*\(HTTP 400\)/);

		const after = await mcpCall<{ id: number }[]>(token, 'task_list');
		assert.equal(after.result?.length, countBefore, 'ein abgelehnter task_create darf keine Aufgabe anlegen');
	});

	it('AK7: der Katalog-Namens-Snapshot bleibt bei einundzwanzig Namen', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const names = tools.map((t) => t.name).sort();
		// Zähler wächst mit dem Katalog (#1423: balance_status, #1412: category_create/update/delete,
		// #1413: vier Säulen-Werkzeuge, #1424: balance_history, #1542: drei Gruppen-Schreibwerkzeuge)
		// — #1420 selbst fügt kein Werkzeug hinzu.
		assert.equal(names.length, 31, `Katalog sollte einunddreißig Namen führen, war: ${names.join(', ')}`);
	});
});

/**
 * Rote Spec-Tests für #1423 (Spec docs/spec/issue-1423.md) — MCP-Werkzeug `balance_status`.
 *
 * AK2: Eingabeschema (nur optionale `timezone`, kein `write`), funktioniert mit Nur-lese-Token.
 * AK3: Gesamt-Füllstand + hatPunkte, inkl. Leerfall.
 * AK7: `timezone` beeinflusst den Streak-Tagesumbruch, ein ungültiger Wert führt zu keinem Fehler.
 * AK8: Datenisolation — auch gruppengeteilte fremde Aufgaben zählen nicht ein.
 *
 * Rot, bis das Werkzeug existiert (heute: `findMcpTool('balance_status')` liefert `undefined`,
 * `tools/call` also einen JSON-RPC-Fehler „Unknown tool"). KEIN Produktivcode.
 */
describe('MCP-Werkzeug balance_status (#1423)', () => {
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

	type BalanceResult = {
		fuellstandProzent: number;
		hatPunkte: boolean;
		saeulen: { id: number; name: string; punkte: number; gewichtung: number }[];
		streak: { aktuell: number; best: number };
		meilensteine: { schluessel: string; typ: string; schwelle: number }[];
	};

	/** Legt eine Aufgabe über MCP an, erledigt sie und setzt den ScoreEntry-Zeitpunkt fest (Muster streak.test.ts). */
	const completeTaskAtViaMcp = async (token: string, title: string, zeitpunkt: Date): Promise<void> => {
		const created = await mcpCall<{ id: number }>(token, 'task_create', { title });
		assert.ok(created.result?.id, `Setup: ${title} muss über task_create anlegbar sein`);
		const taskId = created.result!.id;
		await mcpCall(token, 'task_complete', { id: taskId });
		const [updated] = await ScoreEntry.update({ zeitpunkt }, { where: { taskId } });
		assert.equal(updated, 1, 'ScoreEntry für den Task muss existieren, um den Zeitpunkt zu verschieben');
	};

	const createGroupViaApi = async (cookie: string, name: string): Promise<{ id: number }> => {
		const res = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name }),
		});
		assert.equal(res.status, 201, 'Setup: Gruppe muss über die API anlegbar sein');
		return (await res.json()) as { id: number };
	};

	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await server.json(`/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { Cookie: cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

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

	it('AK2: Eingabeschema hat nur eine optionale timezone, kein write; funktioniert mit Nur-lese-Token', async () => {
		const cookie = await server.register('mcp-tools-balance-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);

		const tools = await mcpListTools(token);
		const tool = tools.find((t) => t.name === 'balance_status');
		assert.ok(tool, 'balance_status muss im Katalog stehen');
		const schema = tool!.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
		assert.deepEqual(Object.keys(schema.properties ?? {}), ['timezone']);
		assert.deepEqual(schema.required ?? [], []);

		const result = await mcpCall<BalanceResult>(token, 'balance_status');
		assert.equal(
			result.error,
			undefined,
			`Nur-lese-Token darf balance_status aufrufen, Fehler: ${result.error?.message}`,
		);
	});

	it('AK3: ohne Argumente liefert fuellstandProzent in [0,100] und hatPunkte; ohne Erledigung 0/false', async () => {
		const cookie = await server.register('mcp-tools-balance-b@example.com', 'password123');
		const token = await createToken(cookie);

		const leer = await mcpCall<BalanceResult>(token, 'balance_status');
		assert.equal(leer.result?.fuellstandProzent, 0);
		assert.equal(leer.result?.hatPunkte, false);

		// Bewusst **alle gewichteten** Standard-Säulen gleichmäßig bedienen: `POST /pillars` legt neue
		// Säulen mit `weight: 0` an (routes/pillars.ts:251-255), und Punkte auf einer Säule ohne Soll
		// heben den Füllstand definitionsgemäß nicht (AK4, dritter Randfall — heartBalance.test.ts).
		// Alles auf eine einzige Säule zu werfen ergäbe die größtmögliche Schieflage und damit
		// Füllstand 0 — das ist der Boden der Skala, nicht ein fehlender Punktestand.
		const pillars = await mcpCall<{ id: number; weight: number }[]>(token, 'pillar_list');
		const gewichtet = pillars.result?.filter((pillar) => pillar.weight > 0) ?? [];
		assert.ok(gewichtet.length > 0, 'Setup: der Nutzer muss gewichtete Standard-Säulen besitzen');
		for (const saeule of gewichtet) {
			await mcpCall(token, 'task_create', {
				title: `Erledigt für Füllstand ${saeule.id}`,
				pillars: [{ pillarId: saeule.id, share: 100 }],
			});
		}
		const list = await mcpCall<{ id: number; title: string }[]>(token, 'task_list');
		for (const saeule of gewichtet) {
			const taskId = list.result?.find((t) => t.title === `Erledigt für Füllstand ${saeule.id}`)?.id;
			assert.ok(taskId, 'Setup: Task muss über task_list auffindbar sein');
			await mcpCall(token, 'task_complete', { id: taskId });
		}

		const gefuellt = await mcpCall<BalanceResult>(token, 'balance_status');
		assert.ok(
			gefuellt.result !== undefined &&
				gefuellt.result.fuellstandProzent > 0 &&
				gefuellt.result.fuellstandProzent <= 100,
			`fuellstandProzent muss nach einer Erledigung positiv sein, war: ${JSON.stringify(gefuellt.result)}`,
		);
		assert.equal(gefuellt.result?.hatPunkte, true);
	});

	it('AK7: unterschiedliche timezone kann den Streak-Stand verändern, ein ungültiger Wert wirft keinen Fehler', async () => {
		const cookie = await server.register('mcp-tools-balance-c@example.com', 'password123');
		const token = await createToken(cookie);

		const invalid = await mcpCall<BalanceResult>(token, 'balance_status', { timezone: 'Nicht/Existent' });
		assert.equal(invalid.error, undefined, 'ein unbekannter timezone-Wert darf keinen JSON-RPC-Fehler auslösen');

		// Zwei Erledigungen zwei Stunden auseinander (2026-06-15T09:00Z / T11:00Z): in Pacific/Kiritimati
		// (UTC+14) liegt der Tageswechsel bei UTC 10:00 → zwei aufeinanderfolgende Kalendertage
		// (best=2); in Etc/GMT+12 (UTC-12) liegt er bei UTC 12:00 → derselbe Kalendertag (best=1).
		// `best` hängt (anders als `aktuell`) nicht von der realen Ausführungszeit ab.
		await completeTaskAtViaMcp(token, 'Grenzfall früh', new Date('2026-06-15T09:00:00.000Z'));
		await completeTaskAtViaMcp(token, 'Grenzfall spät', new Date('2026-06-15T11:00:00.000Z'));

		const east = await mcpCall<BalanceResult>(token, 'balance_status', { timezone: 'Pacific/Kiritimati' });
		const west = await mcpCall<BalanceResult>(token, 'balance_status', { timezone: 'Etc/GMT+12' });
		assert.equal(east.error, undefined);
		assert.equal(west.error, undefined);
		assert.equal(east.result?.streak.best, 2, 'Pacific/Kiritimati muss die Erledigungen auf zwei Tage verteilen');
		assert.equal(west.result?.streak.best, 1, 'Etc/GMT+12 muss beide Erledigungen demselben Tag zuordnen');
	});

	it('AK8: Token liefert nur eigene Punkte/Streak-Tage, auch eine für ein Gruppenmitglied angelegte Aufgabe zählt nicht ein', async () => {
		const cookieA = await server.register('mcp-tools-balance-d-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-balance-d-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);

		await createTaskViaApi(cookieB, 'Von B erledigt');
		const bTasks = await server.json('/tasks', { headers: { Cookie: cookieB } });
		const bTaskId = ((await bTasks.json()) as { id: number; title: string }[]).find(
			(t) => t.title === 'Von B erledigt',
		)?.id;
		assert.ok(bTaskId, 'Setup: Task von B muss existieren');
		await server.json(`/tasks/${bTaskId}`, {
			method: 'PATCH',
			headers: { Cookie: cookieB },
			body: JSON.stringify({ status: 'Done' }),
		});

		const ohneGruppe = await mcpCall<BalanceResult>(tokenA, 'balance_status');
		assert.equal(ohneGruppe.result?.hatPunkte, false, 'A darf Bs Erledigung nicht als eigene Punkte sehen');
		assert.equal(ohneGruppe.result?.streak.aktuell, 0);

		// #1213: A legt für B (Gruppenmitglied) eine Aufgabe an (`userId` im Body = Empfänger). Die
		// Aufgabe gehört B (`task.userId === B`), taucht aber wegen `createdById === A` in As breiterer
		// Task-Leseliste auf (routes/tasks.ts:186). Die Balance muss trotzdem strikt `ownerScope` auf
		// den EIGENTÜMER anwenden — sonst zählt As eigener Blick auf eine fremde, nur mitangelegte
		// Aufgabe fälschlich mit.
		const group = await createGroupViaApi(cookieA, 'Familie');
		const bId = await ownUserId(cookieB, 'mcp-tools-balance-d-b@example.com');
		await inviteAndAccept(cookieA, group.id, bId, cookieB);

		const handoverRes = await server.json('/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookieA },
			body: JSON.stringify({ title: 'Von A für B angelegt', userId: bId }),
		});
		assert.equal(handoverRes.status, 201, 'Setup: A muss eine Aufgabe für B anlegen können');
		const handoverTaskId = ((await handoverRes.json()) as { id: number }).id;
		const doneRes = await server.json(`/tasks/${handoverTaskId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookieB },
			body: JSON.stringify({ status: 'Done' }),
		});
		assert.equal(doneRes.status, 200, 'Setup: B muss die eigene (übergebene) Aufgabe erledigen können');

		const nachHandover = await mcpCall<BalanceResult>(tokenA, 'balance_status');
		assert.equal(
			nachHandover.result?.hatPunkte,
			false,
			'eine für B angelegte, B gehörende Aufgabe darf A keine Punkte geben, obwohl A sie in der Task-Liste sieht',
		);
	});
});

/**
 * Spec-Tests zu #1413/#1573 — Säulen über MCP. Die fünf Säulen sind fest (#1573): Die
 * CRUD-Werkzeuge pillar_create/pillar_update/pillar_delete sind ENTFALLEN (die Routes antworten
 * mit 403); übrig bleiben:
 *
 * AK5: pillar_weights_set setzt alle Gewichte.
 * AK6: unvollständige Gewichtsliste/Summe != 100 → Routen-Fehlertext (HTTP 400), Gewichte unverändert.
 * AK7: fremde/unbekannte ID im Gewichts-Set → Abdeckungs-Fehlertext (HTTP 400).
 * AK8: Nur-lese-Token scheitert am Schreibwerkzeug, Datenbestand bleibt unverändert.
 */
type PillarResult = { id: number; name: string; description: string; weight: number };

describe('MCP-Werkzeuge Säulen-Gewichte (#1413/#1573)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('AK5: pillar_weights_set setzt alle Gewichte, pillar_list zeigt danach genau diese Werte', async () => {
		const cookie = await server.register('mcp-tools-pillar-a@example.com', 'password123');
		const token = await createToken(cookie);
		const pillarA = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);
		const pillarB = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

		const result = await mcpCall<PillarResult[]>(token, 'pillar_weights_set', {
			weights: await weightsForAllPillars(token, { [pillarA]: 70, [pillarB]: 30 }),
		});
		assert.equal(result.error, undefined, `pillar_weights_set sollte gelingen: ${result.error?.message}`);

		const list = await mcpCall<PillarResult[]>(token, 'pillar_list');
		const byId = new Map(list.result?.map((p) => [p.id, p.weight]));
		assert.equal(byId.get(pillarA), 70);
		assert.equal(byId.get(pillarB), 30);
	});

	it('AK6: unvollständige Gewichtsliste bzw. Summe != 100 schlägt fehl, vorherige Gewichte bleiben erhalten', async () => {
		const cookie = await server.register('mcp-tools-pillar-a@example.com', 'password123');
		const token = await createToken(cookie);
		const pillarA = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);
		const pillarB = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

		const initial = await mcpCall<PillarResult[]>(token, 'pillar_weights_set', {
			weights: await weightsForAllPillars(token, { [pillarA]: 60, [pillarB]: 40 }),
		});
		assert.equal(initial.error, undefined, `Setup: pillar_weights_set sollte gelingen: ${initial.error?.message}`);

		const incomplete = await mcpCall(token, 'pillar_weights_set', { weights: [{ id: pillarA, weight: 100 }] });
		assert.ok(incomplete.error, 'eine unvollständige Gewichtsliste muss fehlschlagen');
		assert.match(incomplete.error!.message, /existierenden Säulen enthalten/);
		assert.match(incomplete.error!.message, /HTTP 400/);

		const wrongSum = await mcpCall(token, 'pillar_weights_set', {
			weights: await weightsForAllPillars(token, { [pillarA]: 60, [pillarB]: 60 }),
		});
		assert.ok(wrongSum.error, 'eine Summe != 100 muss fehlschlagen');
		assert.match(wrongSum.error!.message, /Summe der Gewichte muss 100 ergeben/);
		assert.match(wrongSum.error!.message, /HTTP 400/);

		const list = await mcpCall<PillarResult[]>(token, 'pillar_list');
		const byId = new Map(list.result?.map((p) => [p.id, p.weight]));
		assert.equal(byId.get(pillarA), 60, 'Gewicht von pillarA darf nach abgelehnten Aufrufen unverändert bleiben');
		assert.equal(byId.get(pillarB), 40, 'Gewicht von pillarB darf nach abgelehnten Aufrufen unverändert bleiben');
	});

	it('AK7: fremde/unbekannte ID im Gewichts-Set liefert den Abdeckungs-Fehlertext', async () => {
		const cookieA = await server.register('mcp-tools-pillar-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-pillar-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const fremdeSaeule = await createPillarViaApi(cookieB, `Testsäule-${idCounter++}`);

		const weightsUnknown = await mcpCall(tokenA, 'pillar_weights_set', {
			weights: [{ id: fremdeSaeule, weight: 100 }],
		});
		assert.ok(weightsUnknown.error, 'pillar_weights_set mit fremder ID muss fehlschlagen');
		assert.match(weightsUnknown.error!.message, /existierenden Säulen enthalten/);
		assert.match(weightsUnknown.error!.message, /HTTP 400/);
	});

	it('AK8: ein Nur-lese-Token scheitert am Schreibwerkzeug pillar_weights_set, pillar_list bleibt unverändert', async () => {
		const cookie = await server.register('mcp-tools-pillar-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);
		const pillarId = await createPillarViaApi(cookie, `Testsäule-${idCounter++}`);

		const before = await mcpCall<PillarResult[]>(await createToken(cookie), 'pillar_list');

		for (const [tool, args] of [['pillar_weights_set', { weights: [{ id: pillarId, weight: 100 }] }]] as const) {
			const res = await mcpCall(token, tool, args);
			assert.ok(res.error, `${tool} muss mit einem Nur-lese-Token fehlschlagen`);
			assert.match(
				res.error!.message,
				/read access only/,
				`${tool}: Fehlertext muss die Rechtestufe benennen, war: ${res.error!.message}`,
			);
			assert.match(
				res.error!.message,
				/Lesen und Schreiben/,
				`${tool}: Fehlertext muss den Ausweg nennen, war: ${res.error!.message}`,
			);
		}

		const after = await mcpCall<PillarResult[]>(await createToken(cookie), 'pillar_list');
		assert.deepEqual(
			after.result,
			before.result,
			'der Datenbestand darf nach den abgelehnten Aufrufen unverändert sein',
		);
	});
});

/**
 * Rote Spec-Tests für #1412 (Spec docs/spec/issue-1412.md) — MCP-Werkzeuge
 * `category_create`/`category_update`/`category_delete`.
 *
 * AK1: Katalog-Snapshot wächst auf einundzwanzig Namen inkl. der drei neuen Werkzeuge + deren `required`.
 * AK2: readwrite-Token legt über category_create eine Kategorie an, category_list enthält sie danach.
 * AK3: category_update ändert Name und Farbe einer eigenen Kategorie.
 * AK4: category_delete entfernt aus category_list, zugeordnete Aufgabe bleibt mit categoryId null.
 * AK5: Namenskollision bei category_create/category_update → 409-Fehlertext der Route.
 * AK6: fremde/unbekannte id bei category_update/category_delete → 404-Fehlertext der Route.
 * AK7: Nur-lese-Token scheitert am Scope-Hinweis, category_list bleibt erfolgreich.
 * AK8: ungültige Eingaben (Name, Farbe) → 400-Fehlertext der Route, nichts angelegt.
 *
 * Rot, bis die drei Werkzeuge in mcpTools existieren (heute: "Unknown tool"-Fehler). KEIN Produktivcode.
 */
describe('MCP-Werkzeuge category_create/category_update/category_delete (#1412)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		closeDb();
	});

	type CategoryResult = { id: number; name: string; color: string };

	const createCategoryViaApi = async (cookie: string, name: string, color: string): Promise<CategoryResult> => {
		const res = await server.json('/categories', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name, color }),
		});
		assert.equal(res.status, 201, 'Setup: Kategorie muss über die API anlegbar sein');
		return (await res.json()) as CategoryResult;
	};

	it('AK1: tools/list wächst auf einundzwanzig Namen; die drei neuen Werkzeuge tragen die vorgesehenen required-Felder', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const names = tools.map((t) => t.name).sort();
		assert.equal(
			names.length,
			31,
			`Katalog sollte einunddreißig Namen führen (#1412, #1542, #1543, #1544; Säulen-CRUD seit #1573 entfallen), war: ${names.join(', ')}`,
		);
		assert.ok(names.includes('category_create'), 'category_create muss im Katalog stehen');
		assert.ok(names.includes('category_update'), 'category_update muss im Katalog stehen');
		assert.ok(names.includes('category_delete'), 'category_delete muss im Katalog stehen');

		const requiredOf = (name: string) => {
			const tool = tools.find((t) => t.name === name);
			return (tool?.inputSchema as { required?: string[] } | undefined)?.required;
		};
		assert.deepEqual(requiredOf('category_create'), ['name', 'color']);
		assert.deepEqual(requiredOf('category_update'), ['id']);
		assert.deepEqual(requiredOf('category_delete'), ['id']);
	});

	it('AK2: ein readwrite-Token legt über category_create eine Kategorie an, category_list enthält sie danach', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const created = await mcpCall<CategoryResult>(token, 'category_create', {
			name: 'MCP-Test',
			color: CATEGORY_COLORS[0],
		});
		assert.equal(created.error, undefined, `category_create sollte keinen Fehler liefern: ${created.error?.message}`);
		assert.ok(created.result?.id, 'category_create muss eine id liefern');
		assert.equal(created.result?.color, CATEGORY_COLORS[0]);

		const list = await mcpCall<CategoryResult[]>(token, 'category_list');
		assert.ok(
			list.result?.some((c) => c.id === created.result?.id && c.name === 'MCP-Test'),
			'category_list muss die neu angelegte Kategorie enthalten',
		);
	});

	it('AK3: category_update ändert Name und Farbe einer eigenen Kategorie', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const category = await createCategoryViaApi(cookie, 'Vorher', CATEGORY_COLORS[0]);
		const newColor = CATEGORY_COLORS[1];

		const updated = await mcpCall<CategoryResult>(token, 'category_update', {
			id: category.id,
			name: 'Nachher',
			color: newColor,
		});
		assert.equal(updated.error, undefined, `category_update sollte keinen Fehler liefern: ${updated.error?.message}`);

		const list = await mcpCall<CategoryResult[]>(token, 'category_list');
		const found = list.result?.find((c) => c.id === category.id);
		assert.equal(found?.name, 'Nachher');
		assert.equal(found?.color, newColor);
	});

	it('AK4: category_delete entfernt die Kategorie aus category_list, eine zugeordnete Aufgabe bleibt mit categoryId null erhalten', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const category = await createCategoryViaApi(cookie, 'Wird gelöscht', CATEGORY_COLORS[0]);
		const created = await mcpCall<{ id: number; categoryId: number | null }>(token, 'task_create', {
			title: 'Mit Kategorie über MCP',
			categoryId: category.id,
		});
		assert.equal(created.result?.categoryId, category.id, 'Setup: Aufgabe muss die Kategorie zugewiesen bekommen');
		const taskId = created.result!.id;

		const deleted = await mcpCall(token, 'category_delete', { id: category.id });
		assert.equal(deleted.error, undefined, `category_delete sollte keinen Fehler liefern: ${deleted.error?.message}`);

		const list = await mcpCall<CategoryResult[]>(token, 'category_list');
		assert.ok(
			!list.result?.some((c) => c.id === category.id),
			'die gelöschte Kategorie darf in category_list nicht mehr auftauchen',
		);

		const tasks = await mcpCall<{ id: number; categoryId: number | null }[]>(token, 'task_list');
		const task = tasks.result?.find((t) => t.id === taskId);
		assert.ok(task, 'die Aufgabe muss nach dem Löschen der Kategorie weiterhin existieren');
		assert.equal(task?.categoryId, null, 'categoryId der Aufgabe muss nach dem Löschen null sein');
	});

	it('AK5: ein bereits vergebener Name führt bei category_create und category_update zu einem 409-Fehler, ohne etwas zu ändern', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		await createCategoryViaApi(cookie, 'Doppelt', CATEGORY_COLORS[0]);

		const createdDupe = await mcpCall(token, 'category_create', { name: 'Doppelt', color: CATEGORY_COLORS[1] });
		assert.ok(createdDupe.error, 'category_create mit vergebenem Namen muss fehlschlagen');
		assert.match(createdDupe.error!.message, /Eine Kategorie mit diesem Namen existiert bereits\./);
		assert.match(createdDupe.error!.message, /HTTP 409/);

		const other = await createCategoryViaApi(cookie, 'Anders', CATEGORY_COLORS[1]);
		const updatedDupe = await mcpCall(token, 'category_update', { id: other.id, name: 'Doppelt' });
		assert.ok(updatedDupe.error, 'category_update auf einen vergebenen Namen muss fehlschlagen');
		assert.match(updatedDupe.error!.message, /Eine Kategorie mit diesem Namen existiert bereits\./);
		assert.match(updatedDupe.error!.message, /HTTP 409/);

		const list = await mcpCall<CategoryResult[]>(token, 'category_list');
		assert.equal(
			list.result?.length,
			2,
			'nach beiden abgelehnten Aufrufen dürfen weiterhin nur die zwei ursprünglichen Kategorien existieren',
		);
		assert.ok(
			list.result?.some((c) => c.id === other.id && c.name === 'Anders'),
			'der Name der zweiten Kategorie darf unverändert bleiben',
		);
	});

	it('AK6: eine fremde oder unbekannte id liefert bei category_update und category_delete einen 404-Fehler, die fremde Kategorie bleibt unverändert', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const categoryOfB = await createCategoryViaApi(cookieB, 'Von B', CATEGORY_COLORS[0]);

		const updateForeign = await mcpCall(tokenA, 'category_update', { id: categoryOfB.id, name: 'Umbenannt von A' });
		assert.ok(updateForeign.error, 'category_update auf eine fremde Kategorie muss fehlschlagen');
		assert.match(updateForeign.error!.message, /Kategorie nicht gefunden\./);
		assert.match(updateForeign.error!.message, /HTTP 404/);

		const deleteForeign = await mcpCall(tokenA, 'category_delete', { id: categoryOfB.id });
		assert.ok(deleteForeign.error, 'category_delete auf eine fremde Kategorie muss fehlschlagen');
		assert.match(deleteForeign.error!.message, /Kategorie nicht gefunden\./);
		assert.match(deleteForeign.error!.message, /HTTP 404/);

		const unknownId = await mcpCall(tokenA, 'category_delete', { id: 999999 });
		assert.ok(unknownId.error, 'category_delete mit unbekannter id muss fehlschlagen');
		assert.match(unknownId.error!.message, /Kategorie nicht gefunden\./);

		const listB = await mcpCall<CategoryResult[]>(await createToken(cookieB), 'category_list');
		const stillThere = listB.result?.find((c) => c.id === categoryOfB.id);
		assert.equal(
			stillThere?.name,
			'Von B',
			'die Kategorie von B muss nach beiden gescheiterten Zugriffen unverändert erhalten bleiben',
		);
	});

	it('AK7: ein Nur-lese-Token scheitert bei allen drei Werkzeugen am Scope-Hinweis, category_list bleibt erfolgreich und unverändert', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);
		const category = await createCategoryViaApi(cookie, 'Bleibt unverändert', CATEGORY_COLORS[0]);

		const create = await mcpCall(token, 'category_create', { name: 'Neu', color: CATEGORY_COLORS[1] });
		assert.ok(create.error, 'category_create muss mit einem Nur-lese-Token fehlschlagen');
		assert.match(create.error!.message, /read access only/);

		const update = await mcpCall(token, 'category_update', { id: category.id, name: 'Geändert' });
		assert.ok(update.error, 'category_update muss mit einem Nur-lese-Token fehlschlagen');
		assert.match(update.error!.message, /read access only/);

		const del = await mcpCall(token, 'category_delete', { id: category.id });
		assert.ok(del.error, 'category_delete muss mit einem Nur-lese-Token fehlschlagen');
		assert.match(del.error!.message, /read access only/);

		const list = await mcpCall<CategoryResult[]>(token, 'category_list');
		assert.equal(list.error, undefined, 'category_list muss mit demselben Nur-lese-Token weiterhin funktionieren');
		assert.deepEqual(
			list.result?.map((c) => c.name).sort(),
			['Bleibt unverändert'],
			'die Kategorienliste darf durch die drei abgelehnten Aufrufe nicht verändert worden sein',
		);
	});

	it('AK8: ungültige Eingaben (leerer Name, zu langer Name, Farbe außerhalb der Palette) werden mit dem 400-Text der Route abgelehnt, es entsteht nichts', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const emptyName = await mcpCall(token, 'category_create', { name: '', color: CATEGORY_COLORS[0] });
		assert.ok(emptyName.error, 'leerer Name muss fehlschlagen');
		assert.match(emptyName.error!.message, /HTTP 400/);

		const tooLongName = await mcpCall(token, 'category_create', { name: 'x'.repeat(41), color: CATEGORY_COLORS[0] });
		assert.ok(tooLongName.error, 'Name über 40 Zeichen muss fehlschlagen');
		assert.match(tooLongName.error!.message, /HTTP 400/);

		const invalidColor = await mcpCall(token, 'category_create', { name: 'Gültiger Name', color: '#123456' });
		assert.ok(invalidColor.error, 'Farbe außerhalb der Palette muss fehlschlagen');
		assert.match(invalidColor.error!.message, /HTTP 400/);

		const list = await mcpCall<CategoryResult[]>(token, 'category_list');
		assert.equal(list.result?.length, 0, 'keiner der drei abgelehnten Aufrufe darf eine Kategorie angelegt haben');
	});
});

/**
 * Rote Spec-Tests für #1424 (Spec docs/spec/issue-1424.md) — MCP-Werkzeug `balance_history`.
 *
 * AK8: Werkzeug im Katalog, Nur-Lese (kein `write`), Pflichtfelder `from`/`to` + optional
 * `timezone`, reicht Fehler der Route unverändert als JSON-RPC-Fehler durch.
 *
 * Rot, bis das Werkzeug existiert (heute: `findMcpTool('balance_history')` liefert `undefined`,
 * `tools/call` also einen JSON-RPC-Fehler „Unknown tool"). KEIN Produktivcode.
 */
describe('MCP-Werkzeug balance_history (#1424)', () => {
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

	type HistoryEntry = {
		tag: string;
		fuellstandProzent: number;
		hatPunkte: boolean;
		saeulen: { id: number; name: string; punkte: number; gewichtung: number }[];
	};

	/** Legt eine Aufgabe über MCP an, erledigt sie und setzt den ScoreEntry-Zeitpunkt fest (Muster streak.test.ts). */
	const completeTaskAtViaMcp = async (token: string, title: string, zeitpunkt: Date): Promise<void> => {
		const created = await mcpCall<{ id: number }>(token, 'task_create', { title });
		assert.ok(created.result?.id, `Setup: ${title} muss über task_create anlegbar sein`);
		const taskId = created.result!.id;
		await mcpCall(token, 'task_complete', { id: taskId });
		const [updated] = await ScoreEntry.update({ zeitpunkt }, { where: { taskId } });
		assert.equal(updated, 1, 'ScoreEntry für den Task muss existieren, um den Zeitpunkt zu verschieben');
	};

	it('AK8: Eingabeschema hat from/to als Pflichtfelder, timezone optional, kein write; Nur-lese-Token darf aufrufen', async () => {
		const cookie = await server.register('mcp-tools-history-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);

		const tools = await mcpListTools(token);
		const tool = tools.find((t) => t.name === 'balance_history');
		assert.ok(tool, 'balance_history muss im Katalog stehen');
		assert.ok(
			!('write' in (tool as { write?: boolean })) || (tool as { write?: boolean }).write !== true,
			'balance_history darf kein write-Werkzeug sein',
		);
		const schema = tool!.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
		assert.deepEqual(new Set(Object.keys(schema.properties ?? {})), new Set(['from', 'to', 'timezone']));
		assert.deepEqual(new Set(schema.required ?? []), new Set(['from', 'to']));

		const result = await mcpCall<HistoryEntry[]>(token, 'balance_history', { from: '2026-06-01', to: '2026-06-01' });
		assert.equal(
			result.error,
			undefined,
			`Nur-lese-Token darf balance_history aufrufen, Fehler: ${result.error?.message}`,
		);
		assert.equal(result.result?.length, 1);
	});

	it('AK8: from == to liefert genau einen Eintrag; die Route rechnet mit den echten Erledigungen', async () => {
		const cookie = await server.register('mcp-tools-history-b@example.com', 'password123');
		const token = await createToken(cookie);

		await completeTaskAtViaMcp(token, 'Für den Verlauf', new Date('2026-06-01T10:00:00.000Z'));

		const result = await mcpCall<HistoryEntry[]>(token, 'balance_history', { from: '2026-06-01', to: '2026-06-02' });
		assert.equal(result.error, undefined);
		assert.equal(result.result?.length, 2);
		assert.equal(result.result?.[0].hatPunkte, true, 'Tag 1 muss die Erledigung bereits sehen');
		assert.deepEqual(
			result.result?.[1].saeulen,
			result.result?.[0].saeulen,
			'Tag 2 ohne Erledigung muss Tag 1 spiegeln',
		);
	});

	it('AK8: eine ungültige Datumsangabe liefert denselben Fehlertext wie die Route (400), keine zweite Validierung im Werkzeug', async () => {
		const cookie = await server.register('mcp-tools-history-c@example.com', 'password123');
		const token = await createToken(cookie);

		const fehlend = await mcpCall<HistoryEntry[]>(token, 'balance_history', { from: '2026-06-01' });
		assert.ok(fehlend.error, 'fehlendes "to" muss einen JSON-RPC-Fehler auslösen');
		assert.match(fehlend.error!.message, /HTTP 400/, 'der Fehlertext muss den Statuscode der Route enthalten');

		const bisVorVon = await mcpCall<HistoryEntry[]>(token, 'balance_history', {
			from: '2026-06-05',
			to: '2026-06-01',
		});
		assert.ok(bisVorVon.error, '"to" vor "from" muss einen JSON-RPC-Fehler auslösen');
		assert.match(bisVorVon.error!.message, /HTTP 400/);
	});
});

/**
 * Rote Spec-Tests für #1542 (Spec docs/spec/issue-1542.md) — MCP-Werkzeuge
 * `group_create`/`group_update`/`group_delete` (Teil 1 von 3 zu #1414).
 *
 * AK1: Katalog enthält die drei neuen Werkzeuge (Snapshot-Tests oben wachsen auf 25 Namen).
 * AK2: readwrite-Token legt über group_create eine Gruppe an; group_list zeigt sie mit Rolle admin.
 * AK3: group_update ändert Name/Beschreibung (nachweisbar in group_list), group_delete entfernt sie.
 * AK4: Mitglied ohne Adminrolle → 403-Text der Route; fremdes Konto → 404-Text; Gruppe bleibt unverändert.
 * AK5: Nur-lese-Token scheitert an allen drei Werkzeugen am Scope-Gate, Daten unverändert.
 *
 * Rot, bis die drei Werkzeuge in mcpTools existieren (heute: „Unknown tool"-Fehler). KEIN Produktivcode.
 */
describe('MCP-Werkzeuge group_create/group_update/group_delete (#1542)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		closeDb();
	});

	type GroupEntry = { id: number; name: string; description: string | null; role: string };

	const createGroupViaApi = async (cookie: string, name: string): Promise<{ id: number }> => {
		const res = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name }),
		});
		assert.equal(res.status, 201, 'Setup: Gruppe muss über die API anlegbar sein');
		return (await res.json()) as { id: number };
	};

	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await server.json(`/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { Cookie: cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

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

	it('AK1: tools/list enthält group_create, group_update und group_delete mit den vorgesehenen required-Feldern', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const names = tools.map((t) => t.name);
		for (const name of ['group_create', 'group_update', 'group_delete']) {
			assert.ok(names.includes(name), `${name} muss im Katalog stehen`);
		}

		const requiredOf = (name: string) => {
			const tool = tools.find((t) => t.name === name);
			assert.ok(tool?.inputSchema, `${name} muss ein inputSchema deklarieren`);
			return (tool?.inputSchema as { required?: string[] } | undefined)?.required;
		};
		assert.deepEqual(requiredOf('group_create'), ['name']);
		assert.deepEqual(requiredOf('group_update'), ['id']);
		assert.deepEqual(requiredOf('group_delete'), ['id']);
	});

	it('AK2: ein readwrite-Token legt über group_create eine Gruppe an und ist darin admin', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const created = await mcpCall<GroupEntry>(token, 'group_create', {
			name: 'Familie',
			description: 'Gemeinsame Aufgaben',
		});
		assert.equal(created.error, undefined, `group_create sollte gelingen: ${created.error?.message}`);
		assert.equal(created.result?.name, 'Familie');

		const list = await mcpCall<GroupEntry[]>(token, 'group_list');
		const found = list.result?.find((g) => g.id === created.result?.id);
		assert.ok(found, 'group_list muss die neu angelegte Gruppe enthalten');
		assert.equal(found.name, 'Familie');
		assert.equal(found.role, 'admin', 'der Ersteller muss in group_list als admin geführt sein');
	});

	it('AK3: group_update ändert Name und Beschreibung, group_delete entfernt die Gruppe aus group_list', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const group = await createGroupViaApi(cookie, 'Vorher');

		const updated = await mcpCall<GroupEntry>(token, 'group_update', {
			id: group.id,
			name: 'Nachher',
			description: 'Neue Beschreibung',
		});
		assert.equal(updated.error, undefined, `group_update sollte gelingen: ${updated.error?.message}`);

		const listAfterUpdate = await mcpCall<GroupEntry[]>(token, 'group_list');
		const changed = listAfterUpdate.result?.find((g) => g.id === group.id);
		assert.equal(changed?.name, 'Nachher', 'group_list muss den neuen Namen zeigen');
		assert.equal(changed?.description, 'Neue Beschreibung', 'group_list muss die neue Beschreibung zeigen');

		const deleted = await mcpCall(token, 'group_delete', { id: group.id });
		assert.equal(deleted.error, undefined, `group_delete sollte gelingen: ${deleted.error?.message}`);

		const listAfterDelete = await mcpCall<GroupEntry[]>(token, 'group_list');
		assert.ok(
			!listAfterDelete.result?.some((g) => g.id === group.id),
			'die gelöschte Gruppe darf in group_list nicht mehr auftauchen',
		);
	});

	it('AK4: ohne Adminrolle bzw. auf fremde Gruppe liefern die Werkzeuge den Routen-Fehlertext samt Statuscode, die Gruppe bleibt unverändert', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const cookieC = await server.register('mcp-tools-c@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const tokenB = await createToken(cookieB);
		const tokenC = await createToken(cookieC);
		const group = await createGroupViaApi(cookieA, 'Bleibt unverändert');
		// B wird normales Mitglied (Rolle member) — group_update muss an der Route mit 403 scheitern.
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');
		await inviteAndAccept(cookieA, group.id, bId, cookieB);

		const noAdmin = await mcpCall(tokenB, 'group_update', { id: group.id, name: 'Umbenannt von B' });
		assert.ok(noAdmin.error, 'group_update ohne Adminrolle muss fehlschlagen');
		assert.match(noAdmin.error!.message, /Nur Administratoren dürfen die Gruppe bearbeiten\./);
		assert.match(noAdmin.error!.message, /HTTP 403/);

		// C ist kein Mitglied — fremdes group_delete muss an der Route mit 404 scheitern (kein Existenz-Leak).
		const foreign = await mcpCall(tokenC, 'group_delete', { id: group.id });
		assert.ok(foreign.error, 'group_delete auf eine fremde Gruppe muss fehlschlagen');
		assert.match(foreign.error!.message, /Gruppe nicht gefunden\./);
		assert.match(foreign.error!.message, /HTTP 404/);

		const list = await mcpCall<GroupEntry[]>(tokenA, 'group_list');
		const unchanged = list.result?.find((g) => g.id === group.id);
		assert.ok(unchanged, 'die Gruppe muss nach beiden gescheiterten Aufrufen weiterhin existieren');
		assert.equal(unchanged.name, 'Bleibt unverändert', 'der Gruppenname darf nicht geändert worden sein');
	});

	it('AK5: ein Nur-lese-Token scheitert an allen drei Werkzeugen am Scope-Hinweis, es ändern sich keine Daten', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const { token } = await createReadOnlyToken(cookie);
		const group = await createGroupViaApi(cookie, 'Bleibt bei read-only erhalten');

		for (const [tool, args] of [
			['group_create', { name: 'Sollte nicht entstehen' }],
			['group_update', { id: group.id, name: 'Sollte nicht ändern' }],
			['group_delete', { id: group.id }],
		] as const) {
			const res = await mcpCall(token, tool, args);
			assert.ok(res.error, `${tool} muss mit einem Nur-lese-Token fehlschlagen`);
			assert.match(
				res.error!.message,
				/read access only/,
				`${tool}: Fehlertext muss die Rechtestufe benennen, war: ${res.error!.message}`,
			);
			assert.match(
				res.error!.message,
				/Lesen und Schreiben/,
				`${tool}: Fehlertext muss den Ausweg nennen, war: ${res.error!.message}`,
			);
		}

		const list = await mcpCall<GroupEntry[]>(token, 'group_list');
		assert.equal(list.error, undefined, 'group_list muss mit demselben Nur-lese-Token weiterhin funktionieren');
		assert.deepEqual(
			list.result?.map((g) => g.name),
			['Bleibt bei read-only erhalten'],
			'der Gruppenbestand darf durch die drei abgelehnten Aufrufe nicht verändert worden sein',
		);
	});
});

/**
 * Rote Spec-Tests für #1543 (Spec docs/spec/issue-1543.md) — Gruppenmitglieder über MCP.
 *
 * AK1: Katalog wächst um group_member_role_set und group_member_remove (25 → 27 Namen).
 * AK2: Rolle ändern, Mitglied entfernen, Selbstaustritt über die eigene userId.
 * AK3: Letzter-Admin-Guard (409-Text der Route) greift durch beide Werkzeuge.
 * AK4: Ohne Adminrolle bzw. auf fremde Gruppe Routen-Fehlertext + Statuscode, Daten unverändert.
 * AK5: Nur-lese-Token scheitert am Scope-Gate, es ändern sich keine Daten.
 *
 * Rot, bis beide Werkzeuge in mcpTools existieren. KEIN Produktivcode.
 */
describe('MCP-Werkzeuge group_member_role_set/group_member_remove (#1543)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		closeDb();
	});

	type MemberEntry = { userId: number; displayName: string; role: string };
	type GroupEntry = { id: number; name: string; description: string | null; role: string };

	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await server.json(`/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { Cookie: cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

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

	const membersOf = async (token: string, groupId: number): Promise<MemberEntry[]> => {
		const list = await mcpCall<MemberEntry[]>(token, 'group_members_list', { groupId });
		assert.equal(list.error, undefined, `group_members_list sollte gelingen: ${list.error?.message}`);
		return list.result ?? [];
	};

	it('AK1: tools/list enthält group_member_role_set und group_member_remove mit den vorgesehenen required-Feldern', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const names = tools.map((t) => t.name);
		for (const name of ['group_member_role_set', 'group_member_remove']) {
			assert.ok(names.includes(name), `${name} muss im Katalog stehen`);
		}

		const requiredOf = (name: string) => {
			const tool = tools.find((t) => t.name === name);
			assert.ok(tool?.inputSchema, `${name} muss ein inputSchema deklarieren`);
			return (tool?.inputSchema as { required?: string[] } | undefined)?.required;
		};
		assert.deepEqual(requiredOf('group_member_role_set'), ['groupId', 'userId', 'role']);
		assert.deepEqual(requiredOf('group_member_remove'), ['groupId', 'userId']);
	});

	it('AK2: group_member_role_set befördert ein Mitglied zum Admin, group_member_remove entfernt es — beides in group_members_list nachweisbar', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const created = await mcpCall<GroupEntry>(tokenA, 'group_create', { name: 'Rollen-Test' });
		assert.equal(created.error, undefined, `group_create sollte gelingen: ${created.error?.message}`);
		const groupId = created.result!.id;
		await inviteAndAccept(cookieA, groupId, bId, cookieB);

		const promoted = await mcpCall<MemberEntry>(tokenA, 'group_member_role_set', {
			groupId,
			userId: bId,
			role: 'admin',
		});
		assert.equal(promoted.error, undefined, `group_member_role_set sollte gelingen: ${promoted.error?.message}`);
		assert.equal(promoted.result?.role, 'admin', 'die Antwort muss die neue Rolle tragen');

		const afterPromotion = await membersOf(tokenA, groupId);
		assert.equal(
			afterPromotion.find((m) => m.userId === bId)?.role,
			'admin',
			'group_members_list muss die neue Rolle zeigen',
		);

		// B ist jetzt selbst Admin — A bleibt Admin, damit nach dem Entfernen noch einer übrig ist (AK3-Guard).
		const removed = await mcpCall(tokenA, 'group_member_remove', { groupId, userId: bId });
		assert.equal(removed.error, undefined, `group_member_remove sollte gelingen: ${removed.error?.message}`);

		const afterRemoval = await membersOf(tokenA, groupId);
		assert.ok(
			!afterRemoval.some((m) => m.userId === bId),
			'das entfernte Mitglied darf in group_members_list nicht mehr auftauchen',
		);
	});

	it('AK2: group_member_remove mit der eigenen userId bewirkt den Austritt', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const tokenB = await createToken(cookieB);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const created = await mcpCall<GroupEntry>(tokenA, 'group_create', { name: 'Austritt' });
		const groupId = created.result!.id;
		await inviteAndAccept(cookieA, groupId, bId, cookieB);

		const left = await mcpCall(tokenB, 'group_member_remove', { groupId, userId: bId });
		assert.equal(
			left.error,
			undefined,
			`Selbstaustritt über die eigene userId sollte gelingen: ${left.error?.message}`,
		);

		const members = await membersOf(tokenA, groupId);
		assert.ok(!members.some((m) => m.userId === bId), 'der Ausgetretene darf nicht mehr Mitglied sein');

		const listB = await mcpCall<GroupEntry[]>(tokenB, 'group_list');
		assert.ok(
			!listB.result?.some((g) => g.id === groupId),
			'die Gruppe muss aus group_list des Ausgetretenen verschwinden',
		);
	});

	it('AK3: der letzte Admin darf sich weder degradieren noch entfernen — 409-Text der Route, Rolle bleibt admin', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const aId = await ownUserId(cookie, 'mcp-tools-a@example.com');

		const created = await mcpCall<GroupEntry>(token, 'group_create', { name: 'Letzter Admin' });
		const groupId = created.result!.id;

		const degrade = await mcpCall(token, 'group_member_role_set', { groupId, userId: aId, role: 'member' });
		assert.ok(degrade.error, 'Degradieren des letzten Admins muss fehlschlagen');
		assert.match(
			degrade.error!.message,
			/Die Gruppe braucht mindestens einen Administrator — ernenne zuerst eine andere Person\./,
		);
		assert.match(degrade.error!.message, /HTTP 409/);

		const leave = await mcpCall(token, 'group_member_remove', { groupId, userId: aId });
		assert.ok(leave.error, 'Selbstaustritt des letzten Admins muss fehlschlagen');
		assert.match(
			leave.error!.message,
			/Die Gruppe braucht mindestens einen Administrator — ernenne zuerst eine andere Person\./,
		);
		assert.match(leave.error!.message, /HTTP 409/);

		const members = await membersOf(token, groupId);
		assert.equal(
			members.find((m) => m.userId === aId)?.role,
			'admin',
			'der letzte Admin muss nach beiden abgelehnten Aufrufen weiter admin sein',
		);
	});

	it('AK4: ohne Adminrolle bzw. auf eine fremde Gruppe liefern beide Werkzeuge den Routen-Fehlertext samt Statuscode, die Mitglieder bleiben unverändert', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const cookieC = await server.register('mcp-tools-c@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const tokenB = await createToken(cookieB);
		const tokenC = await createToken(cookieC);
		const aId = await ownUserId(cookieA, 'mcp-tools-a@example.com');
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const created = await mcpCall<GroupEntry>(tokenA, 'group_create', { name: 'Bleibt unverändert' });
		const groupId = created.result!.id;
		// B wird normales Mitglied (Rolle member) — beide Werkzeuge müssen an der Route mit 403 scheitern.
		await inviteAndAccept(cookieA, groupId, bId, cookieB);

		const noAdminRole = await mcpCall(tokenB, 'group_member_role_set', {
			groupId,
			userId: bId,
			role: 'admin',
		});
		assert.ok(noAdminRole.error, 'group_member_role_set ohne Adminrolle muss fehlschlagen');
		assert.match(noAdminRole.error!.message, /Nur Administratoren dürfen Rollen ändern\./);
		assert.match(noAdminRole.error!.message, /HTTP 403/);

		const noAdminRemove = await mcpCall(tokenB, 'group_member_remove', { groupId, userId: aId });
		assert.ok(noAdminRemove.error, 'group_member_remove auf ein anderes Mitglied ohne Adminrolle muss fehlschlagen');
		assert.match(noAdminRemove.error!.message, /Nur Administratoren dürfen andere Mitglieder entfernen\./);
		assert.match(noAdminRemove.error!.message, /HTTP 403/);

		// C ist kein Mitglied — beide Aufrufe müssen an der Route mit 404 scheitern (kein Existenz-Leak).
		for (const [tool, args] of [
			['group_member_role_set', { groupId, userId: bId, role: 'member' }],
			['group_member_remove', { groupId, userId: bId }],
		] as const) {
			const foreign = await mcpCall(tokenC, tool, args);
			assert.ok(foreign.error, `${tool} auf eine fremde Gruppe muss fehlschlagen`);
			assert.match(foreign.error!.message, /Gruppe nicht gefunden\./);
			assert.match(foreign.error!.message, /HTTP 404/);
		}

		const members = await membersOf(tokenA, groupId);
		assert.deepEqual(
			members.map((m) => ({ userId: m.userId, role: m.role })).sort((x, y) => x.userId - y.userId),
			[
				{ userId: aId, role: 'admin' },
				{ userId: bId, role: 'member' },
			],
			'die Mitgliederliste darf durch die gescheiterten Aufrufe nicht verändert worden sein',
		);
	});

	it('AK5: ein Nur-lese-Token scheitert an beiden Werkzeugen am Scope-Hinweis, es ändern sich keine Daten', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const created = await mcpCall<GroupEntry>(tokenA, 'group_create', { name: 'Bleibt bei read-only erhalten' });
		const groupId = created.result!.id;
		await inviteAndAccept(cookieA, groupId, bId, cookieB);

		const { token } = await createReadOnlyToken(cookieA);
		for (const [tool, args] of [
			['group_member_role_set', { groupId, userId: bId, role: 'member' }],
			['group_member_remove', { groupId, userId: bId }],
		] as const) {
			const res = await mcpCall(token, tool, args);
			assert.ok(res.error, `${tool} muss mit einem Nur-lese-Token fehlschlagen`);
			assert.match(
				res.error!.message,
				/read access only/,
				`${tool}: Fehlertext muss die Rechtestufe benennen, war: ${res.error!.message}`,
			);
			assert.match(
				res.error!.message,
				/Lesen und Schreiben/,
				`${tool}: Fehlertext muss den Ausweg nennen, war: ${res.error!.message}`,
			);
		}

		const members = await mcpCall<MemberEntry[]>(token, 'group_members_list', { groupId });
		assert.equal(
			members.error,
			undefined,
			'group_members_list muss mit demselben Nur-lese-Token weiterhin funktionieren',
		);
		assert.equal(
			members.result?.length,
			2,
			'die Mitgliederliste darf durch die abgelehnten Aufrufe nicht verändert worden sein',
		);
	});
});

/**
 * Rote Spec-Tests für #1544 (Spec docs/spec/issue-1544.md) — Einladungen und Einladungslinks
 * über MCP: group_invitation_list, group_invitation_create, invitation_list,
 * invitation_accept, invitation_decline, invite_link_create, invite_link_delete.
 *
 * AK1: Katalog wächst auf 34 Namen, alle sieben neuen Werkzeuge mit vorgesehenen required-Feldern.
 * AK2: einladen → in beiden Listen sichtbar → annehmen macht Mitglied / ablehnen macht kein Mitglied.
 * AK3: invite_link_create liefert nutzbaren Link, invite_link_delete entzieht ihn (öffentlich 410).
 * AK4: Nicht-Admin (403) und fremdes Konto (404) erhalten den Routen-Fehlertext samt Statuscode,
 *      die Einladungsliste bleibt leer.
 * AK5: Nur-lese-Token scheitert an allen fünf schreibenden Werkzeugen am Scope-Hinweis; beide
 *      List-Werkzeuge bleiben nutzbar, die Einladung bleibt pending.
 *
 * Rot, bis die sieben Werkzeuge in mcpTools existieren (heute: "Unknown tool"-Fehler). KEIN Produktivcode.
 */
describe('MCP-Werkzeuge Einladungen/Einladungslinks (#1544)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => resetDb());
	after(async () => {
		await server.close();
		closeDb();
	});

	type GroupEntry = { id: number; name: string; description: string | null; role: string };
	type MemberEntry = { userId: number; displayName: string; role: string };
	type GroupInvitationEntry = { id: number; groupId: number; userId: number; displayName: string; status: string };
	type ReceivedInvitationEntry = { id: number; groupId: number; groupName: string; invitedByName: string };
	type InviteLinkEntry = { id: number; token: string; expiresAt: string };

	const ownUserId = async (cookie: string, ownDisplayName: string): Promise<number> => {
		const res = await server.json(`/users/search?query=${encodeURIComponent(ownDisplayName)}`, {
			headers: { Cookie: cookie },
		});
		const hits = (await res.json()) as { id: number; displayName: string }[];
		const hit = hits.find((h) => h.displayName === ownDisplayName);
		assert.ok(hit, `Setup: eigener Nutzer "${ownDisplayName}" muss über die Suche auffindbar sein`);
		return hit.id;
	};

	/** Legt Gruppe per MCP an (Admin = Token-Besitzer) und lädt B per API ein — Setup für Rollenfälle. */
	const createGroupViaMcp = async (token: string, name: string): Promise<number> => {
		const created = await mcpCall<GroupEntry>(token, 'group_create', { name });
		assert.equal(created.error, undefined, `Setup: group_create sollte gelingen: ${created.error?.message}`);
		return created.result!.id;
	};

	const inviteViaApi = async (adminCookie: string, groupId: number, invitedUserId: number): Promise<number> => {
		const res = await server.json(`/groups/${groupId}/invitations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
			body: JSON.stringify({ userId: invitedUserId }),
		});
		assert.equal(res.status, 201, 'Setup: Einladung muss anlegbar sein');
		return ((await res.json()) as { id: number }).id;
	};

	it('AK1: tools/list enthält alle sieben neuen Werkzeuge mit den vorgesehenen required-Feldern (31 gesamt)', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);

		const tools = await mcpListTools(token);
		const names = tools.map((t) => t.name);
		assert.equal(names.length, 31, `Katalog sollte einunddreißig Namen führen, war: ${names.join(', ')}`);
		for (const name of [
			'group_invitation_list',
			'group_invitation_create',
			'invitation_list',
			'invitation_accept',
			'invitation_decline',
			'invite_link_create',
			'invite_link_delete',
		]) {
			assert.ok(names.includes(name), `${name} muss im Katalog stehen`);
		}

		const requiredOf = (name: string) => {
			const tool = tools.find((t) => t.name === name);
			assert.ok(tool?.inputSchema, `${name} muss ein inputSchema deklarieren`);
			return (tool?.inputSchema as { required?: string[] } | undefined)?.required;
		};
		assert.deepEqual(requiredOf('group_invitation_list'), ['groupId']);
		assert.deepEqual(requiredOf('group_invitation_create'), ['groupId', 'userId']);
		assert.ok(!requiredOf('invitation_list')?.length, 'invitation_list darf keine Pflichtfelder haben');
		assert.deepEqual(requiredOf('invitation_accept'), ['id']);
		assert.deepEqual(requiredOf('invitation_decline'), ['id']);
		assert.deepEqual(requiredOf('invite_link_create'), ['groupId']);
		assert.deepEqual(requiredOf('invite_link_delete'), ['id']);
	});

	it('AK2: group_invitation_create lädt B ein — sichtbar in group_invitation_list und invitation_list —, invitation_accept macht B zum Mitglied', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const tokenB = await createToken(cookieB);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const groupId = await createGroupViaMcp(tokenA, 'Einladungs-Test');

		const invited = await mcpCall<GroupInvitationEntry>(tokenA, 'group_invitation_create', {
			groupId,
			userId: bId,
		});
		assert.equal(invited.error, undefined, `group_invitation_create sollte gelingen: ${invited.error?.message}`);
		assert.equal(invited.result?.userId, bId);
		assert.equal(invited.result?.status, 'pending');

		const groupInvitations = await mcpCall<GroupInvitationEntry[]>(tokenA, 'group_invitation_list', { groupId });
		assert.equal(
			groupInvitations.error,
			undefined,
			`group_invitation_list sollte gelingen: ${groupInvitations.error?.message}`,
		);
		assert.ok(
			groupInvitations.result?.some((i) => i.userId === bId && i.status === 'pending'),
			'group_invitation_list muss die offene Einladung für B enthalten',
		);

		const received = await mcpCall<ReceivedInvitationEntry[]>(tokenB, 'invitation_list');
		assert.equal(received.error, undefined, `invitation_list sollte gelingen: ${received.error?.message}`);
		const own = received.result?.find((i) => i.id === invited.result?.id);
		assert.ok(own, 'invitation_list des eingeladenen Kontos muss die Einladung enthalten');
		assert.equal(own.groupId, groupId);
		assert.equal(own.groupName, 'Einladungs-Test');

		const accepted = await mcpCall<{ groupId: number }>(tokenB, 'invitation_accept', { id: invited.result!.id });
		assert.equal(accepted.error, undefined, `invitation_accept sollte gelingen: ${accepted.error?.message}`);
		assert.equal(accepted.result?.groupId, groupId);

		const members = await mcpCall<MemberEntry[]>(tokenA, 'group_members_list', { groupId });
		const joined = members.result?.find((m) => m.userId === bId);
		assert.ok(joined, 'B muss nach invitation_accept in group_members_list auftauchen');
		assert.equal(joined.role, 'member');

		const receivedAfter = await mcpCall<ReceivedInvitationEntry[]>(tokenB, 'invitation_list');
		assert.ok(
			!receivedAfter.result?.some((i) => i.id === invited.result!.id),
			'die angenommene Einladung darf nicht mehr in invitation_list stehen',
		);
	});

	it('AK2: invitation_decline lässt B ohne Mitgliedschaft, die Einladung ist erledigt', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const tokenB = await createToken(cookieB);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const groupId = await createGroupViaMcp(tokenA, 'Ablehn-Test');
		const invitationId = await inviteViaApi(cookieA, groupId, bId);

		const declined = await mcpCall<{ groupId: number }>(tokenB, 'invitation_decline', { id: invitationId });
		assert.equal(declined.error, undefined, `invitation_decline sollte gelingen: ${declined.error?.message}`);
		assert.equal(declined.result?.groupId, groupId);

		const members = await mcpCall<MemberEntry[]>(tokenA, 'group_members_list', { groupId });
		assert.ok(!members.result?.some((m) => m.userId === bId), 'B darf nach invitation_decline nicht Mitglied sein');

		const groupInvitations = await mcpCall<GroupInvitationEntry[]>(tokenA, 'group_invitation_list', { groupId });
		assert.ok(
			!groupInvitations.result?.some((i) => i.userId === bId && i.status === 'pending'),
			'die abgelehnte Einladung darf nicht mehr als pending geführt sein',
		);
	});

	it('AK3: invite_link_create liefert einen nutzbaren Link, invite_link_delete entzieht ihn (öffentlicher Check 410)', async () => {
		const cookie = await server.register('mcp-tools-a@example.com', 'password123');
		const token = await createToken(cookie);
		const groupId = await createGroupViaMcp(token, 'Link-Test');

		const created = await mcpCall<InviteLinkEntry>(token, 'invite_link_create', { groupId });
		assert.equal(created.error, undefined, `invite_link_create sollte gelingen: ${created.error?.message}`);
		assert.ok(created.result?.id, 'die Antwort muss eine Link-ID tragen');
		assert.ok(
			typeof created.result?.token === 'string' && created.result.token.length >= 32,
			'Token muss hex ≥ 32 Zeichen sein',
		);
		assert.ok(created.result?.expiresAt, 'die Antwort muss expiresAt tragen');

		const beforeRevoke = await fetch(`${server.baseUrl}/invite-links/${created.result!.token}`);
		assert.equal(beforeRevoke.status, 200, 'der frische Link muss öffentlich nutzbar sein (200)');

		const deleted = await mcpCall(token, 'invite_link_delete', { id: created.result!.id });
		assert.equal(deleted.error, undefined, `invite_link_delete sollte gelingen (Route 204): ${deleted.error?.message}`);

		const afterRevoke = await fetch(`${server.baseUrl}/invite-links/${created.result!.token}`);
		assert.equal(afterRevoke.status, 410, 'der widerrufene Link muss öffentlich unbrauchbar sein (410)');
	});

	it('AK4: Nicht-Admin (403) und fremdes Konto (404) erhalten den Routen-Fehlertext samt Statuscode, es entsteht keine Einladung', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const cookieC = await server.register('mcp-tools-c@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const tokenB = await createToken(cookieB);
		const tokenC = await createToken(cookieC);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');
		const cId = await ownUserId(cookieC, 'mcp-tools-c@example.com');

		const groupId = await createGroupViaMcp(tokenA, 'Bleibt unverändert');
		// B wird normales Mitglied (Rolle member) — Einladen muss an der Route mit 403 scheitern.
		const invitationId = await inviteViaApi(cookieA, groupId, bId);
		const accept = await server.json(`/invitations/${invitationId}/accept`, {
			method: 'POST',
			headers: { Cookie: cookieB },
		});
		assert.equal(accept.status, 200, 'Setup: Einladung muss annehmbar sein');

		const noAdmin = await mcpCall(tokenB, 'group_invitation_create', { groupId, userId: cId });
		assert.ok(noAdmin.error, 'group_invitation_create ohne Adminrolle muss fehlschlagen');
		assert.match(noAdmin.error!.message, /Nur Administratoren dürfen einladen\./);
		assert.match(noAdmin.error!.message, /HTTP 403/);

		const foreign = await mcpCall(tokenC, 'group_invitation_create', { groupId, userId: bId });
		assert.ok(foreign.error, 'group_invitation_create auf eine fremde Gruppe muss fehlschlagen');
		assert.match(foreign.error!.message, /Gruppe nicht gefunden\./);
		assert.match(foreign.error!.message, /HTTP 404/);

		const groupInvitations = await mcpCall<GroupInvitationEntry[]>(tokenA, 'group_invitation_list', { groupId });
		assert.equal(
			groupInvitations.result?.length,
			0,
			'durch die gescheiterten Aufrufe darf keine Einladung entstanden sein',
		);
	});

	it('AK5: ein Nur-lese-Token scheitert an allen fünf schreibenden Werkzeugen am Scope-Hinweis; die List-Werkzeuge bleiben nutzbar, die Einladung bleibt pending', async () => {
		const cookieA = await server.register('mcp-tools-a@example.com', 'password123');
		const cookieB = await server.register('mcp-tools-b@example.com', 'password123');
		const tokenA = await createToken(cookieA);
		const bId = await ownUserId(cookieB, 'mcp-tools-b@example.com');

		const groupId = await createGroupViaMcp(tokenA, 'Bleibt bei read-only erhalten');
		const invitationId = await inviteViaApi(cookieA, groupId, bId);
		const link = await server.json(`/groups/${groupId}/invite-links`, {
			method: 'POST',
			headers: { Cookie: cookieA },
		});
		assert.equal(link.status, 201, 'Setup: Einladungslink muss anlegbar sein');
		const linkId = ((await link.json()) as { id: number }).id;

		const { token: readA } = await createReadOnlyToken(cookieA);
		const { token: readB } = await createReadOnlyToken(cookieB);
		for (const [tool, token, args] of [
			['group_invitation_create', readA, { groupId, userId: bId }],
			['invite_link_create', readA, { groupId }],
			['invite_link_delete', readA, { id: linkId }],
			['invitation_accept', readB, { id: invitationId }],
			['invitation_decline', readB, { id: invitationId }],
		] as const) {
			const res = await mcpCall(token, tool, args as Record<string, unknown>);
			assert.ok(res.error, `${tool} muss mit einem Nur-lese-Token fehlschlagen`);
			assert.match(
				res.error!.message,
				/read access only/,
				`${tool}: Fehlertext muss die Rechtestufe benennen, war: ${res.error!.message}`,
			);
			assert.match(
				res.error!.message,
				/Lesen und Schreiben/,
				`${tool}: Fehlertext muss den Ausweg nennen, war: ${res.error!.message}`,
			);
		}

		const groupInvitations = await mcpCall<GroupInvitationEntry[]>(readA, 'group_invitation_list', { groupId });
		assert.equal(
			groupInvitations.error,
			undefined,
			'group_invitation_list muss mit demselben Nur-lese-Token funktionieren',
		);
		assert.ok(
			groupInvitations.result?.some((i) => i.userId === bId && i.status === 'pending'),
			'die Einladung muss nach den abgelehnten Aufrufen unverändert pending sein',
		);

		const received = await mcpCall<ReceivedInvitationEntry[]>(readB, 'invitation_list');
		assert.equal(received.error, undefined, 'invitation_list muss mit demselben Nur-lese-Token funktionieren');
		assert.ok(
			received.result?.some((i) => i.id === invitationId),
			'die Einladung darf durch die abgelehnten Aufrufe nicht verschwunden sein',
		);

		const members = await mcpCall<MemberEntry[]>(tokenA, 'group_members_list', { groupId });
		assert.ok(
			!members.result?.some((m) => m.userId === bId),
			'B darf durch die abgelehnten Aufrufe nicht Mitglied geworden sein',
		);
	});
});
