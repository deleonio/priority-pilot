import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright-Konfiguration für die **funktionalen** E2E-Tests.
 *
 * Alle Specs laufen ohne `page.route`-Mock gegen ein **echtes** Express-Backend mit **temporärer
 * Wegwerf-DB** (`:memory:`, ohne Demo-Seed). Backend und Vite-Server startet seit #1364 NICHT mehr
 * der `webServer`-Block dieser Datei, sondern eine worker-scoped Fixture (`e2e/servers.ts`): Sie
 * gibt JEDEM Playwright-Worker sein eigenes Backend samt eigener DB und seinen eigenen
 * Vite-Server. Erst dadurch sind mehrere Worker je Shard möglich — mit einem gemeinsamen Backend
 * hätten sie sich gegenseitig die Daten überschrieben. Die Begründungen zur Backend-Umgebung
 * (leere Google-/LLM-Variablen, `NODE_ENV=test`) stehen dort.
 */
export default defineConfig({
	testDir: './e2e',
	// Backend EINMAL bauen, bevor die Worker starten — sonst bauen mehrere Worker gleichzeitig
	// ins selbe `server/dist`.
	globalSetup: './e2e/global-setup.ts',
	// Tests EINER Datei bleiben in Reihenfolge im selben Worker (sie teilen sich den Datenbestand
	// ihres Worker-Backends). Verschiedene Dateien laufen parallel — jede in ihrem eigenen Worker
	// mit eigener DB.
	fullyParallel: false,
	// Vier Kerne auf den GitHub-Läufern (public repo) und lokal; je Worker laufen Chromium,
	// ein Node-Backend und ein Vite-Server. Zwei Worker lasten das gut aus, ohne dass die Tests
	// durch CPU-Konkurrenz langsamer werden. Über E2E_WORKERS messbar/übersteuerbar.
	workers: Number(process.env.E2E_WORKERS ?? 2),
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: 'list',
	use: {
		// KEIN `baseURL` hier: Der Port haengt am Worker und kommt aus der `servers`-Fixture
		// (e2e/servers.ts), die die Option je Worker ueberschreibt.
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
});
