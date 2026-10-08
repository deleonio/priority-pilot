import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Login in der Android-App (#1678, ADR 0023): erst nativ über den Credential Manager, sonst bekommt
 * der Custom Tab `client=app` und einen frischen `state`, ein App Link mit Code löst diesen `state`
 * beim Server ein. Plugins und API sind gemockt; ohne `googleClientId` bleibt es beim Browser.
 */

vi.mock('@capacitor/browser', () => ({
	Browser: { open: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../api', () => ({
	api: {
		exchangeNativeLoginCode: vi.fn(() => Promise.resolve(true)),
		getAuthProviders: vi.fn(async () => ({ google: true, magicLink: false })),
		loginWithGoogleIdToken: vi.fn(async () => 200),
	},
}));
vi.mock('./googleSignIn', () => ({
	GoogleSignIn: { signIn: vi.fn(async () => ({ idToken: 'id-token' })), signOut: vi.fn() },
}));
const launch = vi.hoisted(() => ({ url: '' }));
vi.mock('@capacitor/app', () => ({
	App: { addListener: vi.fn(() => Promise.resolve()), getLaunchUrl: vi.fn(async () => ({ url: launch.url })) },
}));

import { Browser } from '@capacitor/browser';
import { api } from '../api';
import { GoogleSignIn } from './googleSignIn';
import { handleAppLink, listenForAppLinks, startNativeGoogleLogin } from './nativeAuth';

const replace = vi.fn();

beforeEach(() => {
	vi.stubGlobal('location', { origin: window.location.origin, replace, assign: vi.fn() });
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	localStorage.clear();
	sessionStorage.clear();
});

const openedUrl = (): URL => new URL(vi.mocked(Browser.open).mock.calls[0][0].url);

const SITE = 'https://app.example.com';

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

		await handleAppLink(`${window.location.origin}/app/auth/native?code=abc`);

		expect(api.exchangeNativeLoginCode).toHaveBeenCalledWith('abc', state);
		expect(Browser.close).toHaveBeenCalled();
	});

	it('ignoriert Links auf fremde Domains', async () => {
		await handleAppLink('https://evil.example/app/auth/native?code=abc');

		expect(api.exchangeNativeLoginCode).not.toHaveBeenCalled();
	});

	it('schickt bei gescheitertem Austausch auf die Login-Seite mit Hinweis', async () => {
		vi.mocked(api.exchangeNativeLoginCode).mockResolvedValueOnce(false);

		await handleAppLink(`${window.location.origin}/app/auth/native?code=abc`);

		expect(replace).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}login?error=native_login_failed`);
	});

	describe('native Anmeldung (ADR 0023)', () => {
		beforeEach(() => {
			vi.mocked(api.getAuthProviders).mockResolvedValueOnce({
				google: true,
				magicLink: false,
				googleClientId: 'web-client',
			});
		});

		it('meldet über den Credential Manager an, ohne Browser', async () => {
			await startNativeGoogleLogin();

			expect(GoogleSignIn.signIn).toHaveBeenCalledWith({ serverClientId: 'web-client', auto: false });
			expect(api.loginWithGoogleIdToken).toHaveBeenCalledWith('id-token');
			expect(Browser.open).not.toHaveBeenCalled();
			expect(replace).toHaveBeenCalledWith(import.meta.env.BASE_URL);
		});

		it('fällt nach einem Abbruch auf den Browser zurück, statt stumm zu bleiben', async () => {
			vi.mocked(GoogleSignIn.signIn).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'canceled' }));

			await startNativeGoogleLogin();

			expect(openedUrl().searchParams.get('return')).toBe('scheme');
		});

		it('fällt ohne Einrichtung auf den Browser mit Rücksprung über das Custom Scheme zurück', async () => {
			vi.mocked(GoogleSignIn.signIn).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'failed' }));

			await startNativeGoogleLogin();

			expect(openedUrl().searchParams.get('return')).toBe('scheme');
		});

		it('zeigt eine abgelehnte Adresse als fehlenden Zugang', async () => {
			vi.mocked(api.loginWithGoogleIdToken).mockResolvedValueOnce(403);

			await startNativeGoogleLogin();

			expect(replace).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}login?error=access_denied`);
		});
	});

	it('löst den Code aus dem Custom Scheme mit dem gemerkten state ein', async () => {
		await startNativeGoogleLogin();
		const state = openedUrl().searchParams.get('state');

		await handleAppLink('balamentum.app://auth/native?code=abc');

		expect(api.exchangeNativeLoginCode).toHaveBeenCalledWith('abc', state);
		expect(replace).toHaveBeenCalledWith(import.meta.env.BASE_URL);
	});

	it('zeigt einen Fehler aus dem Custom Scheme mit seinem Code auf der Login-Seite', async () => {
		await handleAppLink('balamentum.app://auth/native?error=access_denied');

		expect(replace).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}login?error=access_denied`);
	});

	it('verarbeitet den Start-Link nur einmal, auch nach einem Neuladen', async () => {
		launch.url = `${window.location.origin}/app/auth/native?code=abc`;

		await listenForAppLinks();
		await listenForAppLinks();

		expect(api.exchangeNativeLoginCode).toHaveBeenCalledTimes(1);
	});

	it('scheitert das Öffnen des Browsers, landet der Nutzer mit Hinweis auf der Login-Seite', async () => {
		vi.mocked(Browser.open).mockRejectedValueOnce(new Error('kein Browser'));

		await startNativeGoogleLogin();

		expect(replace).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}login?error=native_login_failed`);
	});

	// #2379: Im eingebauten Android-Build ist `window.location.origin` der lokale WebView-Ursprung,
	// die Domain steht in VITE_SITE_URL. App Links kommen immer als `/app/...` (AndroidManifest).
	describe('eingebauter Build (#2379)', () => {
		beforeEach(() => {
			vi.stubEnv('VITE_SITE_URL', SITE);
		});
		afterEach(() => {
			vi.unstubAllEnvs();
		});

		it('AK1: öffnet den Login unter SITE_URL statt unter window.location.origin', async () => {
			await startNativeGoogleLogin();

			const opened = openedUrl();
			expect(opened.origin).toBe(SITE);
			expect(opened.pathname).toBe('/auth/google');
			expect(opened.searchParams.get('client')).toBe('app');
		});

		it('AK2: nimmt den App Link der Domain an, löst Code+state ein und zeigt die App-Wurzel', async () => {
			await startNativeGoogleLogin();
			const state = openedUrl().searchParams.get('state');

			await handleAppLink(`${SITE}/app/auth/native?code=c1`);

			expect(api.exchangeNativeLoginCode).toHaveBeenCalledWith('c1', state);
			expect(replace).toHaveBeenCalledWith(import.meta.env.BASE_URL);
		});

		it('AK2: gescheiterter Austausch landet auf der Login-Seite mit Hinweis', async () => {
			vi.mocked(api.exchangeNativeLoginCode).mockResolvedValueOnce(false);

			await handleAppLink(`${SITE}/app/auth/native?code=c1`);

			expect(replace).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}login?error=native_login_failed`);
		});

		it('AK3: verwirft Links von window.location.origin und fremden Domains', async () => {
			await handleAppLink(`${window.location.origin}/app/auth/native?code=c1`);
			await handleAppLink('https://evil.example/app/auth/native?code=c1');

			expect(api.exchangeNativeLoginCode).not.toHaveBeenCalled();
			expect(replace).not.toHaveBeenCalled();
		});

		it('AK4: Magic Link bleibt in der App (kein assign auf die Domain), Token-Parameter bleibt erhalten', async () => {
			const assign = vi.fn();
			vi.stubGlobal('location', { origin: window.location.origin, replace, assign });

			await handleAppLink(`${SITE}/app/?magic=tok123`);

			expect(assign).not.toHaveBeenCalled();
			expect(replace).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}?magic=tok123`);
		});
	});
});
