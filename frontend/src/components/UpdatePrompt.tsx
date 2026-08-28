import { KolButton, KolCard } from '@public-ui/react-v19';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useRef } from 'react';

/**
 * PWA-Update-/Offline-Hinweis (#373). Am unteren Viewport-Rand fixiert (`.update-prompt` in
 * app.css) und mit KoliBri-`KolCard`/`KolButton` statt roher Container/Buttons aufgebaut.
 *
 * Update-Hinweis ausschließlich als In-App-Card (nicht zusätzlich als System-Notification) —
 * System-Notifications bleiben den echten Push-Nachrichten (`push-sw.js`) vorbehalten, damit
 * bei einem Update nicht zwei Benachrichtigungen mit gleichem Inhalt erscheinen.
 *
 * Klick-Naht: KoliBris `KolButton` ist ein Web Component, dessen `_on.onClick` in JSDOM nicht über
 * einen echten DOM-Klick auslösbar ist (siehe InstallPrompt-Präzedenzfall). Der Handler sitzt daher
 * auf einem nativen `<span>`-Wrapper mit `data-testid`; sowohl ein realer Button-Klick als auch der
 * Testklick auf den Wrapper lösen ihn per Event-Bubbling aus (der Klick des Shadow-DOM-Buttons
 * blubbert an den Wrapper). So bleibt genau ein Handler-Pfad – keine Doppelauslösung.
 */
export const UpdatePrompt = () => {
	const {
		needRefresh: [needRefresh],
		offlineReady: [offlineReady, setOfflineReady],
		updateServiceWorker,
	} = useRegisterSW();

	// Reload-Fallback (#1095): `updateServiceWorker(true)` reloadet nur, wenn die interne
	// Workbox-Kette (SKIP_WAITING → Aktivierung → `controlling`) vollständig durchläuft. Bricht
	// sie in der installierten PWA ab, bleibt der Dialog offen und es passiert nichts. Die
	// Bestätigung verdrahtet daher zusätzlich einen eigenen `controllerchange`-Listener, der den
	// Reload garantiert auslöst. Die Registrierung erfolgt ausschließlich nach Bestätigung (kein
	// Auto-Reload beim Mount) und nur einmalig — ein zweiter Klick darf keinen zweiten Listener
	// erzeugen (bestätigtRef).
	const bestätigtRef = useRef(false);
	const reloadtRef = useRef(false);

	const confirmUpdate = () => {
		if (bestätigtRef.current) {
			return;
		}
		bestätigtRef.current = true;
		updateServiceWorker(true);
		// Optional chaining: ohne Service-Worker-Unterstützung (z. B. unsicherer Kontext) gibt es
		// keinen Controller-Wechsel — der Klick darf dann trotzdem nicht werfen.
		navigator.serviceWorker?.addEventListener('controllerchange', () => {
			// Idempotenz: mehrere Controller-Wechsel (Workbox-Pfad + eigener Fallback) → genau 1 Reload.
			if (reloadtRef.current) {
				return;
			}
			reloadtRef.current = true;
			window.location.reload();
		});
	};

	if (!needRefresh && !offlineReady) {
		return null;
	}

	return (
		<div className="update-prompt">
			{needRefresh && (
				<KolCard _label="Neue Version verfügbar">
					<p>Priority Pilot wurde aktualisiert. Lade die App neu, um die neue Version zu nutzen.</p>
					<span data-testid="pwa-update-reload" onClick={confirmUpdate}>
						<KolButton _label="Jetzt neu laden" _variant="primary" />
					</span>
				</KolCard>
			)}
			{offlineReady && (
				<KolCard _label="Offline einsatzbereit">
					<p>Priority Pilot funktioniert ab jetzt auch ohne Internetverbindung.</p>
					<span data-testid="pwa-offline-close" onClick={() => setOfflineReady(false)}>
						<KolButton _label="Verstanden" _variant="secondary" />
					</span>
				</KolCard>
			)}
		</div>
	);
};
