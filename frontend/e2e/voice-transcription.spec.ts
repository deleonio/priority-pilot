import { expect, test, type Page } from './fixtures';
import { SPEECH_MOCK_INIT_SCRIPT, waitForStableView } from './helpers';

/**
 * e2e-Spec für #251 — „Audiotranskription für die Task-Erstellung" (Weg A: Browser Web Speech API) —
 * erweitert um #264: Mikrofon-Buttons an ALLEN Textareas und Text-Inputs, positioniert INNERHALB des
 * Feldes (Textarea: unten rechts, einzeiliger Input: rechts vertikal mittig).
 *
 * Vertrag: An jedem Freitext-Feld (TaskForm „Titel" + „Beschreibung (optional)", Schnellerfassung
 * „Beschreibe deinen Task", Serien-Formular „Titel") sitzt ein Mikrofon-Button als Overlay in der
 * Inputbox. Ein Klick startet die Browser-Spracherkennung (`window.SpeechRecognition` bzw.
 * `window.webkitSpeechRecognition`), ein zweiter Klick stoppt sie. Erkannte Sprache wird an den
 * Feldwert angehängt. Kein Mistral, kein serverseitiges Fallback. Da mehrere Mic-Buttons gleichzeitig
 * sichtbar sind, trägt jeder Button das Feld-Label im aria-label
 * (`Aufnahme starten (Mikrofon): <Feld>` / `Aufnahme stoppen: <Feld>`).
 *
 * **Mock der Web Speech API:** Da Playwright/Chromium keine echte Spracherkennung ausführt (und kein
 * Mikrofon vorhanden ist), wird die API über `page.addInitScript` VOR dem Laden der Seite durch ein
 * `MockSpeechRecognition` ersetzt. Das Mock legt Flags (`__speechRecognitionStarted`,
 * `__speechRecognitionStopped`) und einen Trigger (`__fireSpeechResult`) am `window` ab, sodass der
 * Test Start/Stopp beobachten und ein Erkennungsergebnis gezielt auslösen kann.
 *
 * **Isolation:** Falls ein Test doch einen Task anlegt, räumt `afterEach` alle Tasks über die echte
 * API wieder ab (analog `quick-capture.spec.ts`).
 */

