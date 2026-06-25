import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Der Dev-Proxy leitet die API-Pfade an den Express-Server (http://localhost:3000) weiter und
// löst damit CORS im Browser, ohne den Server anpassen zu müssen.
// Achtung: Die Wurzelpfade sind hier als Allowlist gepflegt (siehe openapi.yml: /tasks, /pillars,
// /forest, /next, /suggestions, /series) — kommt im Vertrag ein neuer Wurzelpfad hinzu, muss er hier
// ergänzt werden. Wird sowohl für den Dev-Server als auch für `vite preview` verwendet, damit in
// beiden Modi kein CORS auftritt.
const apiProxy = {
	'^/(tasks|pillars|forest|next|suggestions|series)': {
		target: 'http://localhost:3000',
		changeOrigin: true,
	},
};

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				// KoliBri registriert seine Web-Components gebündelt; der resultierende Chunk
				// überschreitet das Workbox-Standardlimit von 2 MiB für den Precache.
				maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
			},
			manifest: {
				name: 'Priority Pilot',
				short_name: 'Priority Pilot',
				description: 'Aufgaben-Priorisierung über einen gewichteten Abhängigkeitsgraphen und Lebensbalance-Säulen.',
				theme_color: '#1a1a1a',
				background_color: '#ffffff',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: 'icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any maskable',
					},
				],
			},
		}),
	],
	server: {
		proxy: apiProxy,
	},
	preview: {
		proxy: apiProxy,
	},
	optimizeDeps: {
		// Der generierte Client liegt als TypeScript-Quelle im Workspace vor; Vite transpiliert ihn
		// direkt, statt ihn als externe Dependency vorzubündeln.
		exclude: ['client'],
	},
});
