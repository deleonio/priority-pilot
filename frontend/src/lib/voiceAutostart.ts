import { useCallback, useState } from 'react';

/**
 * Persistenz für die Allgemein-Einstellung „Sprachaufnahme automatisch starten" (#272).
 *
 * Bewusst — analog zu `theme.ts` — getrennt in **reine Funktionen** (ohne React, einfach testbar)
 * und einen kleinen `useVoiceAutostart`-Hook. Der Default ist **aus** (`false`): ohne gespeicherten
 * Eintrag startet kein Formular automatisch eine Aufnahme. Fehlender/gesperrter `localStorage`
 * (z. B. blockierte Cookies) darf den App-Start nie verhindern → alle Zugriffe sind Best-Effort.
 */

/** `localStorage`-Schlüssel der gespeicherten Wahl (muss mit den e2e-Tests übereinstimmen). */
export const STORAGE_KEY = 'pp-voice-autostart';

/**
 * Liest die gespeicherte Wahl. Fehlt sie, ist sie ungültig oder ist `localStorage` nicht verfügbar,
 * gilt der Default **aus** (`false`).
 */
export const readVoiceAutostartPreference = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return false;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
export const storeVoiceAutostartPreference = (enabled: boolean): void => {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

interface UseVoiceAutostartResult {
	/** Aktuell gewählter Zustand (Default `false`). */
	enabled: boolean;
	/** Wahl setzen (persistiert und sofort im State übernommen). */
	setEnabled: (enabled: boolean) => void;
}

/** React-Hook zur Voice-Autostart-Einstellung. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useVoiceAutostart = (): UseVoiceAutostartResult => {
	const [enabled, setEnabledState] = useState<boolean>(readVoiceAutostartPreference);

	const setEnabled = useCallback((next: boolean): void => {
		storeVoiceAutostartPreference(next);
		setEnabledState(next);
	}, []);

	return { enabled, setEnabled };
};
