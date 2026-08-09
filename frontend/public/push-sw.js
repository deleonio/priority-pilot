/*
 * Push-Service-Worker-Ergänzung (Issue #355).
 *
 * Diese Datei wird über `workbox.importScripts: ['/push-sw.js']` (siehe frontend/vite.config.ts) in
 * den von vite-plugin-pwa/Workbox generierten Service Worker eingebunden und läuft damit in dessen
 * Scope (`self` = ServiceWorkerGlobalScope). Sie ergänzt zwei Handler:
 *
 *  - `push`: zeigt die vom Server (`web-push`) gesendete Notification an. Die Payload ist das JSON
 *    aus `logics/push.ts` (`{ title, body?, url? }`).
 *  - `notificationclick`: fokussiert ein bereits offenes App-Fenster (und navigiert es ggf. zur
 *    Ziel-URL) oder öffnet ein neues.
 */

/* global self, clients */

self.addEventListener('push', (event) => {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		// Kein gültiges JSON (z. B. reiner Text) — den Rohtext als Body anzeigen.
		payload = { body: event.data ? event.data.text() : '' };
	}

	const title = payload.title || 'Priority Pilot';
	const options = {
		body: payload.body || '',
		icon: '/icons/icon-192x192.png',
		badge: '/icons/icon-192x192.png',
		// Stabiler Tag (#504): aufeinanderfolgende Pushes ersetzen die vorige Notification,
		// statt sie zu stapeln (Coalescing im Notification-Shade / Sperrbildschirm).
		tag: 'priority-pilot',
		// Ziel-URL für den notificationclick-Handler mitgeben (Default: App-Wurzel).
		data: { url: payload.url || '/' },
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const targetUrl = (event.notification.data && event.notification.data.url) || '/';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				// Bereits offenes Fenster fokussieren (und bei Bedarf zur Ziel-URL navigieren).
				if ('focus' in client) {
					if ('navigate' in client && client.url !== new URL(targetUrl, self.location.origin).href) {
						return client.focus().then(() => client.navigate(targetUrl));
					}
					return client.focus();
				}
			}
			// Kein Fenster offen — ein neues öffnen.
			if (self.clients.openWindow) {
				return self.clients.openWindow(targetUrl);
			}
			return undefined;
		}),
	);
});
