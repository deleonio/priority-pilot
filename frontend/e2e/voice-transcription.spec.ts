import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #251 — „Audiotranskription für die Task-Erstellung" (Weg A: Browser Web Speech API).
 *
 * Vertrag: Im regulären Task-Formular sitzt neben der Textarea „Beschreibung (optional)" ein
 * Mikrofon-Button. Ein Klick startet die Browser-Spracherkennung (`window.SpeechRecognition` bzw.
 * `window.webkitSpeechRecognition`), ein zweiter Klick stoppt sie. Erkannte Sprache wird als Text in
 * das Beschreibungsfeld geschrieben. Kein Mistral, kein serverseitiges Fallback.
 *
 * **Mock der Web Speech API:** Da Playwright/Chromium keine echte Spracherkennung ausführt (und kein
 * Mikrofon vorhanden ist), wird die API über `page.addInitScript` VOR dem Laden der Seite durch ein
 * `MockSpeechRecognition` ersetzt. Das Mock legt Flags (`__speechRecognitionStarted`,
 * `__speechRecognitionStopped`) und einen Trigger (`__fireSpeechResult`) am `window` ab, sodass der
 * Test Start/Stopp beobachten und ein Erkennungsergebnis gezielt auslösen kann.
 *
 * Die UI-Komponente (Mic-Button + `useVoiceInput`-Anbindung) folgt durch die Umsetzung; bis dahin ist
 * diese Spec rot. Sie prüft ausschließlich das beobachtbare Soll-Verhalten, nicht die Implementierung.
 *
 * **Isolation:** Falls ein Test doch einen Task anlegt, räumt `afterEach` alle Tasks über die echte
 * API wieder ab (analog `quick-capture.spec.ts`).
 */

/**
 * Init-Script (als String, vor dem Seitenaufbau injiziert), das die Web Speech API mockt:
 *  1. `MockSpeechRecognition` mit `start()`, `stop()`, `abort()`, `onresult`, `onend`,
 *  2. Zuweisung an `window.SpeechRecognition` und `window.webkitSpeechRecognition`,
 *  3. Beobachtungs-Flags `window.__speechRecognitionStarted` / `window.__speechRecognitionStopped`,
 *  4. `window.__fireSpeechResult(text)`, um aus dem Test ein Erkennungsergebnis auszulösen.
 */
const SPEECH_MOCK_INIT_SCRIPT = `
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

declare global {
	interface Window {
		__speechRecognitionStarted?: boolean;
		__speechRecognitionStopped?: boolean;
		__fireSpeechResult?: (text: string) => void;
	}
}

test.describe('Audiotranskription für die Task-Erstellung (#251)', () => {
	/** Löscht alle aktuell vorhandenen Tasks über die echte API (Vite-Proxy → Backend). */
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/**
	 * Öffnet den „Neuen Task anlegen"-Dialog und überbrückt den Schnellerfassungs-Schritt (#236) via
	 * „Überspringen", sodass das reguläre Formular mit dem Beschreibungsfeld sichtbar ist.
	 */
	const openTaskForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await expect(page.getByLabel('Titel')).toBeVisible();
	};

	/** Der Mikrofon-Button — per aria-label (enthält „Mikrofon", „aufnehmen" oder „Aufnahme"). */
	const micButton = (page: Page) => page.getByRole('button', { name: /Mikrofon|aufnehmen|Aufnahme/i });

	test('AK1: Mikrofon-Button ist neben der Beschreibungs-Textarea sichtbar', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Neben der Beschreibungs-Textarea sitzt der Mic-Button.
		await expect(page.getByLabel('Beschreibung (optional)')).toBeVisible();
		await expect(micButton(page)).toBeVisible();
	});

	test('AK2: Klick auf den Mic-Button startet die Aufnahme (aria-pressed=true)', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page).click();

		// Die Browser-Spracherkennung wurde gestartet.
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		// Der Button signalisiert den Aufnahme-Zustand über aria-pressed.
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
	});

	test('AK3: nach __fireSpeechResult steht der Text im Beschreibungsfeld', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page).click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		// Erkennungsergebnis aus dem Test auslösen.
		await page.evaluate(() => window.__fireSpeechResult?.('Neue Aufgabe erledigen'));

		// Der transkribierte Text landet im Beschreibungsfeld.
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Neue Aufgabe erledigen');
	});

	test('AK4: zweiter Klick stoppt die Aufnahme (aria-pressed nicht mehr true)', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Erster Klick: Start.
		await micButton(page).click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');

		// Zweiter Klick: Stopp.
		await micButton(page).click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStopped === true)).toBe(true);
		await expect(micButton(page)).not.toHaveAttribute('aria-pressed', 'true');
	});

	test('AK5: keine JS-Fehler während des gesamten Aufnahme-Flows', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Kompletter Flow: Start → Ergebnis → Stopp.
		await micButton(page).click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		await page.evaluate(() => window.__fireSpeechResult?.('Testeingabe per Sprache'));
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Testeingabe per Sprache');

		await micButton(page).click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStopped === true)).toBe(true);

		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
	});

	test('AK6: Mic-Button ist auf 375px-Viewport sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Auch auf schmalem Mobil-Viewport ist der Mic-Button sichtbar und im Viewport.
		await expect(micButton(page)).toBeVisible();
		await expect(micButton(page)).toBeInViewport();
	});
});
