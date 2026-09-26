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
 * Modul-privat: Einstiegspunkt für Komponenten ist {@link setupPopoverAlignment}, das zusätzlich das
 * asynchrone Custom-Element-Upgrade abwartet.
 *
 * @returns Aufräumfunktion, die alle Observer und Listener wieder abmeldet.
 */
/** #1745: Zielabstand (px) zwischen letztem Aktions-Button und „…"-Trigger — wie der Icon-Abstand der Toolbar (#1623). */
const MORE_BUTTON_GAP_PX = 8;

/**
 * #1745: Native `<button>`s in (verschachtelten) Shadow-Roots suchen — `kol-toolbar` und der
 * `kol-button`-Trigger rendern ihre Buttons erst in der eigenen Shadow-Wurzel, ein flaches
 * `querySelector` reicht nicht. Gepierct wird nur der übergebene Subtree; in die Shadow-Wurzel
 * des Popover-Buttons geslottete Light-DOM-Kinder (die Toolbar) tauchen hier bewusst NICHT auf,
 * der erste Treffer ist daher der Trigger-Knopf.
 */
const pierceButtons = (root: ParentNode | null | undefined): HTMLButtonElement[] => {
	if (!root) return [];
	const buttons = Array.from(root.querySelectorAll('button'));
	for (const el of Array.from(root.querySelectorAll('*'))) {
		if (el.shadowRoot) buttons.push(...pierceButtons(el.shadowRoot));
	}
	return buttons;
};

/**
 * #1745 AK3: Rundung und Randstärke des „…"-Triggers an einen Aktions-Button der Toolbar angleichen
 * (gleiche JS-Direkt-Stil-Injektion wie im Rest des Moduls, unpublizierte KoliBri-API — bei
 * Upgrades prüfen). `getComputedStyle` liefert auch für das geschlossene (display:none) Panel Werte.
 */
const matchTriggerStyle = (popoverRoot: ShadowRoot, actionButton: HTMLButtonElement): void => {
	const trigger = pierceButtons(popoverRoot)[0];
	if (!trigger) return;
	const action = getComputedStyle(actionButton);
	if (trigger.style.borderRadius !== action.borderRadius) {
		trigger.style.borderRadius = action.borderRadius;
	}
	if (trigger.style.borderWidth !== action.borderWidth) {
		trigger.style.borderWidth = action.borderWidth;
	}
};

/**
 * #1745 AK2: Überstand des gemessenen Abstands (letzter Aktions-Button → Trigger) über den
 * 8px-Zielabstand — 0, wenn der Trigger (noch) nicht gerendert ist, das Panel rechts vom
 * Trigger liegt (negative Gaps nie verschieben) oder noch nicht an ihm verankert ist: Beim
 * Öffnen ist das Panel kurz sichtbar, bevor floating-ui die Position schreibt (left: 0) —
 * eine Korrektur dieses Zwischenstands würde das Panel samt Viewport-Clamp anschaufeln
 * und weit vom Trigger wegsperren.
 */
const MAX_ANCHORED_GAP_PX = 40;
const gapExcessBeforeMoreButton = (popoverRoot: ShadowRoot, actionButtons: HTMLButtonElement[]): number => {
	const trigger = pierceButtons(popoverRoot)[0];
	if (!trigger) return 0;
	const rightEdge = Math.max(...actionButtons.map((button) => button.getBoundingClientRect().right));
	const gap = trigger.getBoundingClientRect().left - rightEdge;
	return gap > 0 && gap <= MAX_ANCHORED_GAP_PX ? gap - MORE_BUTTON_GAP_PX : 0;
};

