import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

/** E2E der öffentlichen Website gegen das gebaute `dist/` (statischer Server, kein Backend nötig). */
export default defineConfig({
	testDir: './e2e',
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: 'list',
	use: { baseURL: `http://localhost:${PORT}`, locale: 'de-DE' },
	projects: [
		{ name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
	],
	webServer: {
		command: `pnpm build && PORT=${PORT} pnpm serve`,
		url: `http://localhost:${PORT}/`,
		reuseExistingServer: !process.env.CI,
	},
});
