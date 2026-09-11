import { useCallback, useState } from 'react';

/**
 * Feinschalter „Lebensbalance animieren" für das Balance-Gefäß auf dem Dashboard — neben dem
 * Master-Schalter „Animationen" (`animations.ts`, #1183) die zweite Stufe: Das Gefäß atmet und
 * wellt nur, wenn **beide** Schalter an sind. Muster und Best-Effort-Regeln wie dort.
 *
 * Der Default ist **an**: Der Master-Schalter bleibt das Tor (er ist standardmäßig aus), wer
 * Animationen insgesamt freischaltet, bekommt das Gefäß ohne zweiten Klick mit — und kann es
 * gezielt abbestellen, ohne Konfetti & Co. zu verlieren. OS-Seitig „Bewegung reduzieren" gewinnt
 * ohnehin immer (CSS `prefers-reduced-motion`).
 */

/**
 * `localStorage`-Schlüssel der gespeicherten Wahl (muss mit den Tests übereinstimmen).
 * Bewusst der historische `pp-heart-animation-enabled`: Gespeicherte Nutzereinstellungen sollen
 * den Formwechsel Herz → Messkolben unbeschadet überstehen.
 */
const STORAGE_KEY = 'pp-heart-animation-enabled';

/**
 * Liest die gespeicherte Wahl. Fehlt sie oder ist `localStorage` nicht verfügbar, gilt der
 * Default **an** (`true`) — nur ein explizit gespeichertes `false` schaltet das Gefäß still.
 */
const readVesselAnimationEnabled = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'false';
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return true;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
const storeVesselAnimationEnabled = (enabled: boolean): void => {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

interface UseVesselAnimationEnabledResult {
	/** Aktuell gewählter Zustand (Default `true`). */
	enabled: boolean;
	/** Wahl setzen (persistiert und sofort im State übernommen). */
	setEnabled: (enabled: boolean) => void;
}

/** React-Hook zur Lebensbalance-Animation-Einstellung. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useVesselAnimationEnabled = (): UseVesselAnimationEnabledResult => {
	const [enabled, setEnabledState] = useState<boolean>(readVesselAnimationEnabled);

	const setEnabled = useCallback((next: boolean): void => {
		storeVesselAnimationEnabled(next);
		setEnabledState(next);
	}, []);

	return { enabled, setEnabled };
};
