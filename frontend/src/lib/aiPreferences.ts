import { useCallback, useState } from 'react';
import { useEntitlement } from './usePlan';
import type { Plan } from './planOffers';

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
 *
 * #1525: Die Präferenz allein reicht nicht mehr — KI-Bedienelemente brauchen zusätzlich die
 * Berechtigung `ai_assist` (#1903: ein eigener Provider hebt die Sperre nicht mehr auf). Das
 * effektive Gate ist `computeAiFeaturesEnabled` (reine Funktion, Wahrheitstabelle siehe Tests)
 * plus der Hook `useAiFeaturesEnabled`, der Präferenz und Entitlement zusammenführt.
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
const useAiPreferences = (): UseAiPreferencesResult => {
	const [preferences, setPreferences] = useState<AiPreferences>(readAiPreferences);

	const setAiEnabled = useCallback((value: boolean): void => {
		const next = { aiEnabled: value };
		storeAiPreferences(next);
		setPreferences(next);
	}, []);

	return { ...preferences, setAiEnabled };
};

interface AiFeatureGateInput {
	/** Nutzerwunsch aus `readAiPreferences().aiEnabled`. */
	preferenceEnabled: boolean;
	/** `useEntitlement('ai_assist')?.allowed`; `undefined` solange noch nicht geladen. */
	entitlementAllowed: boolean | undefined;
}

/**
 * Effektives KI-Gate (#1525, #1903 AK7): Präferenz UND Berechtigung `ai_assist`. Ein eigener
 * Provider hebt die Paket-Sperre nicht mehr auf. Solange die Berechtigung noch nicht geladen ist,
 * gilt der sichere Default `false`, damit KI-Elemente nicht erst auf- und dann wieder zublitzen (AK5).
 */
export const computeAiFeaturesEnabled = ({ preferenceEnabled, entitlementAllowed }: AiFeatureGateInput): boolean =>
	preferenceEnabled && entitlementAllowed === true;

interface UseAiFeaturesEnabledResult extends UseAiPreferencesResult {
	/** Effektives Gate — ob KI-Bedienelemente tatsächlich erscheinen dürfen. */
	aiFeaturesEnabled: boolean;
	/** Berechtigung `ai_assist`; `undefined` solange noch nicht geladen. */
	entitlementAllowed: boolean | undefined;
	/** Paket aus dem Entitlement, für den Angebots-Alert (`SettingsPage.tsx` AK1). */
	requiredPlan: Plan | undefined;
}

/** Führt Präferenz und Entitlement `ai_assist` zum effektiven Gate zusammen. */
export const useAiFeaturesEnabled = (): UseAiFeaturesEnabledResult => {
	const preferences = useAiPreferences();
	const entitlement = useEntitlement('ai_assist');

	return {
		...preferences,
		aiFeaturesEnabled: computeAiFeaturesEnabled({
			preferenceEnabled: preferences.aiEnabled,
			entitlementAllowed: entitlement?.allowed,
		}),
		entitlementAllowed: entitlement?.allowed,
		requiredPlan: entitlement?.requiredPlan,
	};
};

/**
 * Nur-Lese-Gate für Konsumenten ohne eigenen Schalter (`App.tsx`, `TaskForm.tsx`,
 * `SearchModal.tsx`, #1525 AK3). Liest die Präferenz bewusst PRO RENDER frisch über
 * `readAiPreferences()` statt über `useAiPreferences()`-State: Diese Komponenten besitzen keine
 * eigene Hook-Instanz, die bei `setAiEnabled` in `SettingsPage` aktualisiert würde — ein
 * gepufferter State-Wert bliebe nach einem Wechsel in die Einstellungen und zurück veraltet
 * stehen (Muster wie zuvor bei `App.tsx`s direktem `readAiPreferences()`-Aufruf).
 */
export const useAiFeaturesGate = (): boolean => {
	const { aiEnabled: preferenceEnabled } = readAiPreferences();
	const entitlementAllowed = useEntitlement('ai_assist')?.allowed;

	return computeAiFeaturesEnabled({ preferenceEnabled, entitlementAllowed });
};
