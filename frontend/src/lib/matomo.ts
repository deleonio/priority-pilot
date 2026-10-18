/**
 * Cookieloses Matomo (selbst gehostet). Aktiv nur, wenn `MATOMO_URL` und `MATOMO_SITE_ID` beim Build
 * gesetzt sind; Website-Build und Vite hängen das Snippet in den `<head>`. Gezählt wird nur der Pfad:
 * Query und Hash tragen Anmelde-Tokens (`magic`, `token`) und Suchtexte; Ziffern-Segmente (`/tasks/42`)
 * fasst `:id` zusammen. Ein unbekannter Pfad trägt den Titel `404/URL = <Pfad>`
 * (Matomo-Konvention, Bericht Seitentitel). Die App (`pageView: false`) meldet ihre Aufrufe selbst
 * (`tracking.ts`), weil erst sie Bildschirm und Kanal kennt.
 *
 * Opt-in (#2734): Ohne Zustimmung lädt das Snippet `matomo.js` nicht, es geht kein Request an die
 * Instanz. `window.bmTracking` liest und setzt die Wahl (`localStorage` `pp-tracking`, `on`/`off`),
 * geteilt von Website und Web-App (gleicher Origin). Ausschalten in laufender Sitzung setzt
 * `requireConsent` und stoppt damit jeden weiteren Request. `setConsentGiven` mit `false`, sonst
 * schaltet Matomo die Cookies wieder ein.
 */
declare global {
	interface Window {
		_paq?: unknown[][];
		bmTracking?: { get: () => 'on' | 'off' | null; set: (on: boolean) => void };
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
	return `<script>var _paq=window._paq=window._paq||[];_paq.push(['requireConsent'],['disableCookies'],['setDoNotTrack',true]${view},['enableLinkTracking'],['enableHeartBeatTimer'],['setTrackerUrl',${JSON.stringify(`${url}matomo.php`)}],['setSiteId',${JSON.stringify(siteId)}]);(function(){var k='pp-tracking',l=0;function load(){if(l)return;l=1;var g=document.createElement('script');g.async=true;g.src=${JSON.stringify(`${url}matomo.js`)};document.head.appendChild(g)}window.bmTracking={get:function(){try{var v=localStorage.getItem(k);return v==='on'||v==='off'?v:null}catch(e){return null}},set:function(on){try{localStorage.setItem(k,on?'on':'off')}catch(e){}_paq.push(on?['setConsentGiven',false]:['requireConsent']);if(on)load()}};if(window.bmTracking.get()==='on'){_paq.push(['setConsentGiven',false]);load()}})();</script>`;
};
