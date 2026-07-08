import type { Page } from '@playwright/test';
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
		const button = document.querySelector('kol-button');
		// Ohne Buttons (z. B. theoretischer Sonderfall) gilt die Seite als hydriert.
		return button === null || button.shadowRoot !== null;
	});

	// 3. Fonts (inkl. KolIcons) abwarten, sonst flackern Icon-Glyphen / verschieben sich Layouts.
	await page.evaluate(() => document.fonts.ready);
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
