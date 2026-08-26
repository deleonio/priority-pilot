import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as {
	version: string;
};

// Ziel des Dev-Proxys. Default ist der reguläre Backend-Port (`pnpm dev`, E2E-Suite); über
// `API_PROXY_TARGET` schiebt ihn das Browser-MCP-Inspect-Setup auf seinen eigenen Backend-Port,
// damit es neben `pnpm dev` und `test:e2e` kollisionsfrei laufen kann (siehe docs/browser-mcp.md).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// Der Dev-Proxy leitet alle /api/v1/*-, /api/transit/*- und /auth/*-Anfragen an den
// Express-Server (http://localhost:3000) weiter. CORS wird damit im Browser ohne
// Server-Änderung gelöst. /api/v1/* streift das Präfix ab (Server-Routen liegen direkt
// unter /); /api/transit/* und /auth/* werden unverändert durchgereicht – Letzteres
// spiegelt den Caddy-handle-Block für den OAuth-Login-Flow (siehe docs/server-setup.md § 7).
const apiProxy = {
	'/api/v1': {
		target: apiTarget,
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/api\/v1/, ''),
	},
	'/api/transit': {
		target: apiTarget,
		changeOrigin: true,
	},
	'/auth': {
		target: apiTarget,
		changeOrigin: true,
	},
};

export default defineConfig({
	plugins: [
		react(),
		{
			name: 'serve-docs-user-guide',
			configureServer(server) {
				server.middlewares.use('/user-guide.md', async (req, res) => {
					const fs = await import('node:fs/promises');
					const path = await import('node:path');
					const filePath = path.resolve(__dirname, '../docs/user-guide.md');
					try {
						const content = await fs.readFile(filePath, 'utf-8');
						res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
						return res.end(content);
					} catch {
						res.statusCode = 404;
						return res.end('Handbuch nicht gefunden');
					}
				});
			},
			apply: 'serve',
		},
		{
			name: 'copy-docs-user-guide',
			apply: 'build',
			generateBundle() {
				const source = resolve(__dirname, '../docs/user-guide.md');
				const destDir = resolve(__dirname, 'dist');
				if (!existsSync(destDir)) {
					mkdirSync(destDir, { recursive: true });
				}
				copyFileSync(source, resolve(destDir, 'user-guide.md'));
			},
		},
		VitePWA({
			registerType: 'prompt',
			workbox: {
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: false,
				// Push-Handler (push/notificationclick) aus public/push-sw.js in den generierten
				// Workbox-SW einbinden (Issue #355). Die Datei liegt in public/ und wird nach / kopiert.
				importScripts: ['/push-sw.js'],
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
						src: 'icons/icon-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: 'icons/icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: 'icons/icon-192x192-maskable.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable',
					},
					{
						src: 'icons/icon-512x512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
				shortcuts: [
					{
						name: 'Dashboard',
						url: '/',
						icons: [
							{
								src: 'icons/icon-192x192.png',
								sizes: '192x192',
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
