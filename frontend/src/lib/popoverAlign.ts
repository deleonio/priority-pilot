/**
 * #369/#380: Das Panel (`.kol-popover-button__popover`) liegt im offenen Shadow-DOM von
 * `kol-popover-button` und ist damit von außen per CSS nicht erreichbar (kein `::part`).
 * `_popoverAlign="left"` lässt floating-ui das Panel links neben dem Trigger platzieren.
 * Die CSS-Shrink-to-fit-Breite bemisst sich am verfügbaren Platz; `width: max-content`
 * erzwingt die inhaltsbasierte Breite (alle Aktionen in einer Zeile), unabhängig vom
 * verfügbaren Platz. Überschreitet das Panel den rechten Viewport-Rand, korrigiert
 * `correct()` `left` um den Überlauf (funktioniert, da KoliBri keinen MutationObserver
 * auf Panel-Style-Änderungen setzt — nur ResizeObserver/Scroll/Resize via autoUpdate).
 * Alle Shadow-DOM-Zugriffe sind unpublizierte KoliBri-API (@public-ui/react-v19 v4.2.1) —
 * bei KoliBri-Upgrades prüfen.
 *
 * Genutzt von den „…"-Menüs der Aufgabenliste (`TaskTree`) und vom Avatar-Menü im Kopfbereich
 * (`App`); deshalb liegt der Helper hier und nicht in einer der beiden Komponenten.
 *
 * Modul-privat: Einstiegspunkt für Komponenten ist {@link setupPopoverAlignment}, das zusätzlich das
 * asynchrone Custom-Element-Upgrade abwartet.
 *
 * @returns Aufräumfunktion, die alle Observer und Listener wieder abmeldet.
 */
const alignPopoverPanelLeft = (host: HTMLKolPopoverButtonElement): (() => void) => {
	const root = host.shadowRoot;
	if (!root) return () => {};

	const correct = () => {
		const panel = root.querySelector<HTMLElement>('.kol-popover-button__popover');
		if (!panel) return;
		if (panel.style.width !== 'max-content') {
			panel.style.width = 'max-content';
		}
		const rect = panel.getBoundingClientRect();
		if (rect.width === 0) return; // Panel versteckt (display:none) — DOM-Writes und Reflow sparen
		const overflow = Math.ceil(rect.right) - window.innerWidth;
		if (overflow > 0) {
			const newLeft = `${Math.round((parseFloat(panel.style.left) || 0) - overflow)}px`;
			if (panel.style.left !== newLeft) {
				panel.style.left = newLeft;
			}
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
 * Verdrahtet `alignPopoverPanelLeft` mit einem `KolPopoverButton`-Ref. KoliBri-Custom-Elements werden
 * asynchron aufgewertet — beim schnellen Mount ist `shadowRoot` u. U. noch `null`, deshalb ggf. auf
 * die Custom-Element-Definition warten.
 *
 * @returns Aufräumfunktion für den `useEffect`-Cleanup.
 */
export const setupPopoverAlignment = (host: HTMLKolPopoverButtonElement | null): (() => void) => {
	if (!host) return () => {};
	let cleanup: () => void = () => {};
	const setup = () => {
		cleanup = alignPopoverPanelLeft(host);
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
