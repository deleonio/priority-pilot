import { configDefaults, defineConfig } from 'vitest/config';

// Die Playwright-Specs unter e2e/ laufen nur über `pnpm test:e2e`. Mehrere Testdateien bauen nach `dist/`, daher nacheinander.
export default defineConfig({
	test: { fileParallelism: false, exclude: ['e2e/**', ...configDefaults.exclude] },
});
