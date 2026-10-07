/**
 * Persistenz der Balance-Priorisierung (#1792): Die Aufgabenliste ist standardmäßig nach
 * Balance sortiert; wer sie ausschaltet, behält die Wahl — gespeichert im `localStorage`
 * (Key `pp-balance-priority`, Default **an**). Dazu das Dismiss-Flag des einmaligen Hinweises
 * auf die Umstellung (Key `pp-balance-hint-dismissed`).
 *
 * Muster wie `aiPreferences.ts`: reine Funktionen (ohne React, einfach testbar). Fehlender,
 * ungültiger oder gesperrter `localStorage` (z. B. blockierte Cookies) darf die App nie
 * crashen → alle Zugriffe sind Best-Effort.
 */

import { ACCOUNT_PREFERENCE_KEYS, sendAccountPreferences } from './accountPreferences';

/** `localStorage`-Schlüssel der Balance-Präferenz (muss mit den e2e-Tests übereinstimmen). */
export const BALANCE_PRIORITY_STORAGE_KEY = ACCOUNT_PREFERENCE_KEYS.balancePriority;

/** `localStorage`-Schlüssel des Einmal-Hinweis-Dismiss (#1792 AK4). */
export const BALANCE_HINT_DISMISS_KEY = 'pp-balance-hint-dismissed';

interface BalancePreferences {
	/** Aufgabenliste nach Balance-Priorisierung sortieren? Default `true`. */
	balancePriority: boolean;
}

/** Liest `'true'`/`'false'`; alles andere (auch ein gesperrter Storage) gilt als „nicht gesetzt". */
const readStoredFlag = (key: string): boolean | null => {
	try {
		const value = localStorage.getItem(key);
		return value === 'true' ? true : value === 'false' ? false : null;
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return null;
	}
};

/**
 * Liest die Präferenz. Fehlt der Wert oder ist er ungültig (alles andere als `'true'`/`'false'`),
 * gilt der Default `true`; ein gesperrter `localStorage` liefert ebenfalls den Default.
 */
export const readBalancePreferences = (): BalancePreferences => ({
	balancePriority: readStoredFlag(BALANCE_PRIORITY_STORAGE_KEY) ?? true,
});

/** Speichert die Präferenz im Spiegel und am Konto (#2398, Best-Effort); Fehler werden ignoriert. */
export const storeBalancePreferences = (preferences: BalancePreferences): void => {
	try {
		localStorage.setItem(BALANCE_PRIORITY_STORAGE_KEY, String(preferences.balancePriority));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
	sendAccountPreferences({ balancePriority: preferences.balancePriority });
};

/**
 * Zeigt an, ob eine eigene Präferenz gespeichert ist — der Einmal-Hinweis erscheint nur, solange
 * weder dieses noch das Dismiss-Flag vorliegt (Design-Entscheidung #1792).
 */
export const hasStoredBalancePreference = (): boolean => readStoredFlag(BALANCE_PRIORITY_STORAGE_KEY) !== null;

/** Liest das Dismiss-Flag des Hinweises; Default `false` — der Hinweis darf erscheinen. */
export const isBalanceHintDismissed = (): boolean => readStoredFlag(BALANCE_HINT_DISMISS_KEY) === true;

/** Setzt das Dismiss-Flag dauerhaft (Best-Effort); Fehler werden ignoriert. */
export const dismissBalanceHint = (): void => {
	try {
		localStorage.setItem(BALANCE_HINT_DISMISS_KEY, 'true');
	} catch {
		// Persistenz ist Best-Effort; der Hinweis bleibt zumindest für die Sitzung weg.
	}
};
