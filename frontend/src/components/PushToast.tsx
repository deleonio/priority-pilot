import { KolAlert } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { isNativeChannel } from '../lib/platform';

/** Payload einer Push-Nachricht, wie sie `logics/push.ts` sendet und `push-sw.js` weiterreicht. */
interface PushPayload {
	title: string;
	body?: string;
}

/**
 * In-App-Hinweis auf eine eingegangene Push-Nachricht (#1391, AK2). Ist bei einem Nutzer ein
 * App-Fenster geöffnet, schickt `push-sw.js` die Payload zusätzlich zur System-Notification per
 * `client.postMessage({ type: 'push', payload })` an alle Fenster-Clients; diese Komponente hört
 * darauf und zeigt den Hinweis am unteren Viewport-Rand (`.push-toast` in app.css, Muster
 * `.update-prompt` aus #373). In der nativen App (#1679) übernimmt dieselbe Anzeige die Payload
 * von `pushNotificationReceived` — dort gibt es keinen Service Worker, und FCM zeigt bei offener
 * App keine System-Notification an.
 *
 * Unbedingt gemountet (neben `<UpdatePrompt />`), damit der Listener unabhängig vom
 * Service-Worker-Lebenszyklus existiert. Geschlossen wird ausschließlich per Schaltfläche — kein
 * Auto-Dismiss, damit die Meldung nicht unbemerkt verschwindet.
 *
 * Titel und Text stehen bewusst im Slot (Light DOM) statt in `_label`: KoliBri rendert `_label` im
 * Shadow DOM von `kol-alert`, wo weder der Unit-Test (`textContent`) noch Playwright den Text sieht.
 * Aus demselben Grund ist die Schließen-Schaltfläche ein nativer `<button>` im Slot (Präzedenz
 * `GeoBadge.tsx`) und nicht KoliBris eingebauter `_hasCloser` — nur so trägt sie das
 * `data-testid` des DOM-Kontrakts (docs/spec/issue-1391.md) und ist als 44px-Tap-Fläche messbar.
 */
export const PushToast = () => {
	const [toast, setToast] = useState<PushPayload | null>(null);

	useEffect(() => {
		if (isNativeChannel()) {
			// Native App (#1679): FCM zeigt eine Nachricht mit `notification`-Payload bei offener App
			// nicht als System-Notification an, sie kommt nur an `pushNotificationReceived`. Zuerst
			// prüfen: Der WebView kennt `navigator.serviceWorker` auch, dort kommt aber keine Push-Nachricht
			// an. Das Plugin wird wie in `lib/push.ts` erst on demand geladen, im Web-Bundle steckt es nicht.
			const onReceived = ({ title, body }: { title?: string; body?: string }) => {
				if (!title) {
					return;
				}
				flushSync(() => setToast({ title, body }));
			};
			let handle: { remove: () => Promise<unknown> } | undefined;
			let disposed = false;
			void import('@capacitor/push-notifications')
				.then(({ PushNotifications }) => PushNotifications.addListener('pushNotificationReceived', onReceived))
				.then((registered) => {
					if (disposed) {
						void registered.remove();
					} else {
						handle = registered;
					}
				})
				.catch(() => undefined);
			return () => {
				disposed = true;
				void handle?.remove();
			};
		}
		// Optional chaining: ohne Service-Worker-Unterstützung (z. B. unsicherer Kontext) gibt es
		// keine Nachrichten — der Mount darf dann trotzdem nicht werfen.
		const container = navigator.serviceWorker;
		if (!container) {
			return;
		}
		const onMessage = (event: Event) => {
			const data = (event as MessageEvent).data as { type?: string; payload?: PushPayload } | undefined;
			if (data?.type !== 'push' || !data.payload?.title) {
				return;
			}
			// `message` ist kein React-Event: ohne `flushSync` verschiebt React 19 das Rendern hinter
			// den Dispatch (Auto-Batching) — der Hinweis erschiene dann erst einen Tick später.
			flushSync(() => setToast(data.payload ?? null));
		};
		container.addEventListener('message', onMessage);
		return () => container.removeEventListener('message', onMessage);
	}, []);

	if (!toast) {
		return null;
	}

	return (
		<div className="push-toast">
			<KolAlert _type="success" _variant="card" _alert={true} data-testid="push-toast">
				<strong className="push-toast__title">{toast.title}</strong>
				{toast.body && <p className="push-toast__body">{toast.body}</p>}
				<button
					type="button"
					className="push-toast__close"
					data-testid="push-toast-close"
					onClick={() => setToast(null)}
				>
					Schließen
				</button>
			</KolAlert>
		</div>
	);
};
