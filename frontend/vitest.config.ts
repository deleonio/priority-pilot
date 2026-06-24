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
		// Coverage-Gate gezielt für die reine Logik-Schicht (src/lib), passend zur TDD-Strategie
		// (Querschnitts-Politik, .ai-knowledge/tdd-strategy.md). Aktiv erst nach
		// `pnpm add -D @vitest/coverage-v8` und über das Script `test:coverage` (--coverage); der
		// normale `test`-Lauf bleibt unberührt. Schwellen sind konservative Startwerte — nach dem
		// ersten echten Lauf an die tatsächliche lib-Abdeckung anpassen.
		coverage: {
			provider: 'v8',
			include: ['src/lib/**'],
			thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
		},
	},
});
