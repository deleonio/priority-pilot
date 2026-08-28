import { useCallback, useState } from 'react';

/**
 * Persistenz der KI-Einstellungen (#1080): „KI-Features aktiv" (Hauptschalter) und
 * „Schnellerfassung aktiv" — zwei **unabhängige** boolesche Präferenzen.
 *
 * Muster wie `voiceAutostart.ts`: reine Funktionen (ohne React, einfach testbar) plus ein kleiner
 * `useAiPreferences`-Hook. Beide Defaults sind **an** (= Status quo), damit bestehende Flows und
 * e2e-Tests unverändert bleiben. Fehlender, ungültiger oder gesperrter `localStorage` (z. B.
 * blockierte Cookies) darf die App nie crashen → alle Zugriffe sind Best-Effort.
 *
 * Deaktivierung ist bewusst eine reine **UI-Ausblendung** (Toolbar-Button „Säulen-Berater",
 * Lektorat-Buttons, Schnellerfassungs-Schritt); die Server-Endpunkte bleiben erreichbar.
 */

/** `localStorage`-Schlüssel der KI-Hauptpräferenz (muss mit den e2e-Tests übereinstimmen). */
export const AI_ENABLED_STORAGE_KEY = 'pp-ai-enabled';

/** `localStorage`-Schlüssel der Schnellerfassungs-Präferenz (muss mit den e2e-Tests übereinstimmen). */
export const QUICK_CAPTURE_ENABLED_STORAGE_KEY = 'pp-quick-capture-enabled';

interface AiPreferences {
	/** Hauptschalter: KI-Features (Berater, Lektorate) sichtbar? Default `true`. */
	aiEnabled: boolean;
	/** Schnellerfassung beim Anlegen neuer Tasks nutzen? Default `true`, unabhängig von `aiEnabled`. */
	quickCaptureEnabled: boolean;
}

/**
 * Liest beide Präferenzen unabhängig voneinander. Fehlt ein Wert oder ist er ungültig (alles andere
 * als `'true'`/`'false'`), gilt der Default `true`; ein gesperrter `localStorage` liefert die Defaults.
 */
export const readAiPreferences = (): AiPreferences => {
	const read = (key: string): boolean | null => {
		try {
			const value = localStorage.getItem(key);
			return value === 'true' ? true : value === 'false' ? false : null;
		} catch {
			// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
			return null;
		}
	};
	return {
		aiEnabled: read(AI_ENABLED_STORAGE_KEY) ?? true,
		quickCaptureEnabled: read(QUICK_CAPTURE_ENABLED_STORAGE_KEY) ?? true,
	};
};

/**
 * Effektive Schnellerfassung (#1085): die Schnellerfassung ist ein KI-Feature — bei deaktivierter
 * KI wird die gespeicherte Präferenz **ignoriert** (der in den Einstellungen gesperrte Schalter
 * kann sie sonst auch nicht mehr abschalten). Gespeichert bleibt der Wert unverändert.
 */
export const isQuickCaptureEffective = (preferences: AiPreferences): boolean =>
	preferences.aiEnabled && preferences.quickCaptureEnabled;

/** Speichert beide Präferenzen (Best-Effort); Fehler (z. B. voller/gesperrter Storage) werden ignoriert. */
export const storeAiPreferences = (preferences: AiPreferences): void => {
	const write = (key: string, value: boolean): void => {
		try {
			localStorage.setItem(key, String(value));
		} catch {
			// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
		}
	};
	write(AI_ENABLED_STORAGE_KEY, preferences.aiEnabled);
	write(QUICK_CAPTURE_ENABLED_STORAGE_KEY, preferences.quickCaptureEnabled);
};

interface UseAiPreferencesResult extends AiPreferences {
	/** Eine Präferenz setzen (persistiert und sofort im State übernommen). */
	setPreference: (key: 'aiEnabled' | 'quickCaptureEnabled', value: boolean) => void;
}

/** React-Hook zu beiden KI-Einstellungen. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useAiPreferences = (): UseAiPreferencesResult => {
	const [preferences, setPreferences] = useState<AiPreferences>(readAiPreferences);

	const setPreference = useCallback((key: 'aiEnabled' | 'quickCaptureEnabled', value: boolean): void => {
		setPreferences((previous) => {
			const next = { ...previous, [key]: value };
			storeAiPreferences(next);
			return next;
		});
	}, []);

	return { ...preferences, setPreference };
};
