import { KolButton, KolCard } from '@public-ui/react-v19';
import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA-Update-/Offline-Hinweis (#373). Am unteren Viewport-Rand fixiert (`.update-prompt` in
 * app.css) und mit KoliBri-`KolCard`/`KolButton` statt roher Container/Buttons aufgebaut.
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

	// Guard verhindert Doppel-Notification im selben needRefresh-Zyklus (#394).
	const notifiedRef = useRef(false);

	useEffect(() => {
		if (!needRefresh) {
			notifiedRef.current = false;
			return;
		}
		if (notifiedRef.current) return;
		if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

		notifiedRef.current = true;

		if (navigator.serviceWorker) {
			navigator.serviceWorker.ready.then((registration) => {
				registration.showNotification('Neue Version verfügbar', {
					body: 'Lade die Seite neu, um die neue Version zu verwenden.',
					tag: 'app-update',
				});
			});
		} else {
			new Notification('Neue Version verfügbar', {
				body: 'Lade die Seite neu, um die neue Version zu verwenden.',
				tag: 'app-update',
			});
		}
	}, [needRefresh]);

	if (!needRefresh && !offlineReady) {
		return null;
	}

	return (
		<div className="update-prompt">
			{needRefresh && (
				<KolCard _label="Update">
					<p>Neue Version verfügbar</p>
					<span data-testid="pwa-update-reload" onClick={() => updateServiceWorker(true)}>
						<KolButton _label="Neu laden" _variant="primary" />
					</span>
				</KolCard>
			)}
			{offlineReady && (
				<KolCard _label="Offline">
					<p>App ist offline-bereit</p>
					<span data-testid="pwa-offline-close" onClick={() => setOfflineReady(false)}>
						<KolButton _label="Schließen" _variant="secondary" />
					</span>
				</KolCard>
			)}
		</div>
	);
};
