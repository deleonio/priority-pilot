import { KolInputRadio } from '@public-ui/react-v19';
import { useRef } from 'react';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Darstellungs-Bedienelement für den Einstellungen-Tab "Allgemein" (#285).
 *
 * Dunkelmodus ist deaktiviert — die App läuft nur im Hell-Modus. Das Radio zeigt
 * "Hell" als einzige, deaktivierte Option. `theme.ts` setzt beim Start fix `light`
 * (Anti-FOUC), eine Nutzerwahl gibt es nicht mehr.
 */

// Fix auf Hell, keine Auswahl möglich. Modul-Konstante für stabile Objektidentität.
const OPTIONS = [{ label: 'Hell', value: 'light' }];

export const AppearanceSetting = () => {
	const ref = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');

	return (
		<div ref={ref}>
			<KolInputRadio
				_label="Darstellung"
				_orientation="horizontal"
				_options={OPTIONS}
				_value="light"
				_disabled
				_hint="Die Anwendung verwendet das helle Farbschema. Dunkelmodus ist aktuell deaktiviert."
			/>
		</div>
	);
};
