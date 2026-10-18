/**
 * Cookieloses Matomo (selbst gehostet). Aktiv nur, wenn `MATOMO_URL` und `MATOMO_SITE_ID` beim Build
 * gesetzt sind; Website-Build und Vite hängen das Snippet in den `<head>`. Gezählt wird nur der Pfad:
 * Query und Hash tragen Anmelde-Tokens (`magic`, `token`) und Suchtexte; Ziffern-Segmente (`/tasks/42`)
 * fasst `:id` zusammen. Ein unbekannter Pfad trägt den Titel `404/URL = <Pfad>`
 * (Matomo-Konvention, Bericht Seitentitel). Die App (`pageView: false`) meldet ihre Aufrufe selbst
 * (`tracking.ts`), weil erst sie Bildschirm und Kanal kennt.
 */
declare global {
	interface Window {
		_paq?: unknown[][];
	}
}

export const ID_SEGMENT = /\/\d+(?=\/|$)/g;

export const matomoScript = (
	{ MATOMO_URL, MATOMO_SITE_ID }: Record<string, string | undefined>,
	{ notFound = false, pageView = true } = {},
): string => {
	const url = (MATOMO_URL ?? '').trim().replace(/\/*$/, '/');
	const siteId = (MATOMO_SITE_ID ?? '').trim();
	if (url === '/' || !/^\d+$/.test(siteId)) return '';
	const title = notFound ? `,['setDocumentTitle','404/URL = '+location.pathname]` : '';
	const view = pageView
		? `,['setCustomUrl',location.origin+location.pathname.replace(${ID_SEGMENT},'/:id')]${title},['trackPageView']`
		: '';
	return `<script>var _paq=window._paq=window._paq||[];_paq.push(['disableCookies'],['setDoNotTrack',true]${view},['enableLinkTracking'],['enableHeartBeatTimer'],['setTrackerUrl',${JSON.stringify(`${url}matomo.php`)}],['setSiteId',${JSON.stringify(siteId)}]);var g=document.createElement('script');g.async=true;g.src=${JSON.stringify(`${url}matomo.js`)};document.head.appendChild(g);</script>`;
};
