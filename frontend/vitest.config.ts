import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Eigene Vitest-Config (statt der vite.config.ts mit PWA/Proxy), damit der Test-Lauf schlank bleibt.
export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
	},
});
