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
