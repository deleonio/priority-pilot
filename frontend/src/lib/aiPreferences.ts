import { useCallback, useState } from 'react';

/**
 * Persistenz der KI-Einstellungen (#1080, seit #1335 nur noch eine): „KI-Features aktiv".
 *
 * Muster wie `voiceAutostart.ts`: reine Funktionen (ohne React, einfach testbar) plus ein kleiner
 * `useAiPreferences`-Hook. Der Default ist **an** (= Status quo), damit bestehende Flows und
 * e2e-Tests unverändert bleiben. Fehlender, ungültiger oder gesperrter `localStorage` (z. B.
 * blockierte Cookies) darf die App nie crashen → alle Zugriffe sind Best-Effort.
 *
 * Deaktivierung ist bewusst eine reine **UI-Ausblendung** (KI-Anlege-Dialog, Lektorat-Buttons);
 * die Server-Endpunkte bleiben erreichbar. #1335: Der frühere Feinschalter „Schnellerfassung aktiv"
 * (Key `pp-quick-capture-enabled`) ist ersatzlos entfallen — die Schnellerfassung ist kein eigenes
 * Feature mehr, sondern der eine KI-Anlege-Dialog.
 */

/** `localStorage`-Schlüssel der KI-Präferenz (muss mit den e2e-Tests übereinstimmen). */
export const AI_ENABLED_STORAGE_KEY = 'pp-ai-enabled';

interface AiPreferences {
	/** KI-Features (Anlege-Dialog mit Berater, Lektorate) sichtbar? Default `true`. */
	aiEnabled: boolean;
}

/**
 * Liest die Präferenz. Fehlt der Wert oder ist er ungültig (alles andere als `'true'`/`'false'`),
 * gilt der Default `true`; ein gesperrter `localStorage` liefert ebenfalls den Default.
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
	};
};

/** Speichert die Präferenz (Best-Effort); Fehler (z. B. voller/gesperrter Storage) werden ignoriert. */
export const storeAiPreferences = (preferences: AiPreferences): void => {
	try {
		localStorage.setItem(AI_ENABLED_STORAGE_KEY, String(preferences.aiEnabled));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

interface UseAiPreferencesResult extends AiPreferences {
	/** Die Präferenz setzen (persistiert und sofort im State übernommen). */
	setAiEnabled: (value: boolean) => void;
}

/** React-Hook zur KI-Einstellung. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useAiPreferences = (): UseAiPreferencesResult => {
	const [preferences, setPreferences] = useState<AiPreferences>(readAiPreferences);

	const setAiEnabled = useCallback((value: boolean): void => {
		const next = { aiEnabled: value };
		storeAiPreferences(next);
		setPreferences(next);
	}, []);

	return { ...preferences, setAiEnabled };
};
