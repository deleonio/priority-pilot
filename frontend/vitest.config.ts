import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Eigene Vitest-Config (statt der vite.config.ts mit PWA/Proxy), damit der Test-Lauf schlank bleibt.
export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		// Vitest deckt ausschließlich die Unit-Tests unter src/ ab. Die enge include-Glob hält die
		// Playwright-E2E-Specs in e2e/ aus dem Lauf heraus (sonst schlägt `pnpm test` an Playwrights
		// test.describe() fehl, weil dessen APIs unter Vitest nicht verfügbar sind); die E2E-Tests
		// laufen nur über `pnpm test:e2e`.
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
	},
});
