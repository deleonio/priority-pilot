import { getApiBase } from './siteOrigin';

/**
 * Inhaltliche Präferenzen am Konto (#2398): KI-, Balance-Priorität-, Expertenmodus- und
 * Geo-Schalter gelten auf jedem angemeldeten Gerät. Muster `balanceVariant.ts` (#2009): der
 * `localStorage` bleibt Erst-Paint-Spiegel, `pullAccountPreferences` zieht den Kontostand beim
 * App-Start nach (das Konto gewinnt), jede Änderung geht per PUT ans Konto (Best-Effort).
 * Theme, Kopfzeile, Animationen, Sprach-Autostart und Hinweis-Banner bleiben bewusst gerätelokal.
 */

interface AccountPreferences {
	aiEnabled: boolean;
	balancePriority: boolean;
	expertMode: boolean;
	geolocationEnabled: boolean;
}

/**
 * `localStorage`-Spiegel je Konto-Feld (müssen mit den e2e-Tests übereinstimmen). Die
 * Präferenzmodule beziehen ihre Schlüssel von hier, damit dieses Modul keines von ihnen importiert.
 */
export const ACCOUNT_PREFERENCE_KEYS: Record<keyof AccountPreferences, string> = {
	aiEnabled: 'pp-ai-enabled',
	balancePriority: 'pp-balance-priority',
	expertMode: 'pp-expert-mode',
	geolocationEnabled: 'pp-geolocation-enabled',
};

/**
 * Bisherige Defaults — ein leerer Spiegel liefert sie ohnehin. Sie landen nicht im leeren Spiegel,
 * damit „noch keine eigene Wahl auf diesem Gerät" erkennbar bleibt (Balance-Hinweis, #1792).
 */
const DEFAULTS: AccountPreferences = {
	aiEnabled: true,
	balancePriority: true,
	expertMode: false,
	geolocationEnabled: false,
};

/** Fester `/api/v1`-Pfad außerhalb der `api`-Fassade — Begründung siehe `balanceVariant.ts`. */
const API_URL = `${getApiBase()}/account-preferences`;

/** CSRF-Token aus dem GET-Antwort-Header; der PUT sendet ihn mit, wenn er bekannt ist. */
let csrfToken: string | null = null;

/** Ohne Konto (Dev-Pass-Through, Nutzer ohne `id`) kein GET/PUT — der Server antwortet dort bewusst 401. */
let accountBound = true;

/**
 * Holt den Kontostand und schreibt ihn in die Spiegel; ohne Konto/Netz bleibt der Gerätewert.
 * Ein Konto ohne gespeicherten Wert liefert den Default — er überschreibt einen abweichenden
 * Spiegel, ohne dass dieser ans Konto geht (kein Bestandskunden-Ballast).
 */
export const pullAccountPreferences = async (hasAccount = true): Promise<void> => {
	accountBound = hasAccount;
	if (!hasAccount) return;
	try {
		const response = await fetch(API_URL);
		if (!response.ok) return;
		const token = response.headers.get('x-csrf-token');
		if (token) csrfToken = token;
		const dto = (await response.json()) as Partial<Record<keyof AccountPreferences, unknown>>;
		for (const [field, key] of Object.entries(ACCOUNT_PREFERENCE_KEYS) as [keyof AccountPreferences, string][]) {
			const value = dto[field];
			if (typeof value !== 'boolean') continue;
			if (value === DEFAULTS[field] && localStorage.getItem(key) === null) continue;
			localStorage.setItem(key, String(value));
		}
	} catch {
		// Konto oder Storage nicht erreichbar — der Spiegel (Gerät) bleibt Quelle für diese Sitzung.
	}
};

/** Sendet geänderte Felder ans Konto — ein einzelner Aufruf, Fehler werden geschluckt. */
export const sendAccountPreferences = (changes: Partial<AccountPreferences>): void => {
	if (!accountBound) return;
	try {
		void fetch(API_URL, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
			},
			body: JSON.stringify(changes),
		})
			.then((response) => {
				// Verworfener CSRF-Token (Server-Rotation): der nächste GET liefert einen neuen.
				if (response.status === 403) csrfToken = null;
			})
			.catch(() => {
				// Netzwerk weg — die lokale Wahl bleibt aktiv (Best-Effort).
			});
	} catch {
		// fetch kann mit relativer URL z. B. in Testumgebungen synchron werfen — Best-Effort.
	}
};
