import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
	vi.resetModules();
	return import('./matomo');
};

describe('matomoScript', () => {
	let matomoScript: Awaited<ReturnType<typeof load>>['matomoScript'];
	beforeEach(async () => {
		({ matomoScript } = await load());
	});

	it('bleibt ohne vollständige Konfiguration aus', () => {
		expect(matomoScript({})).toBe('');
		expect(matomoScript({ MATOMO_URL: 'https://stats.example.de', MATOMO_SITE_ID: 'x' })).toBe('');
	});

	it('zählt cookielos und nur den Pfad, nie die Query mit Anmelde-Tokens', () => {
		const html = matomoScript({ MATOMO_URL: 'https://stats.example.de', MATOMO_SITE_ID: '1' });
		expect(html).toContain("['disableCookies']");
		expect(html).toContain("['setCustomUrl',location.origin+location.pathname.replace(/\\/\\d+(?=\\/|$)/g,'/:id')]");
		expect(html).toContain("['enableHeartBeatTimer']");
		expect(html).not.toContain('404/URL');
		expect(html).toContain('"https://stats.example.de/matomo.php"');
	});

	it('markiert die Fehlerseite mit dem 404-Titel vor dem Seitenaufruf', () => {
		const html = matomoScript({ MATOMO_URL: 'https://stats.example.de', MATOMO_SITE_ID: '1' }, { notFound: true });
		expect(html).toContain("['setDocumentTitle','404/URL = '+location.pathname],['trackPageView']");
	});

	it('überlässt der App die Seitenaufrufe', () => {
		const html = matomoScript({ MATOMO_URL: 'https://stats.example.de', MATOMO_SITE_ID: '1' }, { pageView: false });
		expect(html).not.toContain('trackPageView');
		expect(html).toContain("['enableHeartBeatTimer']");
	});
});

describe('Opt-in (#2734)', () => {
	const run = async () => {
		const { matomoScript } = await load();
		const html = matomoScript({ MATOMO_URL: 'https://stats.example.de', MATOMO_SITE_ID: '1' });
		new Function(html.slice('<script>'.length, -'</script>'.length))();
	};
	const trackerLoaded = () => document.querySelector('script[src="https://stats.example.de/matomo.js"]') !== null;

	beforeEach(() => {
		window._paq = [];
		localStorage.clear();
		document.head.innerHTML = '';
	});

	it('lädt ohne Zustimmung keinen Tracker und verlangt Zustimmung', async () => {
		await run();
		expect(window.bmTracking?.get()).toBeNull();
		expect(trackerLoaded()).toBe(false);
		expect(window._paq?.[0]).toEqual(['requireConsent']);
	});

	it('Zulassen lädt den Tracker ohne Cookies, Ablehnen stoppt ihn; die Wahl bleibt gespeichert', async () => {
		await run();
		window.bmTracking?.set(true);
		expect(trackerLoaded()).toBe(true);
		expect(window._paq).toContainEqual(['setConsentGiven', false]);
		window.bmTracking?.set(false);
		expect(window._paq?.at(-1)).toEqual(['requireConsent']);
		expect(localStorage.getItem('pp-tracking')).toBe('off');
	});

	it('gespeichertes Ja lädt den Tracker beim nächsten Besuch, gespeichertes Nein nicht', async () => {
		localStorage.setItem('pp-tracking', 'on');
		await run();
		expect(trackerLoaded()).toBe(true);
		document.head.innerHTML = '';
		localStorage.setItem('pp-tracking', 'off');
		await run();
		expect(trackerLoaded()).toBe(false);
	});
});
