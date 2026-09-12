/**
 * #1336: `kol-tabs` (bis einschl. v4.4.1) exposes no CSS Parts or focus custom properties for its Shadow-DOM
 * tab buttons (KoliBri-Doku 4.4.0: nur Properties/Methoden, kein `::part`). Ohne eigenen Stil
 * zeigt der fokussierte Tab-Button nur den UA-Default-Ring (browserabhängige Farbe statt
 * `--pp-focus-ring`). Ein `CSSStyleSheet`, adoptiert im offenen Shadow-Root des `kol-tabs`-Hosts
 * (unpublizierte KoliBri-API, Muster `popoverAlign.ts` #1186), überschreibt das gezielt für
 * `.kol-tabs__button-group .kol-button` (der Tab-Button, siehe DOM-Sonde issue-1336). Ein einfaches
 * `<style>`-Element wird NICHT verwendet: `kol-tabs` lädt seine eigenen Sheets teils asynchron nach
 * dem Mount nach und hängt sie dabei HINTER unser Sheet — für `outline-offset` (layoutrelevant,
 * anders als `outline-color/-style/-width`) gewinnt dann kurzzeitig ein späteres KoliBri-Sheet
 * (empirisch: `outline-offset` blieb bei `0px` statt `2px`, bis sich die Reihenfolge stabilisierte).
 * `ensureFocusRingLast` wird deshalb bei jedem `focusin` im Shadow-Root erneut aufgerufen und
 * schiebt unser Sheet ans Ende der `adoptedStyleSheets`-Liste zurück, bevor der Browser malt.
 *
 * Der Ring wird über eine JS-verwaltete Klasse (`pp-focus-ring`) statt über `:focus-visible`
 * gesteuert: `kol-tabs` fokussiert den geklickten Tab-Button nach einem Klick selbst nochmal
 * programmatisch (roving Tabindex, `onSelect` → `focusTabById` → `button.focus()`). Chromium
 * bewertet diesen Re-Fokus als "nicht von einem Pointer-Event abgeleitet" und setzt
 * `:focus-visible` dafür — beobachtbar per `el.matches(':focus-visible')` — trotz vorausgegangenem
 * Mausklick fälschlich auf `true` (AK5 verlangt aber: kein Ring nach Mausklick). Ein reines
 * `:focus-visible`-Selektor-Rule würde AK5 daher strukturell nicht erfüllen können. Die eigene
 * Nachverfolgung vergleicht das `pointerdown`-Ziel mit dem `focusin`-Ziel: Stimmen beide überein
 * (Klick UND der resultierende Re-Fokus landen auf demselben Button), gilt der Fokus als
 * maus-ausgelöst und bleibt ringlos; alle anderen Fälle (Tastatur-Tab, `element.focus()` aus Tests
 * oder produktivem Code ohne vorausgehenden Klick) zeigen den Ring. Die zweite Regel
 * (`:focus-visible:not(.pp-focus-ring) { outline: none }`) unterdrückt zusätzlich den nativen
 * UA-/KoliBri-Default-Ring für genau den maus-ausgelösten Fall — ohne sie bliebe trotz fehlender
 * `pp-focus-ring`-Klasse der browsereigene Outline (andere Farbe/Breite) sichtbar, weil
 * `:focus-visible` selbst (s. o.) weiterhin `true` ist.
 *
 * Den Platz für den Ring (2px Breite + 2px Offset = 4px) schafft `padding-inline` an der
 * Button-Leiste IM Shadow-Root — der erste und der letzte Tab-Button liegen sonst flächenbündig an
 * der Kante des `kol-tabs`-Hosts und der Ring ragte dort über dessen Bounding-Box hinaus (AK2).
 * Nicht am Host (`.app-tabs`/`.settings-tabs`) reserviert, weil beide Wege dort scheitern:
 * `padding-inline` am Host verschiebt auch die Tabpanels — sie sind Light-DOM-Kinder
 * (`[slot="tabpanel-slot-N"]`) und liegen in dessen Content-Box, deren Insets `issue-969.spec.ts`
 * AK4 auf ±1px an die `.settings-page` bindet. Ein Full-Bleed (`margin-inline: -4px` +
 * `padding-inline: 4px`) wiederum macht den Host breiter als sein Elternelement: die
 * `.settings-page` (`overflow-x: hidden`) clippt die linken 4px des Rings und meldet rechts 4px
 * horizontalen Überlauf (`llm-settings.spec.ts`, „Mobile 375×812 ohne horizontalen Overflow").
 */
const FOCUS_RING_CLASS = 'pp-focus-ring';

