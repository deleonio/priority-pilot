import { KolInputRadio } from '@public-ui/react-v19';
import { useMemo, useRef } from 'react';
import type { ThemePreference } from '../lib/theme';
import { THEME_LABELS, THEME_ORDER, useTheme } from '../lib/theme';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Darstellungs-Bedienelement für den Einstellungen-Tab "Allgemein" (#285).
 *
 * Benannte Radiogruppe („Darstellung") mit den drei Optionen System / Hell / Dunkel. Die
 * Zustands-/Persistenzlogik kommt aus `useTheme` (`theme.ts`, localStorage-Key `pp-theme`).
 */

export const AppearanceSetting = () => {
	const { preference, setPreference } = useTheme();
	const ref = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');

	// Optionen als stabile Objektidentität (nur von den Modul-Konstanten abhängig), damit die
	// Radiogruppe nicht bei jedem Render eine neue Options-Liste erhält.
	const options = useMemo(() => THEME_ORDER.map((value) => ({ label: THEME_LABELS[value], value })), []);

	return (
		<div ref={ref}>
			<KolInputRadio
				_label="Darstellung"
				_orientation="horizontal"
				_options={options}
				_value={preference}
				_hint="Wähle das Farbschema der Anwendung. „System“ folgt der Einstellung deines Betriebssystems."
				_on={{
					onChange: (_event, value) => {
						if (typeof value === 'string') {
							setPreference(value as ThemePreference);
						}
					},
				}}
			/>
		</div>
	);
};
