import { describe, expect, it } from 'vitest';
import { matomoScript } from './matomo';

describe('matomoScript', () => {
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
