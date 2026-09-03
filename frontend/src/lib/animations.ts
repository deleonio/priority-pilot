import { useCallback, useState } from 'react';

/**
 * Persistenz für die Allgemein-Einstellung „Animationen" (#1183) — Master-Schalter für alle
 * dekorativen Animationen der App (erster Konsument: Konfetti aus #1169).
 *
 * Bewusst — analog zu `voiceAutostart.ts` — getrennt in **reine Funktionen** (ohne React, einfach
 * testbar) und einen kleinen `useAnimationsEnabled`-Hook. Der Default ist **aus** (`false`): ohne
 * gespeicherten Eintrag (neues Gerät/Profil) wird nichts animiert, eine Migration alter Geräte
 * findet bewusst nicht statt (Issue #1183). Fehlender/gesperrter `localStorage` (z. B. blockierte
 * Cookies) darf den App-Start nie verhindern → alle Zugriffe sind Best-Effort.
 */

/** `localStorage`-Schlüssel der gespeicherten Wahl (muss mit den Tests übereinstimmen). */
const STORAGE_KEY = 'pp-animations-enabled';

/**
 * Liest die gespeicherte Wahl. Fehlt sie, ist sie ungültig oder ist `localStorage` nicht verfügbar,
 * gilt der Default **aus** (`false`).
 */
export const readAnimationsEnabled = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return false;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
export const storeAnimationsEnabled = (enabled: boolean): void => {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

interface UseAnimationsEnabledResult {
	/** Aktuell gewählter Zustand (Default `false`). */
	enabled: boolean;
	/** Wahl setzen (persistiert und sofort im State übernommen). */
	setEnabled: (enabled: boolean) => void;
}

/** React-Hook zur Animationen-Einstellung. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useAnimationsEnabled = (): UseAnimationsEnabledResult => {
	const [enabled, setEnabledState] = useState<boolean>(readAnimationsEnabled);

	const setEnabled = useCallback((next: boolean): void => {
		storeAnimationsEnabled(next);
		setEnabledState(next);
	}, []);

	return { enabled, setEnabled };
};
