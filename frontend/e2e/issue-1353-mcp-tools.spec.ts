import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Funktionale E2E-Spec für #1353 (AK9) — MCP-Werkzeuge v1 gegen das **echte** Backend.
 *
 * AK9: Eine über `POST /mcp/v1` (JSON-RPC 2.0, `tools/call` → `task_create`) angelegte Aufgabe ist
 * anschließend in der Weboberfläche sichtbar. Damit ist belegt, dass das Werkzeug die vorhandene
 * Task-Route spiegelt und dieselben Daten schreibt, die die App liest (kein zweiter Fachlogikpfad).
 *
 * **Auth-Aufbau:** Die MCP-Route hängt hinter `requireAuth`; der Werkzeugaufruf authentifiziert sich
 * per `Authorization: Bearer …` gegen einen API-Token (#1352). Der Token wird über eine echte Session
 * angelegt (`POST /auth/test-login` wie in `issue-1352-api-tokens.spec.ts` — im Pass-Through-Modus
 * liefern die Token-Routen sonst 401).
 *
 * Der MCP-Aufruf läuft bewusst über die **`request`**-Fixture statt über `page.request`: die hat einen
 * eigenen Cookie-Jar ohne die Session aus dem Browser-Kontext. Der Aufruf ist damit rein
 * Bearer-authentifiziert — sonst könnte ihn eine mitgesendete Session tragen und der Test bewiese
 * nichts über den Token-Pfad.
 */

const TEST_EMAIL = 'mcp-tools-e2e@example.com';

/** Legt eine echte Session im Kontext der Page an — ohne sie liefern die Token-Routen 401. */
const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'MCP Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
};

/** Erzeugt einen API-Token für die eingeloggte Session und gibt den Klartext zurück. */
const createApiToken = async (page: Page): Promise<string> => {
	const res = await page.request.post('/api/v1/api-tokens', { data: { name: 'e2e-mcp' } });
	expect(res.status(), 'API-Token muss anlegbar sein').toBe(201);
	return ((await res.json()) as { token: string }).token;
};

test.describe('Priority Pilot — #1353: MCP-Werkzeuge v1 (AK9)', () => {
	test.afterEach(async ({ page }) => {
		const tasks = await page.request.get('/api/v1/tasks');
		if (tasks.ok()) {
			for (const task of (await tasks.json()) as { id: number }[]) {
				await page.request.delete(`/api/v1/tasks/${task.id}`);
			}
		}
		const tokens = await page.request.get('/api/v1/api-tokens');
		if (tokens.ok()) {
			for (const token of (await tokens.json()) as { id: number }[]) {
				await page.request.delete(`/api/v1/api-tokens/${token.id}`);
			}
		}
	});

	test('AK9: über /mcp/v1 angelegte Aufgabe ist in der Weboberfläche sichtbar', async ({ page, request }) => {
		await login(page);
		const token = await createApiToken(page);

		const title = `E2E MCP ${Date.now().toString().slice(-6)}`;
		const rpc = await request.post('/api/v1/mcp/v1', {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json, text/event-stream',
			},
			data: {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'task_create', arguments: { title } },
			},
		});
		expect(rpc.status(), 'tools/call muss 200 liefern').toBe(200);
		// Das Ergebnis reist spec-konform als CallToolResult — Roh-Payload als JSON-Text im ersten
		// Content-Block (server/src/mcp/server.ts, mcp-handshake.test.ts).
		const body = (await rpc.json()) as {
			result?: { content?: { type: string; text: string }[] };
			error?: { message: string };
		};
		expect(body.error, `task_create darf nicht fehlschlagen: ${body.error?.message ?? ''}`).toBeUndefined();
		const created = JSON.parse(body.result?.content?.[0]?.text ?? 'null') as { id: number; title: string };
		expect(created.title).toBe(title);

		// Sichtbarkeit in der App: die Aufgabenliste liegt hinter dem Tab „Aufgaben" (crud.spec.ts).
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});
});
