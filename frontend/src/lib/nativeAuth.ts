import { api } from '../api';
import { getPublicOrigin } from './siteOrigin';

/**
 * Anmeldung in der Android-App (ADR 0016, #1678). Google blockiert OAuth im WebView, deshalb läuft
 * der Login im System-Browser (Custom Tab). Der Server leitet danach auf den App Link
 * `/app/auth/native?code=…` um, den Android an die App gibt; der WebView löst den Code zusammen mit
 * dem vorher gemerkten `state` ein. Magic-Links auf die eigene Domain kommen über denselben Weg.
 * Im eingebauten Build (#2379) ist die eigene Domain `SITE_URL`, nicht der WebView-Ursprung.
 * Die Capacitor-Plugins werden erst hier nachgeladen, im Web-Bundle stecken sie nicht.
 */

const STATE_KEY = 'pp_native_login_state';
const HANDLED_LAUNCH_KEY = 'pp_native_launch_handled';
/** App Links kommen immer unter `/app/` (AndroidManifest `pathPrefix`), unabhängig von `BASE_URL`. */
const APP_LINK_PREFIX = '/app/';

/** 32 Zufallsbytes als base64url (43 Zeichen), passend zum Format, das der Server erwartet. */
const createState = (): string =>
	btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');

/** Öffnet den Google-Login im System-Browser; der `state` bleibt bis zum Einlösen im localStorage. */
export const startNativeGoogleLogin = async (): Promise<void> => {
	const state = createState();
	localStorage.setItem(STATE_KEY, state);
	const { Browser } = await import('@capacitor/browser');
	try {
		await Browser.open({ url: `${getPublicOrigin()}/auth/google?client=app&state=${state}` });
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
	if (target.origin !== getPublicOrigin()) {
		return;
	}
	const { Browser } = await import('@capacitor/browser');
	// Unter Android schließt der Wechsel in die App den Custom Tab selbst; `close` wirkt nur unter iOS.
	await Browser.close().catch(() => undefined);
	const base = import.meta.env.BASE_URL;
	const code = target.searchParams.get('code');
	if (target.pathname === `${APP_LINK_PREFIX}auth/native` && code !== null) {
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
