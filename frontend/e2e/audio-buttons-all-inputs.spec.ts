import { expect, test, type Page } from './fixtures';
import { waitForStableView, SPEECH_MOCK_INIT_SCRIPT, SPEECH_UNSUPPORTED_INIT_SCRIPT } from './helpers';

/**
 * Rote Spec-e2e für #264 — „Audio-Transkription bei allen Textareas und Text-Inputs ergänzen".
 *
 * Vertrag: Eine wiederverwendbare `AudioButton`-Komponente sitzt neben allen relevanten Eingabefeldern
 * und startet die Browser-Spracherkennung (`window.SpeechRecognition` bzw.
 * `window.webkitSpeechRecognition`). Erkannte Sprache wird als Text in das jeweils zugehörige Feld
 * geschrieben. Jeder Mic-Button trägt eine stabile `data-testid` (`mic-titel`, `mic-beschreibung`,
 * `mic-capture`). Betroffen sind:
 *  - TaskForm: Titel-Input (AK-1, NEU) und Beschreibungs-Textarea (AK-2, existiert bereits),
 *  - QuickCaptureModal: Schnellerfassungs-Textarea (AK-3, NEU).
 *
 * Feature-Detection (AK-4): Fehlt die Web Speech API, bleibt der Mikrofon-Button gerendert, ist aber
 * `disabled`. Kein Layout-Shift (AK-5), auch auf 375px-Viewport nutzbar (AK-6).
 *
 * **Mock der Web Speech API:** Da Playwright/Chromium keine echte Spracherkennung ausführt (und kein
 * Mikrofon vorhanden ist), wird die API über `page.addInitScript` VOR dem Laden der Seite durch ein
 * `MockSpeechRecognition` ersetzt (Init-Scripts aus `helpers.ts`, geteilt mit
 * `voice-transcription.spec.ts`).
 *
 * Die `AudioButton`-Komponente und ihre Einbindung folgen durch die Umsetzung; bis dahin sind die Tests
 * für Titel (AK-1), QuickCaptureModal (AK-3) und die `disabled`-Fälle (AK-4) rot.
 *
 * **Isolation:** Falls ein Test doch einen Task anlegt, räumt `afterEach` alle Tasks über die echte
 * API wieder ab (analog `voice-transcription.spec.ts`).
 */

declare global {
	interface Window {
		__speechRecognitionStarted?: boolean;
		__speechRecognitionStopped?: boolean;
		__fireSpeechResult?: (text: string) => void;
	}
}

