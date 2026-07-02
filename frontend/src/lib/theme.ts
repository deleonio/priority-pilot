import { useCallback, useEffect, useState } from 'react';

/**
 * Theme-Logik: Drei-Zustands-Modus (System/Hell/Dunkel), Persistenz in `localStorage`,
 * Ableitung des effektiven Themes aus der OS-Einstellung und Anwendung auf `<html>`.
 *
 * Bewusst getrennt in **reine Funktionen** (ohne React, einfach testbar) und einen kleinen
 * `useTheme`-Hook, der die reinen Funktionen mit React-State und einem `matchMedia`-Listener
 * verdrahtet. Den ersten, FOUC-freien Anstrich erledigt ein Inline-Bootstrap in `index.html`
 * (gleicher `STORAGE_KEY`/`<html>`-Mechanismus) — der Hook übernimmt danach die Live-Steuerung.
 */

/** Vom Nutzer gewählter Modus. `system` folgt der OS-Einstellung (Standard). */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Effektiv angewandtes Theme (aus der Wahl + OS-Einstellung abgeleitet). */
type ResolvedTheme = 'light' | 'dark';

/** `localStorage`-Schlüssel der gespeicherten Wahl — identisch zum Bootstrap in `index.html`. */
export const STORAGE_KEY = 'pp-theme';

/** Media-Query, über die der Dunkel-Wunsch des Betriebssystems erkannt wird. */
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Prüft, ob ein beliebiger Wert eine gültige `ThemePreference` ist. */
const isPreference = (value: unknown): value is ThemePreference =>
	value === 'system' || value === 'light' || value === 'dark';

/**
 * Liest die gespeicherte Wahl. Fehlt sie oder ist `localStorage` nicht verfügbar
 * (z. B. blockierte Cookies), wird auf `light` zurückgefallen.
 */
export const readStoredPreference = (): ThemePreference => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isPreference(stored) ? stored : 'light';
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return 'light';
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
export const storePreference = (preference: ThemePreference): void => {
	try {
		localStorage.setItem(STORAGE_KEY, preference);
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

/** Leitet aus Wahl und OS-Zustand das effektiv anzuwendende Theme ab. */
export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ResolvedTheme => {
	if (preference === 'system') {
		return prefersDark ? 'dark' : 'light';
	}
	return preference;
};

/**
 * Wendet das effektive Theme auf das `<html>`-Element an: `data-theme` steuert die
 * App-eigenen CSS-Custom-Properties, `color-scheme` lässt native Controls/Scrollbars mitziehen.
 */
const applyTheme = (resolved: ResolvedTheme): void => {
	const root = document.documentElement;
	root.dataset.theme = resolved;
	root.style.colorScheme = resolved;
};

/** Aktueller OS-Dunkel-Wunsch (Live-Abfrage). */
const systemPrefersDark = (): boolean => window.matchMedia(DARK_MEDIA_QUERY).matches;

/**
 * Wendet das gespeicherte (bzw. OS-abgeleitete) Theme **einmalig und synchron** an — vor dem
 * ersten Render aufzurufen, damit beim Laden kein helles Theme aufblitzt (Anti-FOUC). Der
 * `useTheme`-Hook übernimmt danach die Live-Steuerung. Fehlende DOM-/Storage-APIs werden
 * abgefangen, sodass der Aufruf nie den App-Start verhindert.
 */
export const applyInitialTheme = (): void => {
	try {
		applyTheme(resolveTheme(readStoredPreference(), systemPrefersDark()));
	} catch {
		// matchMedia/DOM evtl. nicht verfügbar — das Standard-Theme greift dann ohne Vorab-Anstrich.
	}
};

interface UseThemeResult {
	/** Aktuell gewählter Modus. */
	preference: ThemePreference;
	/** Effektiv angewandtes Theme (nach OS-Auflösung). */
	resolved: ResolvedTheme;
	/** Wahl ändern (persistiert und sofort angewandt). */
	setPreference: (preference: ThemePreference) => void;
}

/**
 * React-Hook zur Theme-Steuerung. Wendet die Wahl auf `<html>` an und lauscht im
 * `system`-Modus live auf OS-Wechsel; bei expliziter Wahl (`light`/`dark`) wird der
 * Listener wieder abgemeldet, sodass die Nutzerwahl Vorrang behält.
 */
export const useTheme = (): UseThemeResult => {
	const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
	const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference, systemPrefersDark()));

	useEffect(() => {
		const media = window.matchMedia(DARK_MEDIA_QUERY);
		const apply = (): void => {
			const next = resolveTheme(preference, media.matches);
			applyTheme(next);
			setResolved(next);
		};
		apply();
		// Nur im System-Modus auf OS-Wechsel reagieren — eine explizite Wahl überschreibt das OS.
		if (preference !== 'system') {
			return;
		}
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	}, [preference]);

	const setPreference = useCallback((next: ThemePreference): void => {
		storePreference(next);
		setPreferenceState(next);
	}, []);

	return { preference, resolved, setPreference };
};
