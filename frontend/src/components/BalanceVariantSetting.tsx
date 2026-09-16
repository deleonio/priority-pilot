import { KolInputRadio } from '@public-ui/react-v19';
import { useMemo, useRef } from 'react';
import { BALANCE_VARIANTS, useBalanceVariant, type BalanceVariant } from '../lib/balanceVariant';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Bildwahl für die Lebensbalance im Einstellungen-Tab „Allgemein" — das Zifferblatt der Startseite.
 *
 * Benannte Radiogruppe mit den vier Bildern; Zustand und Persistenz kommen aus `useBalanceVariant`
 * (`balanceVariant.ts`, localStorage-Key `pp-balance-variant`). Aufbau bewusst wie
 * `AppearanceSetting` daneben: Beide wählen, **wie** die App aussieht, nicht **was** sie rechnet.
 *
 * Senkrecht statt waagerecht: Vier Optionen mit sprechenden Namen passen auf 375 px nicht
 * nebeneinander, ohne dass die Beschriftungen umbrechen (mobile-ui-rules.md).
 */
export const BalanceVariantSetting = () => {
	const { variant, setVariant } = useBalanceVariant();
	const ref = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');

	// Stabile Objektidentität (hängt nur an der Modul-Konstante), damit die Radiogruppe nicht bei
	// jedem Render eine neue Options-Liste erhält.
	const options = useMemo(() => BALANCE_VARIANTS.map(({ value, label }) => ({ label, value })), []);

	return (
		<div ref={ref} data-testid="balance-variant-setting">
			<KolInputRadio
				_label="Bild der Lebensbalance"
				_orientation="vertical"
				_options={options}
				_value={variant}
				_hint="Alle vier Bilder zeigen dieselbe Rechnung. „Herz“ füllt ein Gefäß; die Blasen-Bilder zeigen je Säule eine Blase — nach Erfüllung des eigenen Ziels, nach Anteil am Aufwand, oder nach Anteil mit einem Ring auf Ziel-Größe."
				_on={{
					onChange: (_event, value) => {
						if (typeof value === 'string') {
							setVariant(value as BalanceVariant);
						}
					},
				}}
			/>
		</div>
	);
};
