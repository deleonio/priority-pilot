import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wartet, bis die Ansicht stabil und vollständig hydriert ist, bevor mit ihr interagiert wird:
 *  1. ein bekanntes, stabiles Element ist sichtbar (Standard: sr-only H1 „Dashboard"),
 *  2. die KoliBri-Web-Components sind hydriert (asynchrone Registrierung in `main.tsx`),
 *  3. die Schriftarten — inkl. KolIcons-Font — sind geladen (`document.fonts.ready`).
 *
 * Generischer, mock-freier Helfer: wird von den funktionalen CRUD-Specs (`crud.spec.ts`) genutzt, um
 * Klicks/Assertions erst nach abgeschlossenem React-Mount + KoliBri-Upgrade abzusetzen.
 */
export const waitForStableView = async (page: Page, readyText = 'Dashboard'): Promise<void> => {
	// 1. Stabiles Element abwarten (rendert erst nach React-Mount + KoliBri-Upgrade sichtbar).
	await expect(page.getByText(readyText, { exact: true }).first()).toBeVisible();

	// 2. Auf das Upgrade der KoliBri-Custom-Elements warten: ein definiertes Element (`kol-button`)
	//    muss registriert sein und sein Shadow-DOM aufgebaut haben. Solange noch ein nicht-aufgelöstes
	//    Custom-Element existiert (`:not(:defined)`), ist die Hydration nicht abgeschlossen.
	await page.waitForFunction(() => {
		const pending = document.querySelectorAll(':not(:defined)');
		if (pending.length > 0) {
			return false;
		}
		// #1320: `kol-tabs` hängt seine Panel-Inhalte erst beim Aufbau des Shadow-DOM in die
		// internen Slots (es schreibt dazu `slot="tab-N"` auf `tabpanel-slot-N` um). Bis dahin
		// sind die Panel-Kinder keinem Slot zugewiesen, also ohne Layout: `boundingBox()` liefert
		// `null`, `getComputedStyle()` leere Werte. Der Ready-Marker aus Schritt 1 kann früher
		// stehen als diese Zuweisung — jede Messung direkt danach liefe sonst ins Leere.
		const unslottedPanel = Array.from(document.querySelectorAll('kol-tabs')).some((host) =>
			Array.from(host.children).some((child) => child.assignedSlot === null),
		);
		if (unslottedPanel) {
			return false;
		}
		const button = document.querySelector('kol-button');
		// Ohne Buttons (z. B. theoretischer Sonderfall) gilt die Seite als hydriert.
		return button === null || button.shadowRoot !== null;
	});

	// 3. Fonts (inkl. KolIcons) abwarten, sonst flackern Icon-Glyphen / verschieben sich Layouts.
	await page.evaluate(() => document.fonts.ready);
};

/**
 * Liefert eine Kopf-Aktion („Neuen Task anlegen", „Säulen-Berater", „Einstellungen", „Hilfe",
 * „Abmelden"). Seit #691 stehen alle fünf Aktionen auf JEDER Viewport-Breite direkt in der Toolbar
 * „Kopf-Aktionen" — ein Menü-Fallback existiert nicht mehr.
 *
 * Das `toBeVisible` wartet zugleich das asynchrone Layout der KoliBri-Toolbar ab (Items werden im
 * Shadow-DOM aufgebaut), damit nachfolgende Messungen nicht in den Pre-Hydration-Zustand laufen.
 */
export const headerAction = async (page: Page, label: string | RegExp): Promise<Locator> => {
	const inToolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: label });
	await expect(inToolbar).toBeVisible();
	return inToolbar;
};

/**
 * Öffnet einen zugeklappten KolAccordion-Abschnitt über seine Überschrift — der Trigger-Button
 * trägt das Label. `exact: true`, damit z. B. „Füreinander angelegt“ nicht den Abschnitt „…
 * angelegte Serien“ mittrifft (Substring-Match).
 *
 * Idempotent: der Trigger (kol-button-wc im Shadow-DOM) trägt `aria-expanded`; nur bei `false`
 * wird geklickt — ein schon offener Abschnitt (#1260: TaskForm startet im Edit mit gefüllten
 * Werten aufgeklappt) wird nicht zugklappt.
 */
export const openAccordionSection = async (page: Page, label: string): Promise<void> => {
	const trigger = page.getByRole('button', { name: label, exact: true });
	if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		// Öffnungs-Animation abwarten (KolAccordion: grid-template-rows 0.3s), bevor der Aufrufer
		// weitermisst — sonst landen Bounding-Box-Assertions in der laufenden Expansion
		// (#1072-AK4-/#1159-AK5-Flakes).
		// `.last()`: seit dem Design-Lauf 2026-09 können Accordions verschachtelt sein (z. B. die
		// Gruppen-Karte umschließt „Mitglieder einladen") — der Filter matcht dann auch das äußere
		// Accordion als Vorfahren des Triggers. Im Dokument-Quelltext steht der Vorfahre vor dem
		// Nachfahren, `.last()` trifft daher zuverlässig das unmittelbar umschließende Accordion.
		await waitForStableBox(page, page.locator('kol-accordion').filter({ has: trigger }).last());
	}
};

