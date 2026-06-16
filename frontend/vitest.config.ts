import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Eigene Vitest-Config (statt der vite.config.ts mit PWA/Proxy), damit der Test-Lauf schlank bleibt.
export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		// Vitest deckt ausschließlich die Unit-Tests unter src/ ab. Die Playwright-E2E-Specs in
		// e2e/ laufen nur über `pnpm test:e2e` und dürfen nicht von Vitests Default-Glob
		// eingesammelt werden (sonst schlägt `pnpm test` fehl, weil die Playwright-APIs unter
		// Vitest nicht verfügbar sind).
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		exclude: [...configDefaults.exclude, 'e2e/**'],
	},
});
