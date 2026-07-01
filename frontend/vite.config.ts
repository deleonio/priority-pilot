import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Der Dev-Proxy leitet alle /api/v1/*- und /api/transit/*-Anfragen an den Express-Server
// (http://localhost:3000) weiter. CORS wird damit im Browser ohne Server-Änderung gelöst.
// /api/v1/* streift das Präfix ab (Server-Routen liegen direkt unter /); /api/transit/*
// wird unverändert durchgereicht (Server mountet transitRouter unter /api/transit).
const apiProxy = {
	'/api/v1': {
		target: 'http://localhost:3000',
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/api\/v1/, ''),
	},
	'/api/transit': {
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
