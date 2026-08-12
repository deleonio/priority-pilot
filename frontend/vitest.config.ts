import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

// In Vitest 4.x / jsdom-Env gibt import.meta.url die Vite-Dev-Server-URL zurück (http://…),
// nicht die file://-URL. fileURLToPath() schlägt dadurch fehl. Wir patchen import.meta.url
// in Test-Dateien zur Build-Zeit auf den echten Dateipfad.
const fixImportMetaUrl = (): Plugin => ({
	name: 'fix-import-meta-url-in-tests',
	transform(code, id) {
		if (!id.includes('node_modules') && (id.endsWith('.test.ts') || id.endsWith('.test.tsx'))) {
			const escaped = JSON.stringify(`file://${id}`);
			return { code: code.replaceAll('import.meta.url', escaped), map: null };
		}
	},
});

// Stub-Plugin für das virtuelle PWA-Modul: Vitest kennt keinen VitePWA-Plugin-Kontext,
// deshalb stellen wir das virtuelle Modul als leeren Stub bereit — vi.mock() überschreibt
// ihn im jeweiligen Test vollständig.
const pwaVirtualStub = (): Plugin => ({
	name: 'vite-plugin-pwa-virtual-stub',
	resolveId(id) {
		if (id === 'virtual:pwa-register/react') return '\0virtual:pwa-register/react';
	},
	load(id) {
		if (id === '\0virtual:pwa-register/react') {
			return 'export const useRegisterSW = () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} });';
		}
	},
});

// Eigene Vitest-Config (statt der vite.config.ts mit PWA/Proxy), damit der Test-Lauf schlank bleibt.
export default defineConfig({
	plugins: [react(), pwaVirtualStub(), fixImportMetaUrl()],
	// Vite erbt `define` nicht automatisch in Vitest — daher hier gespiegelt, damit die Tests den
	// globalen `__APP_VERSION__` kennen (in der Prod-Build-Config wird er aus package.json injiziert).
	define: {
		__APP_VERSION__: JSON.stringify('0.0.0-test'),
	},
	test: {
		environment: 'jsdom',
		// Bindet Web Storage im jsdom-Env an jsdoms Implementierung (siehe vitest.setup.ts) —
		// nötig, weil Node ≥ 26 einen nativen, ohne --localstorage-file leeren localStorage-Global mitbringt.
		setupFiles: ['./vitest.setup.ts'],
		// Die Playwright-Specs unter e2e/ matchen Vitests Default-Include, würden aber unter jsdom
		// crashen (`@playwright/test`-Import). Daher zusätzlich zu den Vitest-Defaults ausschließen.
		// __quarantine__ (Issue #564): Quarantäne-Tests sind bewusst vom CI-Lauf ausgeschlossen –
		// sie bleiben als Nachschlagewerk im Repo, dürfen aber von keinem aktiven Runner erfasst
		// werden. Explizites Exclude, damit ein versehentlich rekursiver Include sie nie greift.
		exclude: ['**/e2e/**', '**/__quarantine__/**', ...configDefaults.exclude],
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
