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
		expect(window._paq).toEqual([
			['setReferrerUrl', `${location.origin}/app/`],
			['setCustomUrl', `${location.origin}/app/aufgaben`],
			['setDocumentTitle', '/aufgaben'],
			['trackPageView'],
		]);
		trackPageView('/aufgaben');
		expect(window._paq).toHaveLength(4);
	});

	it('fasst IDs zusammen und betitelt unbekannte Pfade als 404', async () => {
		const { trackPageView } = await load();
		window.history.pushState({}, '', '/app/');
		trackPageView('/');
		window.history.pushState({}, '', '/app/tasks/42');
		trackPageView('/tasks/42', false);
		expect(window._paq).toContainEqual(['setCustomUrl', `${location.origin}/app/tasks/:id`]);
		expect(window._paq).toContainEqual(['setDocumentTitle', '404/URL = /app/tasks/42']);
	});
});
