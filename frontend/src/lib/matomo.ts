/**
 * Cookieloses Matomo (selbst gehostet). Aktiv nur, wenn `MATOMO_URL` und `MATOMO_SITE_ID` beim Build
 * gesetzt sind; Website-Build und Vite hängen das Snippet in den `<head>`. Gezählt wird nur der Pfad:
 * Query und Hash tragen Anmelde-Tokens (`magic`, `token`) und Suchtexte; Ziffern-Segmente (`/tasks/42`)
 * fasst `:id` zusammen. Ein unbekannter Pfad trägt den Titel `404/URL = <Pfad>`
 * (Matomo-Konvention, Bericht Seitentitel).
 */
declare global {
	interface Window {
		_paq?: unknown[][];
	}
}

const ID_SEGMENT = /\/\d+(?=\/|$)/g;

export const matomoScript = (
	{ MATOMO_URL, MATOMO_SITE_ID }: Record<string, string | undefined>,
	{ notFound = false } = {},
): string => {
	const url = (MATOMO_URL ?? '').trim().replace(/\/*$/, '/');
	const siteId = (MATOMO_SITE_ID ?? '').trim();
	if (url === '/' || !/^\d+$/.test(siteId)) return '';
	const title = notFound ? `,['setDocumentTitle','404/URL = '+location.pathname]` : '';
	return `<script>var _paq=window._paq=window._paq||[];_paq.push(['disableCookies'],['setDoNotTrack',true],['setCustomUrl',location.origin+location.pathname.replace(${ID_SEGMENT},'/:id')]${title},['trackPageView'],['enableLinkTracking'],['enableHeartBeatTimer'],['setTrackerUrl',${JSON.stringify(`${url}matomo.php`)}],['setSiteId',${JSON.stringify(siteId)}]);var g=document.createElement('script');g.async=true;g.src=${JSON.stringify(`${url}matomo.js`)};document.head.appendChild(g);</script>`;
};

let lastPath: string | undefined;
let lastUrl = '';

/** Seitenwechsel der SPA melden; den ersten Aufruf zählt bereits das Snippet. */
export const trackPageView = (path: string, known = true): void => {
	// Router-Pfade sind basename-relativ; die Fenster-URL trägt das /app/-Präfix.
	const url = location.origin + location.pathname.replace(ID_SEGMENT, '/:id');
	if (lastPath !== undefined && lastPath !== path) {
		window._paq?.push(
			['setReferrerUrl', lastUrl],
			['setCustomUrl', url],
			['setDocumentTitle', known ? path.replace(ID_SEGMENT, '/:id') : `404/URL = ${location.pathname}`],
			['trackPageView'],
		);
	}
	lastPath = path;
	lastUrl = url;
};
