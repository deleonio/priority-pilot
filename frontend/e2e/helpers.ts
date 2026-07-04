import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Wartet, bis die Ansicht stabil und vollständig hydriert ist, bevor mit ihr interagiert wird:
 *  1. ein bekanntes, stabiles Element ist sichtbar (Standard: KolHeading „Priority Pilot"),
 *  2. die KoliBri-Web-Components sind hydriert (asynchrone Registrierung in `main.tsx`),
 *  3. die Schriftarten — inkl. KolIcons-Font — sind geladen (`document.fonts.ready`).
 *
 * Generischer, mock-freier Helfer: wird von den funktionalen CRUD-Specs (`crud.spec.ts`) genutzt, um
 * Klicks/Assertions erst nach abgeschlossenem React-Mount + KoliBri-Upgrade abzusetzen.
 */
export const waitForStableView = async (page: Page, readyText = 'Priority Pilot'): Promise<void> => {
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
		const button = document.querySelector('kol-button');
		// Ohne Buttons (z. B. theoretischer Sonderfall) gilt die Seite als hydriert.
		return button === null || button.shadowRoot !== null;
	});

	// 3. Fonts (inkl. KolIcons) abwarten, sonst flackern Icon-Glyphen / verschieben sich Layouts.
	await page.evaluate(() => document.fonts.ready);
};

/**
 * Init-Script, das die Web Speech API mockt (vor dem Seitenaufbau injiziert via `page.addInitScript`).
 * Exportiert für Wiederverwendung in mehreren Spec-Dateien.
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
				this.onresult = null;
				this.onend = null;
				this.onerror = null;
				activeInstance = this;
			}
			start() {
				window.__speechRecognitionStarted = true;
				activeInstance = this;
			}
			stop() {
				window.__speechRecognitionStopped = true;
				if (typeof this.onend === 'function') {
					this.onend();
				}
			}
			abort() {
				if (typeof this.onend === 'function') {
					this.onend();
				}
			}
		}

		window.SpeechRecognition = MockSpeechRecognition;
		window.webkitSpeechRecognition = MockSpeechRecognition;

		window.__fireSpeechResult = (text) => {
			if (activeInstance && typeof activeInstance.onresult === 'function') {
				activeInstance.onresult({
					resultIndex: 0,
					results: { 0: { 0: { transcript: text } }, length: 1 },
				});
			}
		};
	})();
`;

/**
 * Init-Script, das die Web Speech API explizit entfernt (für AK-4 disabled-Tests).
 * Exportiert für Wiederverwendung in mehreren Spec-Dateien.
 */
export const SPEECH_UNSUPPORTED_INIT_SCRIPT = `
	(() => {
		try { delete window.SpeechRecognition; } catch (_e) { window.SpeechRecognition = undefined; }
		try { delete window.webkitSpeechRecognition; } catch (_e) { window.webkitSpeechRecognition = undefined; }
		Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
		Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
	})();
`;