/**
 * Das Element, das den Fokus trägt und damit den Ring malt.
 *
 * Seit `@public-ui/components` 4.4.1 rendert `kol-button` nach dem Skeleton-Muster: der
 * `.kol-button`-Knoten ist nur noch ein Wrapper (`<div>`), fokussiert wird das `<button>` darin.
 * Bis 4.4.0 war `.kol-button` selbst das fokussierbare Element — eine Regel darauf malte den Ring.
 * Steht die Regel nach dem Umbau weiter auf dem Wrapper, greift auf dem fokussierten `<button>`
 * KoliBris eigene `[tabindex]:focus`-Regel (3px, `--color-primary-variant`) statt `--pp-focus-ring`.
 */
const INTERACTIVE = '.kol-button__interactive-element';

const FOCUS_RING_CSS = `
.kol-tabs__button-group {
	padding-inline: 4px;
}
.kol-tabs__button-group .kol-button.${FOCUS_RING_CLASS} ${INTERACTIVE} {
	outline-color: var(--pp-focus-ring);
	outline-style: solid;
	outline-width: 2px;
	outline-offset: 2px;
	transition-property: none;
}
.kol-tabs__button-group .kol-button:not(.${FOCUS_RING_CLASS}) ${INTERACTIVE}:focus-visible {
	outline: none;
}
`;

let sheet: CSSStyleSheet | null = null;
const focusRingSheet = (): CSSStyleSheet => {
	if (!sheet) {
		sheet = new CSSStyleSheet();
		sheet.replaceSync(FOCUS_RING_CSS);
	}
	return sheet;
};

const ensureFocusRingLast = (root: ShadowRoot): void => {
	const ring = focusRingSheet();
	const current = root.adoptedStyleSheets;
	if (current[current.length - 1] === ring) return;
	root.adoptedStyleSheets = [...current.filter((s) => s !== ring), ring];
};

/** `kol-tabs` setzt `data-themed`, sobald sein eigenes (asynchron nachgeladenes) Theme-Sheet-Set
 * feststeht (Muster `waitForThemed` aus KoliBris `element-focus`-Modul). Vor diesem Zeitpunkt
 * ersetzt `kol-tabs` `adoptedStyleSheets` noch komplett — ein davor injiziertes Sheet geht dabei
 * verloren. */
const waitForThemed = (host: HTMLElement): Promise<void> => {
	if (host.hasAttribute('data-themed')) return Promise.resolve();
	return new Promise((resolve) => {
		const observer = new MutationObserver(() => {
			if (host.hasAttribute('data-themed')) {
				observer.disconnect();
				resolve();
			}
		});
		observer.observe(host, { attributes: true, attributeFilter: ['data-themed'] });
	});
};

const closestTabButton = (target: EventTarget | null): Element | null =>
	target instanceof Element ? target.closest('.kol-button') : null;

const wireFocusRingClass = (root: ShadowRoot): void => {
	let pointerDownTarget: Element | null = null;

	root.addEventListener(
		'pointerdown',
		(event) => {
			pointerDownTarget = closestTabButton(event.target);
		},
		{ capture: true },
	);

	root.addEventListener('focusin', (event) => {
		ensureFocusRingLast(root);
		const target = closestTabButton(event.target);
		if (!target) return;
		if (target === pointerDownTarget) {
			target.classList.remove(FOCUS_RING_CLASS);
		} else {
			target.classList.add(FOCUS_RING_CLASS);
		}
		pointerDownTarget = null;
	});

	root.addEventListener('focusout', (event) => {
		closestTabButton(event.target)?.classList.remove(FOCUS_RING_CLASS);
	});
};

/**
 * Verdrahtet `ensureFocusRingLast`/`wireFocusRingClass` mit einem `KolTabs`-Ref. KoliBri-Custom-
 * Elements werden asynchron aufgewertet — beim schnellen Mount ist `shadowRoot` u. U. noch `null`,
 * deshalb ggf. auf die Custom-Element-Definition warten (Muster `setupPopoverAlignment`).
 */
export const setupTabsFocusRing = (host: HTMLKolTabsElement | null): void => {
	if (!host) return;
	const setup = () => {
		const root = host.shadowRoot;
		if (!root) return;
		wireFocusRingClass(root);
		void waitForThemed(host).then(() => {
			if (host.isConnected) ensureFocusRingLast(root);
		});
	};
	if (host.shadowRoot) {
		setup();
	} else {
		void customElements.whenDefined('kol-tabs').then(() => {
			if (host.isConnected) setup();
		});
	}
};