declare global {
	interface Window {
		__speechRecognitionStarted?: boolean;
		__speechRecognitionStopped?: boolean;
		__fireSpeechResult?: (text: string, isFinal?: boolean) => void;
		__fireSpeechEnd?: () => void;
		__fireSpeechError?: (error: string) => void;
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
		// `getByRole('textbox', …)` statt `getByLabel`: Letzteres matcht per Substring auch die
		// Mic-Buttons (aria-label `Aufnahme starten (Mikrofon): Titel`, #264).
		await expect(titleInput(page)).toBeVisible();
	};

	/** Das Titel-Eingabefeld (native Inputbox im KoliBri-Shadow-DOM). */
	const titleInput = (page: Page) => page.getByRole('textbox', { name: 'Titel' });

	/**
	 * Der Mikrofon-Button eines konkreten Feldes — per aria-label mit Feld-Label (#264: mehrere
	 * Mic-Buttons gleichzeitig sichtbar). Der Regex überlebt den Label-Wechsel starten ↔ stoppen.
	 */
	const micButton = (page: Page, field: string) =>
		page.getByRole('button', {
			name: new RegExp(`^Aufnahme (starten \\(Mikrofon\\)|stoppen): ${field}$`),
		});

	test('AK1: Mikrofon-Button ist an der Beschreibungs-Textarea sichtbar', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// An der Beschreibungs-Textarea sitzt der Mic-Button (Position: eigener Test unter #264).
		await expect(page.getByLabel('Beschreibung (optional)')).toBeVisible();
		await expect(micButton(page, 'Beschreibung')).toBeVisible();
	});

	test('AK2: Klick auf den Mic-Button startet die Aufnahme (aria-pressed=true)', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'Beschreibung').click();

		// Die Browser-Spracherkennung wurde gestartet.
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		// Der Button signalisiert den Aufnahme-Zustand über aria-pressed.
		await expect(micButton(page, 'Beschreibung')).toHaveAttribute('aria-pressed', 'true');
	});

	test('AK3: nach __fireSpeechResult steht der Text im Beschreibungsfeld', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'Beschreibung').click();
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
		await micButton(page, 'Beschreibung').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'Beschreibung')).toHaveAttribute('aria-pressed', 'true');

		// Zweiter Klick: Stopp.
		await micButton(page, 'Beschreibung').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStopped === true)).toBe(true);
		await expect(micButton(page, 'Beschreibung')).not.toHaveAttribute('aria-pressed', 'true');
	});

	test('AK5: keine JS-Fehler während des gesamten Aufnahme-Flows', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Kompletter Flow: Start → Ergebnis → Stopp.
		await micButton(page, 'Beschreibung').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		await page.evaluate(() => window.__fireSpeechResult?.('Testeingabe per Sprache'));
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Testeingabe per Sprache');

		await micButton(page, 'Beschreibung').click();
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
		await expect(micButton(page, 'Beschreibung')).toBeVisible();
		await expect(micButton(page, 'Beschreibung')).toBeInViewport();
	});

	// --- #264: Mic-Buttons an allen Textfeldern, Position INNERHALB des Feldes ---

	test('AK7 (#264): Transkript landet im Titel-Feld und wird mit Leerzeichen angehängt', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Erstes Erkennungsergebnis: Text landet im Titel-Feld.
		await micButton(page, 'Titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await page.evaluate(() => window.__fireSpeechResult?.('Einkauf planen'));
		await expect(titleInput(page)).toHaveValue('Einkauf planen');

		// Zweites Ergebnis: wird mit Leerzeichen an den Bestandswert angehängt.
		await micButton(page, 'Titel').click();
		await micButton(page, 'Titel').click();
		await page.evaluate(() => window.__fireSpeechResult?.('für Samstag'));
		await expect(titleInput(page)).toHaveValue('Einkauf planen für Samstag');
	});

	test('AK8 (#264): Schnellerfassung — Transkript sichtbar und „Verarbeiten und weiter" aktiv', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		// Nur den Capture-Schritt öffnen (NICHT überspringen).
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		const cta = page.getByRole('button', { name: 'Verarbeiten und weiter' });
		await expect(cta).toBeDisabled();

		await micButton(page, 'Beschreibe deinen Task').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await page.evaluate(() => window.__fireSpeechResult?.('Morgen Zahnarzttermin vereinbaren'));

		// Das Transkript steht im Feld UND aktiviert den primären CTA (reine Sprach-Eingabe).
		await expect(page.getByRole('textbox', { name: 'Beschreibe deinen Task' })).toHaveValue(
			'Morgen Zahnarzttermin vereinbaren',
		);
		await expect(cta).toBeEnabled();
	});

	test('AK9 (#264): Mic-Button liegt INNERHALB der Beschreibungs-Textarea, unten rechts', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const buttonBox = await micButton(page, 'Beschreibung').boundingBox();
		// `getByLabel` liefert die native textarea im Shadow DOM — also die sichtbare Inputbox.
		const fieldBox = await page.getByLabel('Beschreibung (optional)').boundingBox();
		expect(buttonBox).not.toBeNull();
		expect(fieldBox).not.toBeNull();
		if (buttonBox === null || fieldBox === null) return;

		// Vollständig innerhalb der Inputbox …
		expect(buttonBox.x).toBeGreaterThanOrEqual(fieldBox.x);
		expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width + 1);
		expect(buttonBox.y).toBeGreaterThanOrEqual(fieldBox.y);
		expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(fieldBox.y + fieldBox.height + 1);
		// … und dort rechtsbündig unten (±2px Toleranz auf den 0.5rem-Abstand).
		expect(buttonBox.x + buttonBox.width).toBeGreaterThanOrEqual(fieldBox.x + fieldBox.width - 10);
		expect(buttonBox.y + buttonBox.height).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height - 10);
	});

	test('AK10 (#264): Mic-Button liegt INNERHALB des Titel-Inputs, rechts vertikal mittig', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const buttonBox = await micButton(page, 'Titel').boundingBox();
		const fieldBox = await titleInput(page).boundingBox();
		expect(buttonBox).not.toBeNull();
		expect(fieldBox).not.toBeNull();
		if (buttonBox === null || fieldBox === null) return;

		// Vollständig innerhalb der Inputbox, rechtsbündig …
		expect(buttonBox.x).toBeGreaterThanOrEqual(fieldBox.x);
		expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width + 1);
		expect(buttonBox.y).toBeGreaterThanOrEqual(fieldBox.y - 1);
		expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(fieldBox.y + fieldBox.height + 1);
		expect(buttonBox.x + buttonBox.width).toBeGreaterThanOrEqual(fieldBox.x + fieldBox.width - 10);
		// … und vertikal mittig (Button-Mitte ≈ Feld-Mitte, ±4px Toleranz).
		const buttonCenter = buttonBox.y + buttonBox.height / 2;
		const fieldCenter = fieldBox.y + fieldBox.height / 2;
		expect(Math.abs(buttonCenter - fieldCenter)).toBeLessThanOrEqual(4);
	});

	test('AK11 (#264): Start am zweiten Feld beendet die laufende Aufnahme des ersten ohne Fehlertext', async ({
		page,
	}) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Aufnahme am Titel starten …
		await micButton(page, 'Titel').click();
		await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'true');

		// … dann direkt den Mic der Beschreibung klicken: „last click wins".
		await micButton(page, 'Beschreibung').click();
		await expect(micButton(page, 'Beschreibung')).toHaveAttribute('aria-pressed', 'true');
		await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'false');
		// Kein Fehlertext — der Wechsel ist kein Fehlerfall.
		await expect(page.locator('.mic-error')).toHaveCount(0);
	});

	test('AK12 (#264): beide Mic-Buttons des Task-Formulars sind auf 375px-Viewport im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await expect(micButton(page, 'Titel')).toBeVisible();
		await expect(micButton(page, 'Titel')).toBeInViewport();
		await expect(micButton(page, 'Beschreibung')).toBeVisible();
		await expect(micButton(page, 'Beschreibung')).toBeInViewport();
	});

	test('AK13 (#264): Serien-Formular — Transkript landet im Titel-Feld', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		// Serien-Formular über QuickCapture-Flow öffnen und auf Serie-Modus umschalten.
		await openTaskForm(page);
		await page.getByTestId('mode-switch').getByRole('checkbox').click();
		await waitForStableView(page);

		await micButton(page, 'Titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await page.evaluate(() => window.__fireSpeechResult?.('Wöchentlicher Wochenputz'));

		await expect(titleInput(page)).toHaveValue('Wöchentlicher Wochenputz');
	});

	// --- #283: Stabilität der Audio-Texterfassung — kein stiller Ausfall, kein verlorener Text ---

	test('AK14 (#283): endet die Erkennung ohne Ergebnis, erscheint der Hinweis „Nichts erkannt"', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'Beschreibung').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		// Die Engine endet (z. B. Stille/zu leise), OHNE dass je ein onresult kam — genau der in
		// #283 beschriebene Fall „Button aus, nichts eingefügt".
		await page.evaluate(() => window.__fireSpeechEnd?.());

		// Der Nutzer bleibt nicht im Unklaren: Hinweis sichtbar, Aufnahme sauber beendet.
		await expect(page.locator('.mic-error')).toHaveText('Nichts erkannt – bitte erneut sprechen.');
		await expect(micButton(page, 'Beschreibung')).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('');
	});

	test('AK15 (#283): ein Zwischenergebnis geht beim Engine-Ende ohne Finale nicht verloren', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'Beschreibung').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		// Nur ein Zwischenergebnis (isFinal=false) kommt an, dann bricht die Engine vor dem Finale ab.
		await page.evaluate(() => window.__fireSpeechResult?.('Zahnarzttermin vereinbaren', false));
		await page.evaluate(() => window.__fireSpeechEnd?.());

		// Der zuletzt erkannte Text wird übernommen statt verworfen — und es gibt keinen Fehlertext.
		await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue('Zahnarzttermin vereinbaren');
		await expect(page.locator('.mic-error')).toHaveCount(0);
	});

	test('AK16 (#283): dreimal nacheinander Start → Ergebnis → jeder Text landet im Titel-Feld', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Wiederholte Aufnahmen bleiben stabil — kein Durchgang fällt aus (#283: „sporadisch wird
		// nichts eingefügt"). Pro Runde: Start abwarten, Ergebnis feuern, Aufnahme stoppen.
		const texte = ['Einkauf planen', 'für Samstag', 'mit Einkaufszettel'];
		for (const text of texte) {
			await micButton(page, 'Titel').click();
			await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'true');
			await page.evaluate((t) => window.__fireSpeechResult?.(t), text);
			await micButton(page, 'Titel').click();
			await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'false');
		}

		await expect(titleInput(page)).toHaveValue('Einkauf planen für Samstag mit Einkaufszettel');
	});

	test('AK17 (#283): onerror "no-speech" zeigt den Hinweis statt der generischen Fehlermeldung', async ({ page }) => {
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'Titel').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);

		await page.evaluate(() => window.__fireSpeechError?.('no-speech'));

		await expect(page.locator('.mic-error')).toHaveText('Nichts erkannt – bitte erneut sprechen.');
		await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'false');
	});

	test('AK18 (#283): der „Nichts erkannt"-Hinweis ist auf 375px sichtbar, ohne horizontales Scrollen', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(SPEECH_MOCK_INIT_SCRIPT);
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		await micButton(page, 'Beschreibung').click();
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await page.evaluate(() => window.__fireSpeechEnd?.());

		await expect(page.locator('.mic-error')).toBeVisible();
		const overflowsHorizontally = await page.evaluate(() => {
			return document.body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});
