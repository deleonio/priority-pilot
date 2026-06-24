import { useMemo } from 'react';
import type { ThemePreference } from '../lib/theme';
import { useTheme } from '../lib/theme';

// Reihenfolge des Dreifach-Umschalters: System → Hell → Dunkel → (wieder System). „System" folgt
// dem Betriebssystem, „Hell"/„Dunkel" erzwingen das jeweilige Theme als Override.
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

const LABELS: Record<ThemePreference, string> = {
	system: 'System',
	light: 'Hell',
	dark: 'Dunkel',
};

// Font-Awesome-Solid-Glyphen (über das Default-Theme geladen, siehe `main.tsx`): Halbmond-Kreis für
// „System", Sonne für „Hell", Mond für „Dunkel".
const ICONS: Record<ThemePreference, string> = {
	system: 'fa-solid fa-circle-half-stroke',
	light: 'fa-solid fa-sun',
	dark: 'fa-solid fa-moon',
};

/** Die für einen `KolToolbar`-Button benötigten, zustandsabhängigen Teile des Theme-Umschalters. */
export interface ThemeToolbarItem {
	/** Sprechendes (verstecktes) Label „Darstellung: … (umschalten zu …)". */
	_label: string;
	/** `_icons`-Deskriptor mit stabiler Identität pro Modus (Icon-Watcher-Schutz). */
	_icons: { left: { icon: string } };
	/** Schaltet zyklisch zum nächsten Modus weiter. */
	onClick: () => void;
}

/**
 * Liefert den Farbschema-Umschalter als zustandsabhängigen `KolToolbar`-Button-Deskriptor.
 *
 * Da `KolToolbar._items` nur flache Button-Deskriptoren transportiert, lässt sich der bisherige
 * Composite-Button nicht als Kind-Element in die Header-Toolbar einhängen. Stattdessen kapselt
 * dieser Hook die Zustandslogik (`useTheme`: Persistenz, OS-Erkennung, Anwendung) und gibt Label,
 * Icon und `onClick` zurück, die in `App.tsx` zu einem Toolbar-Item zusammengesetzt werden.
 *
 * Ein Klick wechselt zyklisch durch System/Hell/Dunkel; das aktuelle Icon und ein sprechendes
 * (verstecktes) Label zeigen den Zustand und das nächste Ziel an (Verhalten unverändert).
 */
export const useThemeToolbarItem = (): ThemeToolbarItem => {
	const { preference, setPreference } = useTheme();
	const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];

	// `_icons` als stabile Objektidentität pro Modus, damit der Icon-Watcher von `KolButton` nicht
	// bei jedem Render unnötig erneut feuert.
	const icons = useMemo(() => ({ left: { icon: ICONS[preference] } }), [preference]);

	return useMemo(
		() => ({
			_label: `Darstellung: ${LABELS[preference]} (umschalten zu ${LABELS[next]})`,
			_icons: icons,
			onClick: () => setPreference(next),
		}),
		[preference, next, icons, setPreference],
	);
};
