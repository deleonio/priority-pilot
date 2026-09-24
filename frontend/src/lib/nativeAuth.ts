import { api } from '../api';

/**
 * Anmeldung in der Android-App (ADR 0016, #1678). Google blockiert OAuth im WebView, deshalb läuft
 * der Login im System-Browser (Custom Tab). Der Server leitet danach auf den App Link
 * `/app/auth/native?code=…` um, den Android an die App gibt; der WebView löst den Code zusammen mit
 * dem vorher gemerkten `state` ein. Magic-Links auf die eigene Domain kommen über denselben Weg.
 * Die Capacitor-Plugins werden erst hier nachgeladen, im Web-Bundle stecken sie nicht.
 */

const STATE_KEY = 'pp_native_login_state';
const HANDLED_LAUNCH_KEY = 'pp_native_launch_handled';

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
		await Browser.open({ url: `${window.location.origin}/auth/google?client=app&state=${state}` });
	} catch {
		window.location.replace(`${import.meta.env.BASE_URL}login?error=native_login_failed`);
	}
};

/**
 * Verarbeitet einen App Link: den Login-Code löst sie ein und lädt die App neu, jede andere Adresse
 * der eigenen Domain (z. B. ein Magic-Link) öffnet sie im WebView. Fremde Adressen ignoriert sie.
 */
export const handleAppLink = async (url: string): Promise<void> => {
	const target = new URL(url);
	if (target.origin !== window.location.origin) {
		return;
	}
	const { Browser } = await import('@capacitor/browser');
	// Unter Android schließt der Wechsel in die App den Custom Tab selbst; `close` wirkt nur unter iOS.
	await Browser.close().catch(() => undefined);
	const base = import.meta.env.BASE_URL;
	const code = target.searchParams.get('code');
	if (target.pathname === `${base}auth/native` && code !== null) {
		const state = localStorage.getItem(STATE_KEY) ?? '';
		localStorage.removeItem(STATE_KEY);
		const ok = await api.exchangeNativeLoginCode(code, state);
		window.location.replace(ok ? base : `${base}login?error=native_login_failed`);
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
	if (launchUrl !== undefined && sessionStorage.getItem(HANDLED_LAUNCH_KEY) !== launchUrl) {
		sessionStorage.setItem(HANDLED_LAUNCH_KEY, launchUrl);
		await handleAppLink(launchUrl);
	}
};