const alignPopoverPanelLeft = (host: HTMLKolPopoverButtonElement): (() => void) => {
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
		// #1745: Angleich nur für Popovers mit eingebetteter Toolbar (Task-Aktionen) — das
		// Avatar-Menü im Kopfbereich hat keine und bleibt unberührt. AK3 auch im geschlossenen
		// Zustand, daher vor dem Sichtbarkeits-Bailout.
		const actionButtons = pierceButtons(host.querySelector('kol-toolbar')?.shadowRoot);
		if (actionButtons.length > 0) {
			matchTriggerStyle(root, actionButtons[0]);
		}
		const rect = panel.getBoundingClientRect();
		if (rect.width === 0) return; // Panel versteckt (display:none) — DOM-Writes und Reflow sparen
		const currentLeft = parseFloat(panel.style.left) || 0;
		let adjustedLeft = currentLeft;
		const rightOverflow = Math.ceil(rect.right) - window.innerWidth;
		if (rightOverflow > 0) {
			adjustedLeft -= rightOverflow;
		}
		// #1745 AK2: Abstand letzter Aktions-Button → „…"-Trigger auf 8px bringen (Panel-Padding
		// + floating-ui-Offset liefern sonst ~10px); vor dem Left-Clamp, damit der Viewport-Schutz greift.
		if (actionButtons.length > 0) {
			const gapExcess = gapExcessBeforeMoreButton(root, actionButtons);
			if (Math.abs(gapExcess) > 0.5) {
				// Panel nach rechts schieben verkleinert den Abstand — Überschuss abbauen, nicht verdoppeln.
				adjustedLeft += Math.round(gapExcess);
			}
		}
		// #1623: der 8px-Toolbar-Gap verbreitert das Panel und kann es bei schmalen Viewports
		// (360px) über den linken Rand hinausschieben — die reine Rechtskorrektur oben reicht dann nicht.
		const projectedLeftEdge = rect.left - (currentLeft - adjustedLeft);
		if (projectedLeftEdge < 0) {
			adjustedLeft -= projectedLeftEdge;
		}
		if (adjustedLeft !== currentLeft) {
			panel.style.left = `${Math.round(adjustedLeft)}px`;
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

/**
 * #1623: `.kol-toolbar` (Shadow-DOM von `kol-toolbar`, @public-ui/react-v19 v4.5.0-rc.0) setzt
 * `display: flex` ohne `gap` — die sechs Aktions-Buttons im „…"-Popover berühren sich (0px
 * Abstand). Anders als das mitregistrierte KERN-Theme (`gap: var(--kern-metric-space-default)`)
 * kennt das aktiv genutzte Default-Theme keine themebare Variable dafür: kein CSS-Hebel von
 * außen, kein `::part`. Direkter Style-Write auf das interne Element, gleiches Muster wie
 * `alignPopoverPanelLeft` oben (unpublizierte KoliBri-API — bei Upgrades prüfen). Der Shadow-Root
 * existiert zwar sofort nach dem Custom-Element-Upgrade, sein Inhalt (`.kol-toolbar`) rendert
 * Stencil aber asynchron nach — ein `MutationObserver` fängt das Nachrendern ab, statt sich auf
 * einen synchronen Treffer direkt nach dem Mount zu verlassen.
 */
const setToolbarActionGap = (host: HTMLKolToolbarElement): void => {
	const root = host.shadowRoot;
	if (!root) return;

	const apply = (toolbar: HTMLElement): void => {
		if (toolbar.style.gap !== '8px') {
			toolbar.style.gap = '8px';
		}
	};

	const existing = root.querySelector<HTMLElement>('.kol-toolbar');
	if (existing) {
		apply(existing);
		return;
	}

	const observer = new MutationObserver(() => {
		const toolbar = root.querySelector<HTMLElement>('.kol-toolbar');
		if (toolbar) {
			apply(toolbar);
			observer.disconnect();
		}
	});
	observer.observe(root, { childList: true, subtree: true });
};

/**
 * Verdrahtet `setToolbarActionGap` mit einem `KolToolbar`-Ref (gleiches Async-Upgrade-Problem wie
 * {@link setupPopoverAlignment}).
 */
export const setupToolbarActionGap = (host: HTMLKolToolbarElement | null): void => {
	if (!host) return;
	if (host.shadowRoot) {
		setToolbarActionGap(host);
	} else {
		void customElements.whenDefined('kol-toolbar').then(() => {
			if (host.isConnected) setToolbarActionGap(host);
		});
	}
};
