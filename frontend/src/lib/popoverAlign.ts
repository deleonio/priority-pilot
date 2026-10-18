/**
 * #369/#380: Das Panel (`.kol-popover-button__popover`) liegt im offenen Shadow-DOM von
 * `kol-popover-button` und ist damit von außen per CSS nicht erreichbar (kein `::part`).
 * `_popoverAlign="left"` lässt floating-ui das Panel links neben dem Trigger platzieren.
 * Die CSS-Shrink-to-fit-Breite bemisst sich am verfügbaren Platz; `width: max-content`
 * erzwingt die inhaltsbasierte Breite (alle Aktionen in einer Zeile), unabhängig vom
 * verfügbaren Platz. Das Panel clippt mit seinem UA-Style (`overflow: auto`) die
 * Fokus-Outline der Toolbar-Buttons; `overflow: visible` (#1186) hebt das auf.
 * Überschreitet das Panel den rechten Viewport-Rand, korrigiert
 * `correct()` `left` um den Überlauf (funktioniert, da KoliBri keinen MutationObserver
 * auf Panel-Style-Änderungen setzt — nur ResizeObserver/Scroll/Resize via autoUpdate).
 * Alle Shadow-DOM-Zugriffe sind unpublizierte KoliBri-API (@public-ui/react-v19 v4.2.1) —
 * bei KoliBri-Upgrades prüfen.
 *
 * Genutzt von den „…"-Menüs der Aufgabenliste (`TaskTree`) und vom Avatar-Menü im Kopfbereich
 * (`App`); deshalb liegt der Helper hier und nicht in einer der beiden Komponenten.
 *
 * Öffentliche Einstiegspunkte für Komponenten: {@link setupPopoverAlignment} (wartet zusätzlich das
 * asynchrone Custom-Element-Upgrade ab) und {@link findInnerButton} (#361-Fokus-Rückgabe).
 *
 * @returns Aufräumfunktion, die alle Observer und Listener wieder abmeldet.
 */
const alignPopoverPanelLeft = (host: HTMLKolPopoverButtonElement, alignEnd: boolean): (() => void) => {
	const root = host.shadowRoot;
	if (!root) return () => {};

	const correct = () => {
		const panel = root.querySelector<HTMLElement>('.kol-popover-button__popover');
		if (!panel) return;
		if (panel.style.width !== 'max-content') {
			panel.style.width = 'max-content';
		}
		if (panel.style.overflow !== 'visible') {
			// #1186: Das Panel clippt mit UA-`overflow: auto` die Fokus-Outline der Toolbar-Buttons.
			panel.style.overflow = 'visible';
		}
		if (alignEnd && panel.style.background !== 'transparent') {
			// Avatar-Menü: Die Karte (Rahmen, Radius, Schatten) zeichnet der Light-DOM-Inhalt, der
			// eckige weiße Panel-Grund und der auf die Panel-Mitte gerechnete Pfeil stören dabei.
			panel.style.background = 'transparent';
			panel.querySelector<HTMLElement>('.kol-popover__arrow')?.style.setProperty('display', 'none');
		}
		const rect = panel.getBoundingClientRect();
		if (rect.width === 0) return; // Panel versteckt (display:none) — DOM-Writes und Reflow sparen
		const currentLeft = parseFloat(panel.style.left) || 0;
		// alignEnd: rechte Panel-Kante bündig mit der rechten Trigger-Kante (Dropdown-Muster).
		let adjustedLeft = alignEnd ? currentLeft + host.getBoundingClientRect().right - rect.right : currentLeft;
		const rightOverflow = Math.ceil(rect.right) - window.innerWidth;
		if (rightOverflow > 0) {
			adjustedLeft -= rightOverflow;
		}
		// Das Panel kann bei schmalen Viewports (360px) über den linken Rand hinausschieben —
		// die reine Rechtskorrektur oben reicht dann nicht.
		const projectedLeftEdge = rect.left - (currentLeft - adjustedLeft);
		if (projectedLeftEdge < 0) {
			adjustedLeft -= projectedLeftEdge;
		}
		adjustedLeft = Math.round(adjustedLeft);
		if (adjustedLeft !== currentLeft) {
			panel.style.left = `${adjustedLeft}px`;
		}
	};

	let panelObs: MutationObserver | null = null;

	const watchPanel = () => {
		const panel = root.querySelector<HTMLElement>('.kol-popover-button__popover');
		if (!panel) {
			panelObs?.disconnect();
			panelObs = null;
			return;
		}
		if (panelObs) return; // Observer läuft bereits — unnötiges Recycling vermeiden
		correct();
		panelObs = new MutationObserver(correct);
		panelObs.observe(panel, { attributes: true, attributeFilter: ['style'] });
	};

	const rootObs = new MutationObserver(watchPanel);
	rootObs.observe(root, { childList: true, subtree: true });

	const onResize = () => requestAnimationFrame(correct);
	window.addEventListener('resize', onResize);

	return () => {
		rootObs.disconnect();
		panelObs?.disconnect();
		window.removeEventListener('resize', onResize);
	};
};

/**
 * Traversiert Shadow- und Light-DOM ab `el` nach unten und liefert das erste native `<button>`.
 * #361: Nach programmatischem `hidePopover()` gibt die native Popover-API den Fokus nicht an den
 * Invoker zurück (er wandert zu `document.body`). Wir fokussieren den inneren Button daher explizit,
 * damit das anschließend geöffnete Modal den korrekten Trigger für die Fokusrückgabe erfasst.
 *
 * #2723: geteilt mit dem Avatar-Menü im Kopfbereich (`App`) — Escape-Fokus-Rückkehr folgt demselben
 * Muster, deshalb liegt der Helper neben der Popover-Ausrichtung in diesem Modul.
 */
export const findInnerButton = (el: Element | null | undefined): HTMLElement | null => {
	if (el == null) return null;
	if (el instanceof HTMLButtonElement) return el;
	return findInnerButton(el.shadowRoot?.firstElementChild ?? el.firstElementChild);
};

/**
 * Verdrahtet `alignPopoverPanelLeft` mit einem `KolPopoverButton`-Ref. KoliBri-Custom-Elements werden
 * asynchron aufgewertet — beim schnellen Mount ist `shadowRoot` u. U. noch `null`, deshalb ggf. auf
 * die Custom-Element-Definition warten.
 *
 * `alignEnd` setzt die rechte Panel-Kante bündig unter die rechte Trigger-Kante (Avatar-Menü,
 * `_popoverAlign="bottom"`) und überlässt die Karten-Optik dem Panel-Inhalt.
 *
 * @returns Aufräumfunktion für den `useEffect`-Cleanup.
 */
export const setupPopoverAlignment = (host: HTMLKolPopoverButtonElement | null, alignEnd = false): (() => void) => {
	if (!host) return () => {};
	let cleanup: () => void = () => {};
	const setup = () => {
		cleanup = alignPopoverPanelLeft(host, alignEnd);
	};
	if (host.shadowRoot) {
		setup();
	} else {
		void customElements.whenDefined('kol-popover-button').then(() => {
			if (host.isConnected) setup();
		});
	}
	return () => cleanup();
};
