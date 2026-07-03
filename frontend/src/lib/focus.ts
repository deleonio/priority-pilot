/**
 * Das tatsächlich fokussierte Element ermitteln — auch über (offene) Shadow-DOM-Grenzen hinweg.
 * Nötig, weil KoliBri-Trigger verschachtelt sein können (Button in `kol-toolbar` im Shadow der
 * `kol-table-stateful`); `document.activeElement` allein liefert nur den äußersten Host.
 *
 * Genutzt von `Modal` (Fokus-Rückgabe beim Schließen) und von mehrstufigen Dialog-Flows
 * (z. B. Schnellerfassung #236), die den Auslöser über einen Dialog-Wechsel hinweg als
 * Fallback-Fokusziel weiterreichen müssen.
 */
export const deepActiveElement = (): Element | null => {
	let element = document.activeElement;
	while (element?.shadowRoot?.activeElement != null) {
		element = element.shadowRoot.activeElement;
	}
	return element;
};
