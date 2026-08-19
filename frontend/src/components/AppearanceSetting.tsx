import { KolInputRadio } from '@public-ui/react-v19';
import { useMemo } from 'react';
import { useRef } from 'react';
import { useTheme } from '../lib/theme';
import { THEME_LABELS, THEME_ORDER } from './ThemeToggle';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Darstellungs-Bedienelement für den Einstellungen-Tab "Allgemein" (#285).
 *
 * Dunkelmodus ist deaktiviert — die App läuft nur im Hell-Modus. Das Radio zeigt
 * alle drei Optionen (System/Hell/Dunkel), aber das gesamte Element ist disabled.
 * Die useTheme-Logik und Persistenz bleiben im Hintergrund aktiv für eine eventuelle
 * zukünftige Reaktivierung.
 */

export const AppearanceSetting = () => {
	const { preference } = useTheme();
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
				_disabled
				_hint="Die Anwendung verwendet das helle Farbschema. Dunkelmodus ist aktuell deaktiviert."
			/>
		</div>
	);
};
