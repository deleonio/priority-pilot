import { api } from '../api';
import { getPublicOrigin } from './siteOrigin';

/**
 * Anmeldung in der Android-App (ADR 0023): nativ über den Credential Manager, ohne Browser. Fehlt die
 * Einrichtung bei Google oder das Plugin, läuft der Login wie bisher (ADR 0016, #1678) im
 * System-Browser (Custom Tab): Der Server leitet danach über das Custom Scheme
 * `balamentum.app://auth/native?code=…` zurück in die App, ältere Stände über den App Link
 * `/app/auth/native?code=…`; der WebView löst den Code zusammen mit dem vorher gemerkten `state` ein.
 * Magic-Links auf die eigene Domain kommen über den App Link.
 * Im eingebauten Build (#2379) ist die eigene Domain `SITE_URL`, nicht der WebView-Ursprung.
 * Die Capacitor-Plugins werden erst hier nachgeladen, im Web-Bundle stecken sie nicht.
 */

const STATE_KEY = 'pp_native_login_state';
const HANDLED_LAUNCH_KEY = 'pp_native_launch_handled';
/** App Links kommen immer unter `/app/` (AndroidManifest `pathPrefix`), unabhängig von `BASE_URL`. */
const APP_LINK_PREFIX = '/app/';
/** Rücksprung über das Custom Scheme (`appId` in native/capacitor.config.ts). */
const APP_SCHEME_LOGIN = 'balamentum.app://auth/native';

/** Ergebnis der nativen Anmeldung; Fehler sind Codes für `?error=` der Login-Seite. */
export type NativeLoginResult = 'ok' | 'canceled' | 'unavailable' | 'access_denied' | 'native_login_failed';

/**
 * Native Google-Anmeldung über den Credential Manager (ADR 0023). `auto` nimmt ein bekanntes Konto
 * ohne Rückfrage, sonst zeigt Android das Konto-Sheet. `unavailable`, wenn Plugin, Google-Einrichtung
 * oder Server-Endpunkt fehlen: Dann bleibt der Weg über den Browser.
 */
export const nativeGoogleLogin = async (auto: boolean): Promise<NativeLoginResult> => {
	try {
		const { googleClientId } = await api.getAuthProviders();
		if (!googleClientId) return 'unavailable';
		const { GoogleSignIn } = await import('./googleSignIn');
		const { idToken } = await GoogleSignIn.signIn({ serverClientId: googleClientId, auto });
		const status = await api.loginWithGoogleIdToken(idToken);
		if (status < 300) return 'ok';
		if (status === 403) return 'access_denied';
		return status === 400 ? 'native_login_failed' : 'unavailable';
	} catch (error) {
		return (error as { code?: unknown }).code === 'canceled' ? 'canceled' : 'unavailable';
	}
};

/** Nach der Anmeldung neu laden, bei Fehlern die Login-Seite mit Meldung zeigen. */
export const finishNativeLogin = (result: NativeLoginResult): void => {
	const base = import.meta.env.BASE_URL;
	if (result === 'ok') window.location.replace(base);
	else if (result === 'access_denied' || result === 'native_login_failed')
		window.location.replace(`${base}login?error=${result}`);
};

/** 32 Zufallsbytes als base64url (43 Zeichen), passend zum Format, das der Server erwartet. */
const createState = (): string =>
	btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');

/**
 * „Mit Google anmelden“: erst nativ, ohne Einrichtung im System-Browser. Dort bleibt der `state` bis
 * zum Einlösen im localStorage.
 */
export const startNativeGoogleLogin = async (): Promise<void> => {
	const result = await nativeGoogleLogin(false);
	// Fehlt der Android-OAuth-Client, meldet der Credential Manager nach der Kontowahl einen Abbruch;
	// dann bleibt der Browser, statt dass nichts passiert.
	if (result !== 'unavailable' && result !== 'canceled') {
		finishNativeLogin(result);
		return;
	}
	const state = createState();
	localStorage.setItem(STATE_KEY, state);
	const { Browser } = await import('@capacitor/browser');
	try {
		await Browser.open({ url: `${getPublicOrigin()}/auth/google?client=app&state=${state}&return=scheme` });
	} catch {
		window.location.replace(`${import.meta.env.BASE_URL}login?error=native_login_failed`);
	}
};

/**
 * Verarbeitet einen App Link: den Login-Code löst sie ein und lädt die App neu, jede andere Adresse
 * der eigenen Domain (z. B. ein Magic-Link) öffnet sie im WebView unter `BASE_URL`, damit die App sie
 * selbst einlöst. Fremde Adressen ignoriert sie.
 */
export const handleAppLink = async (url: string): Promise<void> => {
	const target = new URL(url);
	const viaScheme = url.startsWith(`${APP_SCHEME_LOGIN}?`);
	if (!viaScheme && target.origin !== getPublicOrigin()) {
		return;
	}
	const { Browser } = await import('@capacitor/browser');
	// Unter Android schließt der Wechsel in die App den Custom Tab selbst; `close` wirkt nur unter iOS.
	await Browser.close().catch(() => undefined);
	const base = import.meta.env.BASE_URL;
	const code = target.searchParams.get('code');
	if (viaScheme && code === null) {
		const error = target.searchParams.get('error') ?? 'native_login_failed';
		window.location.replace(`${base}login?error=${encodeURIComponent(error)}`);
		return;
	}
	if ((viaScheme || target.pathname === `${APP_LINK_PREFIX}auth/native`) && code !== null) {
		const state = localStorage.getItem(STATE_KEY) ?? '';
		localStorage.removeItem(STATE_KEY);
		const ok = await api.exchangeNativeLoginCode(code, state);
		window.location.replace(ok ? base : `${base}login?error=native_login_failed`);
		return;
	}
	if (target.pathname.startsWith(APP_LINK_PREFIX)) {
		window.location.replace(`${base}${target.pathname.slice(APP_LINK_PREFIX.length)}${target.search}${target.hash}`);
		return;
	}
	window.location.assign(target.href);
};

/**
 * Hört auf App Links, solange die App läuft, und verarbeitet den Link, mit dem sie gestartet wurde.
 * Der Start-Link bleibt für die ganze Laufzeit abrufbar, deshalb merkt sich die Sitzung, dass er
 * schon verarbeitet ist; sonst liefe er nach jedem Neuladen erneut.
 */
export const listenForAppLinks = async (): Promise<void> => {
	const { App } = await import('@capacitor/app');
	await App.addListener('appUrlOpen', ({ url }) => void handleAppLink(url));
	const launchUrl = (await App.getLaunchUrl())?.url;
	if (launchUrl && sessionStorage.getItem(HANDLED_LAUNCH_KEY) !== launchUrl) {
		sessionStorage.setItem(HANDLED_LAUNCH_KEY, launchUrl);
		await handleAppLink(launchUrl);
	}
};
