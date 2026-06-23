import { defineConfig, devices } from '@playwright/test';

// Fester Port für den Vite-Dev-Server, damit `baseURL` und der von Playwright gestartete
// `webServer` zusammenpassen. 4173 ist im Repo bereits als Frontend-Vorschau-Port etabliert.
const PORT = 4173;

// Port des echten Express-Backends. `frontend/vite.config.ts` proxyt die API-Pfade bereits auf
// genau diesen Port — ohne `page.route`-Mock spricht die UI damit automatisch das echte Backend an.
const BACKEND_PORT = 3000;

/**
 * Playwright-Konfiguration für die **funktionalen** E2E-Tests (`smoke.spec.ts`, `crud.spec.ts`).
 *
 * Alle Specs laufen ohne `page.route`-Mock gegen ein **echtes** Express-Backend mit **temporärer
 * Wegwerf-DB** (`:memory:`, ohne Demo-Seed). Dafür startet Playwright **zwei** Server: das Backend
 * (frische In-Memory-DB) und den Vite-Dev-Server. Der Vite-Proxy (siehe `vite.config.ts`) reicht die
 * API-Requests an das Backend durch.
 */
export default defineConfig({
	testDir: './e2e',
	// Voll deterministisch: keine parallele Race auf denselben Dev-Server, ein fester Worker. Zugleich
	// teilen sich alle Specs die eine In-Memory-DB des Backend-Prozesses (kein Neustart zwischen Tests).
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		// Festes Viewport für ein deterministisches, reproduzierbares Layout.
		viewport: { width: 1280, height: 900 },
		deviceScaleFactor: 1,
		// Feste Locale/Zeitzone, damit Datums-/Zahlenformate reproduzierbar sind.
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
		},
	],
	webServer: [
		// Echtes Express-Backend mit frischer, temporärer In-Memory-DB. `DB_RESET=true` erzwingt ein
		// leeres Schema, `DB_SEED=false` schaltet den Demo-Seed ab (nur die Säulen-Stammdaten bleiben) —
		// die Tests starten so von einem leeren, definierten Zustand. Als Bereitschafts-URL dient
		// `/tasks` (liefert HTTP 200 mit leerer Liste); die Wurzel `/` hätte keine Route und damit
		// einen 404, den Playwright nicht als „bereit" wertet.
		{
			command: 'pnpm --filter priority-pilot dev',
			url: `http://localhost:${BACKEND_PORT}/tasks`,
			env: {
				PORT: String(BACKEND_PORT),
				DB_RESET: 'true',
				DB_SEED: 'false',
				DATABASE_STORAGE: ':memory:',
			},
			// Backend bewusst NIE wiederverwenden: ein lokal laufendes `pnpm --filter priority-pilot dev`
			// nutzt die persistente, geseedete `./database.sqlite` — das würde den leeren, definierten
			// Zustand (`:memory:`, ohne Demo-Seed) aushebeln und `smoke.spec.ts`/künftige CRUD-Specs
			// gegen Fremddaten laufen lassen. Anders als beim zustandslosen Vite-Server unten ist Reuse
			// hier nicht unkritisch, daher immer frisch starten.
			reuseExistingServer: false,
			timeout: 120_000,
		},
		// Vite-Dev-Server; sein Proxy reicht die API-Requests an das Backend oben durch.
		{
			command: `pnpm dev --port ${PORT} --strictPort`,
			url: `http://localhost:${PORT}`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
	],
});
