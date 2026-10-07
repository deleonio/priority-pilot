import { useCallback, useState } from 'react';
import { ACCOUNT_PREFERENCE_KEYS, sendAccountPreferences } from './accountPreferences';

/**
 * Persistenz des Expertenmodus (#1984): Schalter „Expertenmodus" in den Einstellungen.
 *
 * Muster wie `aiPreferences.ts`: reine Funktionen (ohne React, einfach testbar) plus ein kleiner
 * `useExpertMode`-Hook. Der Default ist **aus** (= Standardmodus): Säulen-Prozentregler im
 * Aufgabendialog, Gewichtregler im Abhängigkeits-Dialog und die Säulen-Gewichtungspflege erscheinen
 * nur mit eingeschaltetem Expertenmodus. Das Ausblenden ist bewusst eine reine **UI-Ausblendung** —
 * gespeicherte Gewichte und Verteilungen bleiben unverändert und erscheinen nach dem
 * Wiedereinschalten wieder. Ein gesperrter `localStorage` darf nie crashen → alle Zugriffe sind
 * Best-Effort.
 */

/** `localStorage`-Schlüssel des Expertenmodus (muss mit den e2e-Tests übereinstimmen). */
export const EXPERT_MODE_STORAGE_KEY = ACCOUNT_PREFERENCE_KEYS.expertMode;

interface ExpertMode {
	/** Expertenbedienelemente (Regler, Gewichte) sichtbar? Default `false`. */
	expertMode: boolean;
}

/**
 * Liest die Präferenz. Fehlt der Wert oder ist er ungültig (alles andere als `'true'`/`'false'`),
 * gilt der Default `false`; ein gesperrter `localStorage` liefert ebenfalls den Default.
 */
export const readExpertMode = (): ExpertMode => {
	try {
		return { expertMode: localStorage.getItem(EXPERT_MODE_STORAGE_KEY) === 'true' };
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return { expertMode: false };
	}
};

/** Speichert die Präferenz im Spiegel und am Konto (#2398, Best-Effort); Fehler werden ignoriert. */
export const storeExpertMode = (preferences: ExpertMode): void => {
	try {
		localStorage.setItem(EXPERT_MODE_STORAGE_KEY, String(preferences.expertMode));
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
	sendAccountPreferences({ expertMode: preferences.expertMode });
};

interface UseExpertModeResult extends ExpertMode {
	/** Die Präferenz setzen (persistiert und sofort im State übernommen). */
	setExpertMode: (value: boolean) => void;
}

/** React-Hook zum Expertenmodus-Schalter. Liest initial aus `localStorage`, persistiert bei Änderung. */
export const useExpertMode = (): UseExpertModeResult => {
	const [preferences, setPreferences] = useState<ExpertMode>(readExpertMode);

	const setExpertMode = useCallback((value: boolean): void => {
		const next = { expertMode: value };
		storeExpertMode(next);
		setPreferences(next);
	}, []);

	return { ...preferences, setExpertMode };
};

/**
 * Nur-Lese-Gate für Konsumenten ohne eigenen Schalter (`TaskForm.tsx`, `DependencyModal.tsx`,
 * Settings-Karte „Säulen-Gewichtung"). Liest bewusst PRO RENDER frisch über `readExpertMode()`
 * statt über Hook-State: Diese Komponenten besitzen keine eigene Hook-Instanz, die bei
 * `setExpertMode` in `SettingsPage` aktualisiert würde — ein gepufferter State-Wert bliebe nach
 * einem Wechsel in die Einstellungen und zurück veraltet stehen (Muster `useAiFeaturesGate`).
 */
export const useExpertModeGate = (): boolean => readExpertMode().expertMode;
