/**
 * Theme-Logik: Drei-Zustands-Modus (System/Hell/Dunkel), Persistenz in `localStorage`,
 * Ableitung des effektiven Themes aus der OS-Einstellung und Anwendung auf `<html>`.
 *
 * Der erste, FOUC-freie Anstrich passiert in einem Inline-Bootstrap in `index.html` (gleicher
 * `THEME_STORAGE_KEY`/`<html>`-Mechanismus) — der `useTheme`-Hook übernimmt danach die Live-Steuerung.
 */

import { useCallback, useEffect, useState } from 'react';

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
 * Wendet das effektive Theme auf das `<html>`-Element an. Beide Zeilen sind tragend:
 *
 * - `data-theme` steuert die App-eigenen `--pp-*`-Custom-Properties (app.css).
 * - `color-scheme` steuert native Controls/Scrollbars **und die KoliBri-Komponenten**: seit
 *   `@public-ui/theme-default` 4.4.1 ist jede Themefarbe ein `light-dark()`, das gegen
 *   `color-scheme` auflöst. Das Theme deklariert die Eigenschaft bewusst nicht selbst — sie
 *   vererbt über die Shadow-DOM-Grenze, die Anwendung besitzt also den Schalter. Fällt diese
 *   Zeile weg, wird die App dunkel und die Komponenten bleiben hell.
 *
 * Die Zuweisung erfolgt als Inline-Style und schlägt damit die Regel `:root[data-theme='dark']`
 * in app.css — wer das Farbschema von außen umschaltet (E2E), muss beides setzen (`setTheme` in
 * e2e/helpers.ts).
 *
 * Randnotiz zu `data-theme`: Der Attributname ist zugleich KoliBris eigener Theme-NAMENS-Selektor
 * (adopted-style-sheets). Folgenlos, weil `register()` in main.tsx das Theme fest auf `default`
 * nagelt und die DOM-Erkennung dann gar nicht erst greift. Entfiele diese Fixierung, suchte
 * KoliBri ein Theme namens `dark` und fände keins — dann wäre hier ein eigener Attributname fällig.
 */
const applyTheme = (resolved: ResolvedTheme): void => {
	const root = document.documentElement;
	root.dataset.theme = resolved;
	root.style.colorScheme = resolved;
};

/**
 * Wendet das gespeicherte (bzw. OS-abgeleitete) Theme **einmalig und synchron** an — vor dem
 * ersten Render aufzurufen, damit beim Laden kein Theme-Wechsel aufblitzt (Anti-FOUC). Der
 * `useTheme`-Hook übernimmt danach die Live-Steuerung. Fehlende DOM-/Storage-APIs werden
 * abgefangen, sodass der Aufruf nie den App-Start verhindert.
 */
export const applyInitialTheme = (): void => {
	try {
		applyTheme(resolveTheme(getStoredTheme(), getSystemTheme()));
	} catch {
		// DOM/matchMedia evtl. nicht verfügbar — das Standard-Theme greift dann ohne Vorab-Anstrich.
	}
};

/**
 * Hook für Theme-Logik mit Persistenz in localStorage. Liefert die aktuelle Präferenz, das daraus
 * abgeleitete effektive Theme sowie einen Setter, um die Wahl zu ändern (persistiert und sofort
 * angewandt).
 */
export const useTheme = (): {
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
	setPreference: (preference: ThemePreference) => void;
} => {
	const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredTheme());
	const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference, systemTheme));

	// Effektives Theme anwenden, sobald sich Präferenz oder aufgelöstes Theme ändern.
	useEffect(() => {
		const next = resolveTheme(preference, systemTheme);
		applyTheme(next);
		setResolvedTheme(next);
	}, [preference, systemTheme]);

	// System-Theme-Änderungen überwachen
	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = (e: MediaQueryListEvent) => {
			setSystemTheme(e.matches ? 'dark' : 'light');
		};

		// Moderner Browser:addEventListener
		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	const setPreference = useCallback((next: ThemePreference): void => {
		storeTheme(next);
		setPreferenceState(next);
	}, []);

	return { preference, resolvedTheme, setPreference };
};

/** Export-Konstanten für die UI */
export const THEME_LABELS: Record<ThemePreference, string> = {
	system: 'System',
	light: 'Hell',
	dark: 'Dunkel',
};

export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
