/**
 * Cookieloses Matomo (selbst gehostet). Aktiv nur, wenn `MATOMO_URL` und `MATOMO_SITE_ID` beim Build
 * gesetzt sind; Website-Build und Vite hängen das Snippet in den `<head>`. Gezählt wird nur der Pfad:
 * Query und Hash tragen Anmelde-Tokens (`magic`, `token`) und Suchtexte.
 */
declare global {
	interface Window {
		_paq?: unknown[][];
	}
}

export const matomoScript = ({ MATOMO_URL, MATOMO_SITE_ID }: Record<string, string | undefined>): string => {
	const url = (MATOMO_URL ?? '').trim().replace(/\/*$/, '/');
	const siteId = (MATOMO_SITE_ID ?? '').trim();
	if (url === '/' || !/^\d+$/.test(siteId)) return '';
	return `<script>var _paq=window._paq=window._paq||[];_paq.push(['disableCookies'],['setDoNotTrack',true],['setCustomUrl',location.origin+location.pathname],['trackPageView'],['enableLinkTracking'],['setTrackerUrl',${JSON.stringify(`${url}matomo.php`)}],['setSiteId',${JSON.stringify(siteId)}]);var g=document.createElement('script');g.async=true;g.src=${JSON.stringify(`${url}matomo.js`)};document.head.appendChild(g);</script>`;
};

let lastPath: string | undefined;

/** Seitenwechsel der SPA melden; den ersten Aufruf zählt bereits das Snippet. */
export const trackPageView = (path: string): void => {
	if (lastPath !== undefined && lastPath !== path) {
		// Router-Pfade sind basename-relativ; die Fenster-URL trägt das /app/-Präfix.
		window._paq?.push(['setCustomUrl', location.origin + location.pathname], ['trackPageView']);
	}
	lastPath = path;
};
