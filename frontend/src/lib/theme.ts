/**
 * Theme-Logik: Die App unterstützt drei Modi — System/Hell/Dunkel, wobei der Dunkelmodus
 * aktuell deaktiviert ist. Die UI zeigt alle drei Optionen, aber das gesamte Element ist
 * disabled.
 *
 * Der Anti-FOUC-Bootstrap in `index.html` und `applyInitialTheme` setzen das `data-theme`
 * Attribut auf `light`. `color-scheme` lässt native Controls/Scrollbars mitziehen.
 */

import { useEffect, useState } from 'react';

/** Vom Nutzer gewählter Modus. `system` folgt der OS-Einstellung (Standard). */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Effektiv angewandtes Theme (aus der Wahl + OS-Einstellung abgeleitet). */
type ResolvedTheme = 'light' | 'dark';

/** localStorage-Key für die Theme-Präferenz. */
const THEME_STORAGE_KEY = 'pp-theme';

/**
 * Bestimmt das effektive Theme aus einer Nutzer-Präferenz und der OS-Präferenz.
 */
export const resolveTheme = (preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme => {
	if (preference === 'system') {
		return systemTheme;
	}
	return preference;
};

/**
 * Liest die OS-Theme-Präferenz aus `window.matchMedia`.
 */
export const getSystemTheme = (): ResolvedTheme => {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Liest die gespeicherte Theme-Präferenz aus localStorage.
 */
export const getStoredTheme = (): ThemePreference => {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === 'system' || stored === 'light' || stored === 'dark') {
			return stored;
		}
	} catch {
		// localStorage nicht verfügbar
	}
	return 'system'; // Standard
};

/**
 * Speichert eine Theme-Präferenz in localStorage.
 */
export const storeTheme = (preference: ThemePreference): void => {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// localStorage nicht verfügbar
	}
};

/**
 * Wendet ein Theme auf das `<html>`-Element an — vor dem ersten Render
 * aufzurufen, damit beim Laden kein Theme-Wechsel aufblitzt (Anti-FOUC).
 */
const applyTheme = (theme: ResolvedTheme): void => {
	try {
		const root = document.documentElement;
		root.dataset.theme = theme;
		root.style.colorScheme = theme;
	} catch {
		// DOM nicht verfügbar — das Standard-Theme greift dann ohne Vorab-Anstrich.
	}
};

/**
 * Wendet das hell Theme auf das `<html>`-Element an — vor dem ersten Render
 * aufzurufen, damit beim Laden kein Theme-Wechsel aufblitzt (Anti-FOUC).
 * Diese Funktion wird im Anti-FOUC-Bootstrap aufgerufen und setzt immer `light`.
 */
export const applyInitialTheme = (): void => {
	try {
		const root = document.documentElement;
		root.dataset.theme = 'light';
		root.style.colorScheme = 'light';
	} catch {
		// DOM nicht verfügbar — das Standard-Theme greift dann ohne Vorab-Anstrich.
	}
};

/**
 * Hook für Theme-Logik mit Persistenz in localStorage. Liefert die aktuelle
 * Präferenz und eine Setter-Funktion, die auch das DOM aktualisiert.
 */
export const useTheme = (): {
	preference: ThemePreference;
	setPreference: (preference: ThemePreference) => void;
	resolvedTheme: ResolvedTheme;
} => {
	const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredTheme());
	const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference, systemTheme));

	// System-Theme-Änderungen überwachen
	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = (e: MediaQueryListEvent) => {
			const newSystemTheme = e.matches ? 'dark' : 'light';
			setSystemTheme(newSystemTheme);
			setResolvedTheme(resolveTheme(preference, newSystemTheme));
		};

		// Moderner Browser:addEventListener
		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, [preference]);

	// Präferenz-Änderungen verarbeiten
	const setPreference = (newPreference: ThemePreference) => {
		setPreferenceState(newPreference);
		storeTheme(newPreference);
		const newResolvedTheme = resolveTheme(newPreference, systemTheme);
		setResolvedTheme(newResolvedTheme);
		applyTheme(newResolvedTheme);
	};

	return { preference, setPreference, resolvedTheme };
};

/** Export-Konstanten für die UI */
export const THEME_LABELS: Record<ThemePreference, string> = {
	system: 'System',
	light: 'Hell',
	dark: 'Dunkel',
};

export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
