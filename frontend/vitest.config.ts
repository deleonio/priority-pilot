import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Eigene Vitest-Config (statt der vite.config.ts mit PWA/Proxy), damit der Test-Lauf schlank bleibt.
export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		// Bindet Web Storage im jsdom-Env an jsdoms Implementierung (siehe vitest.setup.ts) —
		// nötig, weil Node ≥ 26 einen nativen, ohne --localstorage-file leeren localStorage-Global mitbringt.
		setupFiles: ['./vitest.setup.ts'],
		// Die Playwright-Specs unter e2e/ matchen Vitests Default-Include, würden aber unter jsdom
		// crashen (`@playwright/test`-Import). Daher zusätzlich zu den Vitest-Defaults ausschließen.
		exclude: ['**/e2e/**', ...configDefaults.exclude],
	},
});
