import { defineConfig, devices } from '@playwright/test';

// Fester Port für den Vite-Dev-Server, damit `baseURL` und der von Playwright gestartete
// `webServer` zusammenpassen. 4173 ist im Repo bereits als Frontend-Vorschau-Port etabliert.
const PORT = 4173;

/**
 * Playwright-Konfiguration für die Visual-Snapshot-Tests (`toHaveScreenshot`).
 *
 * Die API wird in den Specs via `page.route` gemockt — es läuft also **kein Backend**. Playwright
 * startet lediglich den Vite-Dev-Server (`vite --port 4173`) und treibt einen headless Chromium
 * gegen feste Fixtures, damit die Snapshots deterministisch sind.
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
		// Animationen sind bei toHaveScreenshot ohnehin Default-deaktiviert; hier zur Klarheit fixiert.
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
	},
	expect: {
		toHaveScreenshot: {
			// Toleranz gegen minimale Anti-Aliasing-/Subpixel-Unterschiede, ohne echte Regressionen
			// zu verschlucken.
			maxDiffPixelRatio: 0.01,
			threshold: 0.2,
			animations: 'disabled',
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
		},
	],
	webServer: {
		command: `pnpm dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
