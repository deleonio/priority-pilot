/*
 * Kill-Switch für den alten App-Service-Worker (ADR 0015). Bis zum Umzug lag die PWA unter `/` und
 * ihr Service Worker unter `/sw.js` mit Scope `/`. Er würde sonst die öffentliche Website abfangen.
 * Beim nächsten Update-Check holt der Browser diese Datei, sie meldet sich sofort ab, löscht den
 * alten Precache und lädt offene Fenster neu. Die Website leitet angemeldete Nutzer dann nach
 * /app/ weiter (Merk-Cookie `bm_signed_in`), wo sich der neue Service Worker registriert.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const rootScope = `${self.location.origin}/`;
			for (const key of await caches.keys()) {
				// Nur Caches des alten Wurzel-Scopes löschen, nicht den der neuen App unter /app/.
				if (!key.includes(`${rootScope}app/`)) {
					await caches.delete(key);
				}
			}
			await self.registration.unregister();
			const windows = await self.clients.matchAll({ type: 'window' });
			for (const client of windows) {
				client.navigate(client.url);
			}
		})(),
	);
});
