import { configDefaults, defineConfig } from 'vitest/config';

// Die Playwright-Specs unter e2e/ laufen nur über `pnpm test:e2e`.
export default defineConfig({
	test: { exclude: ['e2e/**', ...configDefaults.exclude] },
});
