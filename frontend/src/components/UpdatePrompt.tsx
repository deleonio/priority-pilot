import { KolButton, KolCard } from '@public-ui/react-v19';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { isNativeChannel } from '../lib/platform';

/**
 * In der nativen App (ADR 0016) entfällt der Hinweis samt Service-Worker-Registrierung. Ein früher
 * registrierter Service Worker liefert dort aber weiter seinen alten Stand aus; er wird deshalb
 * abgemeldet und die App einmal frisch vom Server geladen.
 */
export const UpdatePrompt = () => (isNativeChannel() ? <NativeServiceWorkerCleanup /> : <PwaUpdatePrompt />);

const NativeServiceWorkerCleanup = () => {
	useEffect(() => {
		if (!('serviceWorker' in navigator)) {
			return;
		}
		navigator.serviceWorker
			.getRegistrations()
			.then(async (registrations) => {
				if (registrations.length === 0) {
					return;
				}
				await Promise.all(registrations.map((registration) => registration.unregister()));
				location.reload();
			})
			.catch(() => {});
	}, []);
	return null;
};

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
const PwaUpdatePrompt = () => {
	const { t } = useTranslation('onboarding');
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
	// erzeugen (listenerRegisteredRef). `updateServiceWorker(true)` selbst läuft bei jedem Klick:
	// trifft kein Controller-Wechsel ein (z. B. weil der neue Service-Worker noch installiert),
	// bleibt der Button damit die einzige Wiederholungsmöglichkeit.
	const listenerRegisteredRef = useRef(false);
	const reloadedRef = useRef(false);

	const confirmUpdate = () => {
		updateServiceWorker(true);
		if (listenerRegisteredRef.current) {
			return;
		}
		listenerRegisteredRef.current = true;
		// Optional chaining: ohne Service-Worker-Unterstützung (z. B. unsicherer Kontext) gibt es
		// keinen Controller-Wechsel — der Klick darf dann trotzdem nicht werfen.
		navigator.serviceWorker?.addEventListener('controllerchange', () => {
			// Idempotenz: mehrere Controller-Wechsel (Workbox-Pfad + eigener Fallback) → genau 1 Reload.
			if (reloadedRef.current) {
				return;
			}
			reloadedRef.current = true;
			window.location.reload();
		});
	};

	if (!needRefresh && !offlineReady) {
		return null;
	}

	return (
		<div className="update-prompt">
			{needRefresh && (
				<KolCard _label={t('update.newVersionTitle')}>
					<p>{t('update.newVersionText')}</p>
					<span data-testid="pwa-update-reload" onClick={confirmUpdate}>
						<KolButton _label={t('update.reloadNow')} _variant="primary" />
					</span>
				</KolCard>
			)}
			{offlineReady && (
				<KolCard _label={t('update.offlineTitle')}>
					<p>{t('update.offlineText')}</p>
					<span data-testid="pwa-offline-close" onClick={() => setOfflineReady(false)}>
						<KolButton _label={t('update.gotIt')} _variant="secondary" />
					</span>
				</KolCard>
			)}
		</div>
	);
};
