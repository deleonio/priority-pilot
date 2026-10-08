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
		expect(html).toContain("['setCustomUrl',location.origin+location.pathname]");
		expect(html).toContain('"https://stats.example.de/matomo.php"');
	});
});

describe('trackPageView', () => {
	beforeEach(() => {
		window._paq = [];
	});

	it('zählt den Erstaufruf nicht, Wechsel mit /app/-Präfix, gleichen Pfad nicht', async () => {
		const { trackPageView } = await load();
		window.history.pushState({}, '', '/app/');
		trackPageView('/');
		expect(window._paq).toEqual([]);
		window.history.pushState({}, '', '/app/aufgaben');
		trackPageView('/aufgaben');
		expect(window._paq).toEqual([['setCustomUrl', `${location.origin}/app/aufgaben`], ['trackPageView']]);
		trackPageView('/aufgaben');
		expect(window._paq).toHaveLength(2);
	});
});
