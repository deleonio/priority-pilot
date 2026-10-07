/**
 * App-Token der Android-App (#2379, Server-Vertrag #2377): Die eingebaute Web-App läuft auf einem
 * fremden Ursprung, die Cookie-Session greift dort nicht. Das Token liegt deshalb im localStorage des
 * WebView, übersteht so einen Neustart und geht als `Authorization: Bearer` an den Server.
 * Ohne Token (Website) bleibt alles beim Cookie.
 */
const APP_TOKEN_KEY = 'pp-app-token';

export const getAppToken = (): string | null => localStorage.getItem(APP_TOKEN_KEY);

export const setAppToken = (token: string): void => localStorage.setItem(APP_TOKEN_KEY, token);

export const clearAppToken = (): void => localStorage.removeItem(APP_TOKEN_KEY);

/** `Authorization`-Header für direkte `fetch`-Aufrufe; leer ohne Token. */
export const appTokenHeaders = (): Record<string, string> => {
	const token = getAppToken();
	return token === null ? {} : { Authorization: `Bearer ${token}` };
};
