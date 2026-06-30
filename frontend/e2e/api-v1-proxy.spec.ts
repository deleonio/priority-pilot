import { expect, test } from './fixtures';

/**
 * Rote Spec-Tests für Issue #171: Der Vite-Proxy soll von der Wurzelpfad-Allowlist
 * (`^/(tasks|pillars|forest|next|suggestions|series)`) auf ein einheitliches `/api/v1`-Präfix
 * mit Pfad-Rewrite (`/api/v1/tasks` → `/tasks`) umgestellt werden; die API-Client-Basis-URL in
 * `frontend/src/api.ts` wechselt entsprechend von `''` auf `/api/v1`.
 *
 * Diese Tests definieren den ausführbaren Vertrag und sind JETZT ROT: Solange der Proxy `/api/v1`
 * nicht kennt, fällt jede `/api/v1/...`-Anfrage auf den SPA-Fallback des Vite-Dev-Servers zurück
 * und liefert die `index.html` (Content-Type `text/html`, Status 200) statt JSON. Die Assertions
 * prüfen deshalb gezielt den Content-Type bzw. den erfolgreichen JSON-Parse — nicht bloß den
 * HTTP-Status, der beim HTML-Fallback ebenfalls 200 wäre.
 *
 * Annahmen (siehe `playwright.config.ts`): echtes Express-Backend auf Port 3000 mit frischer
 * In-Memory-DB, `DB_RESET=true`, `DB_SEED=false` → Tasks=[] (leer), Pillars=[Säulen-Stammdaten].
 * Der Vite-Dev-Server läuft auf Port 4173; `page.request.*` nutzt die `baseURL` des Dev-Servers.
 */
test.describe('/api/v1-Proxy-Routing — Spec für Issue #171', () => {
	test.beforeEach(async ({ page }) => {
		// App laden, damit der Vite-Dev-Server aktiv ist und `page.request` gegen seine baseURL läuft.
		await page.goto('/');
	});

	test('GET /api/v1/tasks gibt JSON zurück, kein HTML (AC-1)', async ({ page }) => {
		const response = await page.request.get('/api/v1/tasks');

		expect(response.status()).toBe(200);
		// Entscheidend: ohne Proxy-Rewrite liefert Vite den SPA-Fallback (text/html). Nur ein
		// JSON-Content-Type beweist, dass der Request bis zum Backend durchgereicht wurde.
		expect(response.headers()['content-type']).toContain('application/json');

		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	test('GET /api/v1/pillars gibt JSON-Array zurück (AC-1)', async ({ page }) => {
		const response = await page.request.get('/api/v1/pillars');

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');

		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	test('GET /api/v1/forest gibt JSON-Array zurück (AC-1)', async ({ page }) => {
		const response = await page.request.get('/api/v1/forest');

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');

		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	test('DELETE /api/v1/tasks/:id funktioniert durch den Proxy (Cleanup-Pfad, AC-4)', async ({ page }) => {
		// Spiegelt den e2e-Cleanup-Ablauf wider, der nach der Implementierung über `/api/v1` läuft:
		// einen Task anlegen und ihn über den DELETE-Pfad wieder abräumen — beides durch den Proxy.
		// TaskCreate verlangt laut openapi.yml nur `title` (Default: Status „Open", Priorität 3,
		// estimatedEffort 0,5). Bewusst minimal, um den Test an Schema-Defaults zu halten.
		const createResponse = await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E /api/v1 DELETE-Probe' },
		});
		// Der POST muss bereits JSON liefern (kein HTML-Fallback) und den angelegten Task zurückgeben.
		expect(createResponse.headers()['content-type']).toContain('application/json');
		expect([200, 201]).toContain(createResponse.status());

		const created = (await createResponse.json()) as { id: number };
		expect(typeof created.id).toBe('number');

		const deleteResponse = await page.request.delete(`/api/v1/tasks/${created.id}`);
		// DELETE muss durch den Proxy ans Backend gehen (kein 404/HTML-Fallback): erwartet 204 oder 200.
		expect([200, 204]).toContain(deleteResponse.status());

		// Gegenprobe: Der gelöschte Task taucht nicht mehr in der Liste auf — beweist den Durchstich.
		const listResponse = await page.request.get('/api/v1/tasks');
		expect(listResponse.headers()['content-type']).toContain('application/json');
		const tasks = (await listResponse.json()) as { id: number }[];
		expect(tasks.some((task) => task.id === created.id)).toBe(false);
	});
});
