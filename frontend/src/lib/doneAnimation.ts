import { useCallback, useState } from 'react';

/**
 * Feinschalter „Erledigt animieren" für den Konfetti-Regen beim Erledigt-Toggle (#1169) —
 * neben dem Master-Schalter „Animationen" (`animations.ts`, #1183) die zweite Stufe: Konfetti
 * fällt nur, wenn **beide** Schalter an sind. Muster und Best-Effort-Regeln wie in
 * `heartAnimation.ts` („Herz animieren").
 *
 * Der Default ist **an**: Der Master-Schalter bleibt das Tor (er ist standardmäßig aus), wer
 * Animationen insgesamt freischaltet, feiert Erledigt ohne zweiten Klick mit — und kann den
 * Regen gezielt abbestellen, ohne das Herz oder andere Animationen zu verlieren. OS-Seitig
 * „Bewegung reduzieren" gewinnt ohnehin immer (`confetti.ts` fragt die Query selbst ab).
 */

/** `localStorage`-Schlüssel der gespeicherten Wahl (muss mit den Tests übereinstimmen). */
const STORAGE_KEY = 'pp-done-animation-enabled';

/**
 * Liest die gespeicherte Wahl. Fehlt sie oder ist `localStorage` nicht verfügbar, gilt der
 * Default **an** (`true`) — nur ein explizit gespeichertes `false` unterdrückt den Regen.
 */
export const readDoneAnimationEnabled = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'false';
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return true;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
const storeDoneAnimationEnabled = (enabled: boolean): void => {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

interface UseDoneAnimationEnabledResult {
	/** Aktuell gewählter Zustand (Default `true`). */
	enabled: boolean;
	/** Wahl setzen (persistiert und sofort im State übernommen). */
	setEnabled: (enabled: boolean) => void;
}

/** React-Hook zur Erledigt-Animation-Einstellung. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useDoneAnimationEnabled = (): UseDoneAnimationEnabledResult => {
	const [enabled, setEnabledState] = useState<boolean>(readDoneAnimationEnabled);

	const setEnabled = useCallback((next: boolean): void => {
		storeDoneAnimationEnabled(next);
		setEnabledState(next);
	}, []);

	return { enabled, setEnabled };
};
