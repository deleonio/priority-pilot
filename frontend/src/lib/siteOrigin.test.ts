import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBase, getPublicOrigin } from './siteOrigin';

// Spec: docs/spec/issue-2378.md — AK3 (API-Basis) und AK4 (öffentliche Origin).
describe('siteOrigin (#2378)', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('AK3: mit VITE_SITE_URL zeigt die API-Basis auf <SITE_URL>/api/v1', () => {
		vi.stubEnv('VITE_SITE_URL', 'https://balamentum.example');
		expect(getApiBase()).toBe('https://balamentum.example/api/v1');
	});

	it('AK3/AK4: abschließende Slashes und Leerraum der Site-URL werden normalisiert', () => {
		vi.stubEnv('VITE_SITE_URL', '  https://balamentum.example//  ');
		expect(getApiBase()).toBe('https://balamentum.example/api/v1');
		expect(getPublicOrigin()).toBe('https://balamentum.example');
	});

	it('AK4: mit VITE_SITE_URL ist die öffentliche Origin die Site-URL', () => {
		vi.stubEnv('VITE_SITE_URL', 'https://balamentum.example');
		expect(getPublicOrigin()).toBe('https://balamentum.example');
	});

	it('AK3/AK5: ohne VITE_SITE_URL (Website-Build) bleibt die API-Basis relativ', () => {
		vi.stubEnv('VITE_SITE_URL', '');
		expect(getApiBase()).toBe('/api/v1');
	});

	it('AK4/AK5: ohne VITE_SITE_URL (Website-Build) ist die Origin window.location.origin', () => {
		vi.stubEnv('VITE_SITE_URL', '');
		expect(getPublicOrigin()).toBe(window.location.origin);
	});
});
