import { KolButton, KolCard } from '@public-ui/react-v19';
import { useRegisterSW } from 'virtual:pwa-register/react';

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

	if (!needRefresh && !offlineReady) {
		return null;
	}

	return (
		<div className="update-prompt">
			{needRefresh && (
				<KolCard _label="Neue Version verfügbar">
					<p>Priority Pilot wurde aktualisiert. Lade die App neu, um die neue Version zu nutzen.</p>
					<span data-testid="pwa-update-reload" onClick={() => updateServiceWorker(true)}>
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
