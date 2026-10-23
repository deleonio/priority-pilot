/**
 * Seitenaufrufe der App an Matomo (Snippet: `matomo.ts`). Gemeldet werden Router-Pfade und die
 * Bildschirme vor dem Login (`/login`, `/einwilligung` …) unter `<Origin>/app<Pfad>`, im Android-Build
 * mit `SITE_URL` statt `https://localhost`. Der erste Aufruf setzt die Besuchsdimension 1 „Kanal“.
 * Eigene Datei, weil `matomo.ts` auch im Website-Build (Node, ohne Vite) läuft.
 */
import { useCallback, useState } from 'react';
import { ID_SEGMENT } from './matomo';
import { getChannel } from './platform';
import { getPublicOrigin } from './siteOrigin';

const CHANNEL_DIMENSION = 1;

const channel = (): string => {
	if (getChannel() === 'play') return 'android';
	return window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches ? 'pwa' : 'web';
};

let lastPath: string | undefined;
let lastUrl = '';

/** Bildschirm melden; derselbe Pfad zweimal hintereinander zählt einmal. */
export const trackPageView = (path: string, { known = true } = {}): void => {
	if (path === lastPath) return;
	const url = `${getPublicOrigin()}/app${path.replace(ID_SEGMENT, '/:id')}`;
	window._paq?.push(
		...(lastPath === undefined
			? [['setCustomDimension', CHANNEL_DIMENSION, channel()]]
			: [['setReferrerUrl', lastUrl]]),
		['setCustomUrl', url],
		['setDocumentTitle', known ? path.replace(ID_SEGMENT, '/:id') : `404/URL = /app${path}`],
		['trackPageView'],
	);
	lastPath = path;
	lastUrl = url;
};

/**
 * Wahl zur Reichweitenmessung (#2734) über `window.bmTracking` aus dem Snippet. `available` ist
 * falsch, wenn Matomo im Build aus ist; dann zeigt die App weder Hinweis noch Schalter.
 */
export const useTrackingConsent = () => {
	const [consent, setConsentState] = useState(() => window.bmTracking?.get() ?? null);
	const setConsent = useCallback((on: boolean): void => {
		window.bmTracking?.set(on);
		setConsentState(on ? 'on' : 'off');
	}, []);
	return { available: window.bmTracking !== undefined, consent, setConsent };
};
