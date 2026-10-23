import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
	vi.resetModules();
	return import('./tracking');
};

describe('trackPageView', () => {
	beforeEach(() => {
		window._paq = [];
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		delete (globalThis as { __PP_CHANNEL__?: string }).__PP_CHANNEL__;
	});

	it('setzt beim ersten Aufruf den Kanal, danach den Referrer, gleichen Pfad nur einmal', async () => {
		const { trackPageView } = await load();
		trackPageView('/login');
		trackPageView('/aufgaben');
		trackPageView('/aufgaben');
		expect(window._paq).toEqual([
			['setCustomDimension', 1, 'web'],
			['setCustomUrl', `${location.origin}/app/login`],
			['setDocumentTitle', '/login'],
			['trackPageView'],
			['setReferrerUrl', `${location.origin}/app/login`],
			['setCustomUrl', `${location.origin}/app/aufgaben`],
			['setDocumentTitle', '/aufgaben'],
			['trackPageView'],
		]);
	});

	it('Android: Kanal android, URL auf SITE_URL statt localhost, IDs zusammengefasst', async () => {
		vi.stubEnv('VITE_SITE_URL', 'https://example.org');
		(globalThis as { __PP_CHANNEL__?: string }).__PP_CHANNEL__ = 'play';
		const { trackPageView } = await load();
		trackPageView('/tasks/42');
		expect(window._paq).toContainEqual(['setCustomDimension', 1, 'android']);
		expect(window._paq).toContainEqual(['setCustomUrl', 'https://example.org/app/tasks/:id']);
	});

	it('installierte PWA: Kanal pwa; unbekannter Pfad als 404', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const { trackPageView } = await load();
		trackPageView('/gibtsnicht', { known: false });
		expect(window._paq).toContainEqual(['setCustomDimension', 1, 'pwa']);
		expect(window._paq).toContainEqual(['setDocumentTitle', '404/URL = /app/gibtsnicht']);
	});
});
