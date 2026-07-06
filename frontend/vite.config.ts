import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as {
	version: string;
};

// Der Dev-Proxy leitet alle /api/v1/*-, /api/transit/*- und /auth/*-Anfragen an den
// Express-Server (http://localhost:3000) weiter. CORS wird damit im Browser ohne
// Server-Änderung gelöst. /api/v1/* streift das Präfix ab (Server-Routen liegen direkt
// unter /); /api/transit/* und /auth/* werden unverändert durchgereicht — Letzteres
// spiegelt den Caddy-handle-Block für den OAuth-Login-Flow (siehe docs/caddy-setup.md).
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
	'/auth': {
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
				// Ohne Denylist beantwortet der Service Worker JEDE Navigation mit der
				// gecachten index.html (navigateFallback) – auch /auth/google und den
				// Google-Callback. Der OAuth-Flow erreicht dann nie den Server (Symptom:
				// installierte PWA/Android-Chrome bleibt auf der Login-URL hängen).
				// API- und Auth-Pfade müssen daher immer ans Netzwerk durchgereicht werden.
				navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
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
						src: 'icons/icon-192x192.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any',
					},
					{
						src: 'icons/icon-512x512.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any',
					},
					{
						src: 'icons/icon-192x192-maskable.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'maskable',
					},
					{
						src: 'icons/icon-512x512-maskable.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'maskable',
					},
					{
						src: 'icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any maskable',
					},
				],
				shortcuts: [
					{
						name: 'Dashboard',
						url: '/',
						icons: [
							{
								src: 'icons/icon-192x192.svg',
								sizes: 'any',
								purpose: 'any',
							},
						],
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
	define: {
		__APP_VERSION__: JSON.stringify(rootPkg.version),
	},
	optimizeDeps: {
		// Der generierte Client liegt als TypeScript-Quelle im Workspace vor; Vite transpiliert ihn
		// direkt, statt ihn als externe Dependency vorzubündeln.
		exclude: ['client'],
	},
});
