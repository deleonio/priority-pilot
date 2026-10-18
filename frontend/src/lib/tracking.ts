/**
 * Seitenaufrufe der App an Matomo (Snippet: `matomo.ts`). Gemeldet werden Router-Pfade und die
 * Bildschirme vor dem Login (`/login`, `/einwilligung` …) unter `<Origin>/app<Pfad>`, im Android-Build
 * mit `SITE_URL` statt `https://localhost`. Der erste Aufruf setzt die Besuchsdimension 1 „Kanal“.
 * Eigene Datei, weil `matomo.ts` auch im Website-Build (Node, ohne Vite) läuft.
 */
import { ID_SEGMENT } from './matomo';
import { getChannel } from './platform';
import { getPublicOrigin } from './siteOrigin';

const CHANNEL_DIMENSION = 1;

const channel = (): string => {
	if (getChannel() === 'play') return 'android';
	return window.matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : 'web';
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
