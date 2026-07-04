import { KolInputRadio } from '@public-ui/react-v19';
import { useMemo } from 'react';
import type { ThemePreference } from '../lib/theme';
import { useTheme } from '../lib/theme';
import { THEME_LABELS, THEME_ORDER } from './ThemeToggle';

/**
 * Darstellungs-Bedienelement für den Einstellungen-Tab „Allgemein" (#285).
 *
 * Verschiebt die frühere Header-Toolbar-Umschaltung in die Einstellungen: eine benannte Radiogruppe
 * („Darstellung") mit den drei Optionen **System / Hell / Dunkel**. Die Zustands-/Persistenzlogik
 * kommt unverändert aus `useTheme` (`theme.ts`, localStorage-Key `pp-theme`) — es gibt keine zweite
 * Quelle der Wahrheit. Die Optionen und ihre Labels teilt sich das Element mit dem früheren
 * Umschalter über die Konstanten aus `ThemeToggle.tsx`.
 */
export const AppearanceSetting = () => {
	const { preference, setPreference } = useTheme();

	// Optionen als stabile Objektidentität (nur von den Modul-Konstanten abhängig), damit die
	// Radiogruppe nicht bei jedem Render eine neue Options-Liste erhält.
	const options = useMemo(() => THEME_ORDER.map((value) => ({ label: THEME_LABELS[value], value })), []);

	return (
		<KolInputRadio
			_label="Darstellung"
			_orientation="horizontal"
			_options={options}
			_value={preference}
			_hint={'Wähle das Farbschema der Anwendung. „System“ folgt der Einstellung deines Betriebssystems.'}
			_on={{
				onChange: (_event, value) => {
					if (typeof value === 'string') {
						setPreference(value as ThemePreference);
					}
				},
			}}
		/>
	);
};
