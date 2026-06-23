import { defineConfig, devices } from '@playwright/test';

// Fester Port für den Vite-Dev-Server, damit `baseURL` und der von Playwright gestartete
// `webServer` zusammenpassen. 4173 ist im Repo bereits als Frontend-Vorschau-Port etabliert.
const PORT = 4173;

// Port des echten Express-Backends. `frontend/vite.config.ts` proxyt die API-Pfade bereits auf
// genau diesen Port — ohne `page.route`-Mock spricht die UI damit automatisch das echte Backend an.
const BACKEND_PORT = 3000;

/**
 * Playwright-Konfiguration für die E2E-Tests.
 *
 * Zwei Betriebsarten teilen sich diese Config:
 * - **Visual-Snapshots** (`snapshots.spec.ts`) und **Formular-Klicktests** (`forms.spec.ts`) mocken
 *   die API via `page.route` — für sie ist das Backend irrelevant.
 * - **Funktionale E2E** (`smoke.spec.ts`, später die CRUD-Specs aus #B) laufen gegen ein **echtes**
 *   Express-Backend mit **temporärer Wegwerf-DB** (`:memory:`), ohne Mock.
 *
 * Dafür startet Playwright **zwei** Server: das Backend (frische In-Memory-DB, ohne Demo-Seed) und
 * den Vite-Dev-Server. Der Vite-Proxy (siehe `vite.config.ts`) reicht die API-Requests an das
 * Backend durch.
 */
export default defineConfig({
	testDir: './e2e',
	// Voll deterministisch: keine parallele Race auf denselben Dev-Server, ein fester Worker.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: 'list',
	// Snapshots neben den Specs ablegen (Baselines werden committet, siehe .gitignore).
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
	use: {
		baseURL: `http://localhost:${PORT}`,
		// Deterministisches, festes Viewport + Scale-Faktor für reproduzierbare Pixel.
		viewport: { width: 1280, height: 900 },
		deviceScaleFactor: 1,
		// Feste Locale/Zeitzone, damit Datums-/Zahlenformate in den Snapshots reproduzierbar sind.
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
	},
	expect: {
		toHaveScreenshot: {
			// Toleranz gegen minimale Anti-Aliasing-/Subpixel-Unterschiede, ohne echte Regressionen
			// zu verschlucken.
			maxDiffPixelRatio: 0.01,
			threshold: 0.2,
			// Animationen sind bei toHaveScreenshot ohnehin Default-deaktiviert; hier zur Klarheit fixiert.
			animations: 'disabled',
		},
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
			reuseExistingServer: !process.env.CI,
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
