import { KolButton } from '@public-ui/react-v19';
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

/**
 * Umschalter rechts oben für das Farbschema. Ein Klick wechselt zyklisch durch
 * System/Hell/Dunkel; das aktuelle Icon und ein sprechendes (verstecktes) Label zeigen den
 * Zustand und das nächste Ziel an. Die eigentliche Logik (Persistenz, OS-Erkennung, Anwendung)
 * kapselt der `useTheme`-Hook.
 */
export const ThemeToggle = () => {
	const { preference, setPreference } = useTheme();
	const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];

	// `_icons` als stabile Objektidentität pro Modus, damit der Icon-Watcher von `KolButton` nicht
	// bei jedem Render unnötig erneut feuert.
	const icons = useMemo(() => ({ left: { icon: ICONS[preference] } }), [preference]);

	return (
		<KolButton
			_label={`Darstellung: ${LABELS[preference]} (umschalten zu ${LABELS[next]})`}
			_hideLabel
			_icons={icons}
			_variant="secondary"
			_on={{ onClick: () => setPreference(next) }}
		/>
	);
};
