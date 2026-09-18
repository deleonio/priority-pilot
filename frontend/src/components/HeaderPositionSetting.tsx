import { KolInputRadio } from '@public-ui/react-v19';
import { useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { HEADER_POSITIONS, useHeaderPosition, type HeaderPosition } from '../lib/headerPosition';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Bedienelement für die Kopfzeilen-Position im Einstellungen-Tab „Allgemein“ (#1428).
 *
 * Benannte Radiogruppe („Kopfzeile“) mit den Optionen Oben/Unten. Zustands- und Persistenzlogik
 * kommt aus `useHeaderPosition` (`headerPosition.ts`, localStorage-Key `pp-header-position`); die
 * App setzt die Wahl rein per Layout um (`.app.header-bottom`), die DOM-Reihenfolge bleibt. Aufbau
 * bewusst wie `AppearanceSetting` daneben: Beide wählen, wie die App sich aufbaut.
 */
export const HeaderPositionSetting = () => {
	const { position, setPosition } = useHeaderPosition();
	const ref = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');

	// Stabile Objektidentität (hängt nur an der Modul-Konstante), damit die Radiogruppe nicht bei
	// jedem Render eine neue Options-Liste erhält.
	const options = useMemo(() => HEADER_POSITIONS.map(({ value, label }) => ({ label, value })), []);

	return (
		<div ref={ref}>
			<KolInputRadio
				_label="Kopfzeile"
				_orientation="horizontal"
				_options={options}
				_value={position}
				_hint="Legt fest, ob die Kopfzeile oben oder unten am Bildschirm steht."
				_on={{
					onChange: (_event, value) => {
						if (typeof value === 'string') {
							// flushSync (Präzedenz SessionExpiredDialog.tsx): Die Layout-Wirkung — die
							// Kopfzeile wandert — muss noch im selben Event-Tick greifen; der Listener-
							// Aufruf kommt aus einem nativen Custom-Element-Event und würde sonst erst
							// im nächsten Scheduler-Tick durchreichen (UX-Regel 7, sofortige Rückmeldung).
							flushSync(() => {
								setPosition(value as HeaderPosition);
							});
						}
					},
				}}
			/>
		</div>
	);
};