test.describe('Audio-Transkription bei allen Inputs (#264)', () => {
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
	 * „Überspringen", sodass das reguläre Formular mit Titel + Beschreibungsfeld sichtbar ist.
	 */
	const openTaskForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await expect(page.getByLabel('Titel')).toBeVisible();
	};

	/** Öffnet den „Neuen Task anlegen"-Dialog und bleibt im Schnellerfassungs-Schritt (Capture). */
	const openQuickCapture = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByLabel('Beschreibe deinen Task')).toBeVisible();
	};

	/**
	 * Mikrofon-Button, adressiert über seine stabile `data-testid`. Robuster Vertrag als die frühere
	 * `.last()`-Container-Heuristik: bei Nesting-Änderungen bleibt der Locator eindeutig.
	 */
	const micButton = (page: Page, testId: 'mic-titel' | 'mic-beschreibung' | 'mic-capture') => page.getByTestId(testId);

	/** Alle Mikrofon-Buttons auf der Seite (per aria-label). */
	const anyMicButton = (page: Page) => page.getByRole('button', { name: /Mikrofon|Aufnahme|aufnehmen/i });

	test('AK1: TaskForm — Mikrofon-Button ist neben dem Titel-Input sichtbar', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await expect(page.getByLabel('Titel')).toBeVisible();
		await expect(micButton(page, 'mic-titel')).toBeVisible();
	});

	test('AK1: TaskForm — Klick auf Titel-Mic transkribiert Text in das Titel-Feld', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'mic-titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		await page.evaluate(() => window.__fireSpeechResult?.('Wichtige Aufgabe'));

		await expect(page.getByLabel('Titel')).toHaveValue('Wichtige Aufgabe');
	});

	test('AK1: TaskForm — zweiter Klick auf Titel-Mic stoppt die Erkennung', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Erster Klick: Aufnahme starten.
		await micButton(page, 'mic-titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'mic-titel')).toHaveAttribute('aria-pressed', 'true');

		// Zweiter Klick: Aufnahme stoppen.
		await micButton(page, 'mic-titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStopped === true)).toBe(true);
		await expect(micButton(page, 'mic-titel')).not.toHaveAttribute('aria-pressed', 'true');
	});

	test('AK2: TaskForm — Beschreibungs-Textarea hat weiterhin einen Mic-Button', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await expect(page.getByLabel('Beschreibung (optional)')).toBeVisible();
		const descMic = micButton(page, 'mic-beschreibung');
		await expect(descMic).toBeVisible();

		await descMic.click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		await page.evaluate(() => window.__fireSpeechResult?.('Details zur Aufgabe'));
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue(/Details zur Aufgabe/);
	});

	test('AK3: QuickCaptureModal — Mikrofon-Button ist im Capture-Schritt neben der Textarea sichtbar', async ({
		page,
	}) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		await expect(page.getByLabel('Beschreibe deinen Task')).toBeVisible();
		await expect(micButton(page, 'mic-capture')).toBeVisible();
	});

	test('AK3: QuickCaptureModal — nach __fireSpeechResult steht der Text im Textarea-Feld', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		await micButton(page, 'mic-capture').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		await page.evaluate(() => window.__fireSpeechResult?.('Einkaufen gehen'));

		await expect(page.getByLabel('Beschreibe deinen Task')).toHaveValue(/Einkaufen gehen/);
	});

	test('AK3: QuickCaptureModal — zweiter Klick auf Capture-Mic stoppt die Erkennung', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		// Erster Klick: Aufnahme starten.
		await micButton(page, 'mic-capture').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'mic-capture')).toHaveAttribute('aria-pressed', 'true');

		// Zweiter Klick: Aufnahme stoppen.
		await micButton(page, 'mic-capture').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStopped === true)).toBe(true);
		await expect(micButton(page, 'mic-capture')).not.toHaveAttribute('aria-pressed', 'true');
	});

	test('AK4: TaskForm Titel — Mic-Button ist disabled, wenn die Web Speech API fehlt', async ({ page }) => {
		await page.addInitScript(SPEECH_UNSUPPORTED_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const titleMic = micButton(page, 'mic-titel');
		await expect(titleMic).toBeVisible();
		await expect(titleMic).toBeDisabled();
	});

	test('AK4: TaskForm Beschreibungs-Textarea — Mic-Button ist disabled, wenn die Web Speech API fehlt', async ({
		page,
	}) => {
		await page.addInitScript(SPEECH_UNSUPPORTED_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const descMic = micButton(page, 'mic-beschreibung');
		await expect(descMic).toBeVisible();
		await expect(descMic).toBeDisabled();
	});

	test('AK4: QuickCaptureModal — Mic-Button ist disabled, wenn die Web Speech API fehlt', async ({ page }) => {
		await page.addInitScript(SPEECH_UNSUPPORTED_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		const captureMic = micButton(page, 'mic-capture');
		await expect(captureMic).toBeVisible();
		await expect(captureMic).toBeDisabled();
	});

	test('AK6: TaskForm Titel-Mic-Button ist auf 375px-Viewport sichtbar und im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const titleMic = micButton(page, 'mic-titel');
		await expect(titleMic).toBeVisible();
		await expect(titleMic).toBeInViewport();
	});

	test('AK5: keine JS-Fehler während des Titel-Transkriptions-Flows', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'mic-titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await page.evaluate(() => window.__fireSpeechResult?.('Fehlerfreier Titel'));
		await expect(page.getByLabel('Titel')).toHaveValue('Fehlerfreier Titel');

		// Es existiert mindestens ein Mic-Button (Titel + Beschreibung).
		expect(await anyMicButton(page).count()).toBeGreaterThan(0);
		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
	});
});