/**
 * Wartet, bis die Bounding-Box eines Elements stabil ist (Y-Position und Höhe über zwei
 * Messungen im 100-ms-Abstand unverändert): Öffnungs-Animationen (KolAccordion,
 * grid-template-rows 0.3s) und asynchron settlende KoliBri-Elemente (Counter-Zeile, Input-Höhe
 * nach Font-Load) schieben sonst in laufende Messungen hinein (#1051-F1-Flake, beide Richtungen).
 * Mindestabstand 300 ms vor dem ersten Sample: unter Last startet die Transition verzögert —
 * zwei vorgleichende Reads vor dem Start wären „falsch stabil" (#1159-AK5 im Volllauf).
 */
export const waitForStableBox = async (page: Page, locator: Locator, maxTries = 9): Promise<void> => {
	await page.waitForTimeout(300);
	let previous = await locator.boundingBox();
	for (let remaining = maxTries; remaining > 0; remaining--) {
		await page.waitForTimeout(100);
		const current = await locator.boundingBox();
		if (
			previous &&
			current &&
			Math.abs(current.y - previous.y) < 0.5 &&
			Math.abs(current.height - previous.height) < 0.5
		) {
			break;
		}
		previous = current;
	}
};

/**
 * Misst im Seitenkontext (`locator.evaluate(measureHorizontalScroll)`), ob innerhalb eines
 * Elements — einschließlich aller offenen Shadow-Roots — ein horizontal scrollbarer Container mit
 * echtem Überlauf existiert (`overflow-x: auto|scroll` und `scrollWidth > clientWidth`).
 *
 * #1258: Negativ-Vertrag „kein horizontales Scrollen bei 375px, auch nicht innerhalb der
 * Erledigt-Tabelle". `body.scrollWidth` ist dafür unbrauchbar (die App-Shell clippt mit
 * `overflow-x: hidden`, der Wert wäre strukturell grün) — hier wird der tatsächliche Scroll-
 * Container im KoliBri-Shadow-DOM gesucht. Start im eigenen Shadow-Root des Elements, weil
 * KolTableStateful ohne Light-DOM-Kinder verwendet wird. Bewusst schließungs-frei, damit
 * Playwright die Funktion serialisieren kann; rekursive Durchquerung ausschließlich lesend
 * (keine internen Klassen-/Tag-Selektoren, #824-Guard).
 */
export const measureHorizontalScroll = (
	el: HTMLElement,
): { scroller: { scrollWidth: number; clientWidth: number } | null } => {
	const scan = (root: ParentNode): { scrollWidth: number; clientWidth: number } | null => {
		for (const node of Array.from(root.querySelectorAll('*'))) {
			if (node instanceof HTMLElement) {
				const overflowX = getComputedStyle(node).overflowX;
				if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) {
					return { scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
				}
				const shadow = node.shadowRoot;
				if (shadow) {
					const hit = scan(shadow);
					if (hit) return hit;
				}
			}
		}
		return null;
	};
	return { scroller: scan(el.shadowRoot ?? el) };
};

/**
 * Init-Script (als String, vor dem Seitenaufbau injiziert), das die Web Speech API mockt:
 *  1. `MockSpeechRecognition` mit `start()`, `stop()`, `abort()`, `onstart`, `onresult`, `onend`,
 *  2. Zuweisung an `window.SpeechRecognition` und `window.webkitSpeechRecognition`,
 *  3. Beobachtungs-Flags `window.__speechRecognitionStarted` / `window.__speechRecognitionStopped`,
 *  4. `window.__fireSpeechResult(text, isFinal?)`, um ein Erkennungsergebnis auszulösen,
 *  5. `window.__fireSpeechEnd()` / `window.__fireSpeechError(error)`, um ein Engine-Ende ohne
 *     Ergebnis bzw. einen Erkennungsfehler auszulösen.
 */
export const SPEECH_MOCK_INIT_SCRIPT = `
	(() => {
		window.__speechRecognitionStarted = false;
		window.__speechRecognitionStopped = false;
		let activeInstance = null;

		class MockSpeechRecognition {
			constructor() {
				this.lang = '';
				this.continuous = false;
				this.interimResults = false;
				this.onstart = null;
				this.onresult = null;
				this.onend = null;
				this.onerror = null;
				activeInstance = this;
			}
			start() {
				window.__speechRecognitionStarted = true;
				activeInstance = this;
				setTimeout(() => {
					if (typeof this.onstart === 'function') {
						this.onstart();
					}
				}, 0);
			}
			stop() {
				window.__speechRecognitionStopped = true;
				setTimeout(() => {
					if (typeof this.onend === 'function') {
						this.onend();
					}
				}, 0);
			}
			abort() {
				setTimeout(() => {
					if (typeof this.onerror === 'function') {
						this.onerror({ error: 'aborted' });
					}
					if (typeof this.onend === 'function') {
						this.onend();
					}
				}, 0);
			}
		}

		window.SpeechRecognition = MockSpeechRecognition;
		window.webkitSpeechRecognition = MockSpeechRecognition;

		window.__fireSpeechResult = (text, isFinal) => {
			if (activeInstance && typeof activeInstance.onresult === 'function') {
				activeInstance.onresult({
					resultIndex: 0,
					results: { 0: { 0: { transcript: text }, isFinal: isFinal !== false }, length: 1 },
				});
			}
		};
		window.__fireSpeechEnd = () => {
			if (activeInstance && typeof activeInstance.onend === 'function') {
				activeInstance.onend();
			}
		};
		window.__fireSpeechError = (error) => {
			if (activeInstance && typeof activeInstance.onerror === 'function') {
				activeInstance.onerror({ error });
			}
		};
	})();
`;
