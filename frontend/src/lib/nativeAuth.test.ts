import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Login in der Android-App (#1678): Der Custom Tab bekommt `client=app` und einen frischen `state`,
 * ein App Link mit Code löst diesen `state` beim Server ein. Browser-Plugin und API sind gemockt.
 */

vi.mock('@capacitor/browser', () => ({
	Browser: { open: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../api', () => ({ api: { exchangeNativeLoginCode: vi.fn(() => Promise.resolve(true)) } }));

import { Browser } from '@capacitor/browser';
import { api } from '../api';
import { handleAppLink, startNativeGoogleLogin } from './nativeAuth';

afterEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
});

const openedUrl = (): URL => new URL(vi.mocked(Browser.open).mock.calls[0][0].url);

describe('nativeAuth (#1678)', () => {
	it('öffnet den Google-Login im Browser mit client=app und einem frischen state', async () => {
		await startNativeGoogleLogin();
		const first = openedUrl();
		vi.mocked(Browser.open).mockClear();
		await startNativeGoogleLogin();

		expect(first.pathname).toBe('/auth/google');
		expect(first.searchParams.get('client')).toBe('app');
		expect(first.searchParams.get('state')).toMatch(/^[\w-]{16,128}$/);
		expect(openedUrl().searchParams.get('state')).not.toBe(first.searchParams.get('state'));
	});

	it('löst den Code aus dem App Link mit dem gemerkten state ein und schließt den Browser', async () => {
		await startNativeGoogleLogin();
		const state = openedUrl().searchParams.get('state');

		await handleAppLink(`${window.location.origin}${import.meta.env.BASE_URL}auth/native?code=abc`);

		expect(api.exchangeNativeLoginCode).toHaveBeenCalledWith('abc', state);
		expect(Browser.close).toHaveBeenCalled();
	});

	it('ignoriert Links auf fremde Domains', async () => {
		await handleAppLink('https://evil.example/app/auth/native?code=abc');

		expect(api.exchangeNativeLoginCode).not.toHaveBeenCalled();
	});
});
