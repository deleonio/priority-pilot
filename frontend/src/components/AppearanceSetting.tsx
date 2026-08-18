import { KolInputRadio } from '@public-ui/react-v19';

/**
 * Darstellungs-Bedienelement für den Einstellungen-Tab "Allgemein" (#285).
 *
 * Dunkelmodus ist deaktiviert — die App läuft nur im Hell-Modus. Das Radio zeigt
 * "Hell" als einzige, deaktivierte Option. Die Persistenzlogik (`useTheme`) bleibt
 * im Hintergrund aktiv, wird aber nicht mehr durch Nutzerwahl verändert.
 */
export const AppearanceSetting = () => {
	// Fix auf Hell, keine Auswahl möglich.
	return (
		<KolInputRadio
			_label="Darstellung"
			_orientation="horizontal"
			_options={[{ label: 'Hell', value: 'light' }]}
			_value="light"
			_disabled
			_hint="Die Anwendung verwendet das helle Farbschema. Dunkelmodus ist aktuell deaktiviert."
		/>
	);
};
