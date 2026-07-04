import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #272 — „Allgemein-Einstellung: Auto-Sprachaufnahme im ersten Eingabefeld
 * (Schalter)" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Der Allgemein-Tab (aus #271) erhält einen Schalter „Sprachaufnahme automatisch starten"
 * (Default: aus). Ist er an, wird beim Öffnen von TaskForm und SeriesFormModal das erste
 * Titel-VoiceField fokussiert und sein Mikrofon automatisch gestartet.
 *
 * Beim Einschalten wird die Mikrofon-Berechtigung via getUserMedia angefordert:
 * - erteilt → Einstellung aktiviert + gespeichert
 * - verweigert → Einstellung bleibt aus, Hinweis sichtbar
 *
 * Alle Mocks laufen über page.addInitScript (vor dem Seitenaufbau) und page.route
 * (für den localStorage-Zustand via voiceAutostart STORAGE_KEY „pp-voice-autostart").
 */

/** Storage-Key für die Voice-Autostart-Einstellung (muss mit voiceAutostart.ts übereinstimmen). */
const VOICE_AUTOSTART_KEY = 'pp-voice-autostart';

/**
 * Init-Script das die Web Speech API mockt (analog voice-transcription.spec.ts) und zusätzlich
 * `navigator.mediaDevices.getUserMedia` für die Berechtigungsanforderung mockt.
 */
const buildInitScript = (opts: {
	speechSupported: boolean;
	mediaPermission: 'granted' | 'denied' | 'prompt';
}) => `
	(() => {
		window.__speechRecognitionStarted = false;
		window.__speechRecognitionStopped = false;
		window.__getUserMediaCalled = false;
		let activeInstance = null;

		${
			opts.speechSupported
				? `
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
		`
				: `
		delete window.SpeechRecognition;
		delete window.webkitSpeechRecognition;
		`
		}

		window.__fireSpeechResult = (text) => {
			if (activeInstance && typeof activeInstance.onresult === 'function') {
				activeInstance.onresult({
					resultIndex: 0,
					results: { 0: { 0: { transcript: text } }, length: 1 },
				});
			}
		};

		// Mock navigator.mediaDevices.getUserMedia
		const permission = ${JSON.stringify(opts.mediaPermission)};
		if (!navigator.mediaDevices) {
			Object.defineProperty(navigator, 'mediaDevices', {
				value: {},
				writable: true,
				configurable: true,
			});
		}
		navigator.mediaDevices.getUserMedia = async (constraints) => {
			window.__getUserMediaCalled = true;
			if (permission === 'granted') {
				return {
					getTracks: () => [],
					getAudioTracks: () => [],
				};
			} else {
				throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
			}
		};
	})();
`;

declare global {
	interface Window {
		__speechRecognitionStarted?: boolean;
		__speechRecognitionStopped?: boolean;
		__getUserMediaCalled?: boolean;
		__fireSpeechResult?: (text: string) => void;
	}
}

/** Setzt den localStorage-Eintrag für den Voice-Autostart BEVOR die Seite navigiert. */
const setVoiceAutostartInStorage = async (page: Page, value: boolean): Promise<void> => {
	await page.addInitScript(
		({ key, val }) => {
			localStorage.setItem(key, String(val));
		},
		{ key: VOICE_AUTOSTART_KEY, val: value },
	);
};

/** Öffnet das Task-Formular (überspringt QuickCapture). */
const openTaskForm = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
	await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
};

/** Mic-Button eines bestimmten Feldes. */
const micButton = (page: Page, field: string) =>
	page.getByRole('button', {
		name: new RegExp(`^Aufnahme (starten \\(Mikrofon\\)|stoppen): ${field}$`),
	});

/** Löscht alle Tasks über die API (Cleanup). */
const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('#272 Allgemein-Einstellung: Auto-Sprachaufnahme im ersten Eingabefeld', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/**
	 * AK2 — Default aus: Kein localStorage-Eintrag → Schalter ist aus, kein Formular startet
	 * automatisch eine Aufnahme.
	 */
	test('AK2: Schalter ist ohne localStorage-Eintrag standardmäßig aus (Default false)', async ({ page }) => {
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/settings/general');
		await waitForStableView(page);

		// Der Schalter im Allgemein-Tab muss sichtbar und aus sein.
		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));
		await expect(toggle).toBeVisible();
		await expect(toggle).not.toBeChecked();
	});

	test('AK2b: Ohne Einstellung startet TaskForm keine automatische Aufnahme', async ({ page }) => {
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Nach Öffnen des Formulars ist keine Aufnahme gestartet.
		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);

		// Titel-Mic-Button ist nicht gedrückt (aria-pressed=false oder nicht gesetzt).
		await expect(micButton(page, 'Titel')).not.toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK3 — Berechtigung beim Aktivieren:
	 * - erteilt → Einstellung an + gespeichert
	 * - verweigert → Einstellung bleibt aus, Hinweis sichtbar
	 */
	test('AK3a: Einschalten + Berechtigung erteilt → Schalter an und Einstellung gespeichert', async ({ page }) => {
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/settings/general');
		await waitForStableView(page);

		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));

		// Schalter einschalten.
		await toggle.click();

		// getUserMedia wurde aufgerufen (Berechtigung angefordert).
		await expect.poll(() => page.evaluate(() => window.__getUserMediaCalled === true)).toBe(true);

		// Schalter ist jetzt an.
		await expect(toggle).toBeChecked();

		// Wert ist in localStorage gespeichert.
		const stored = await page.evaluate(
			(key) => localStorage.getItem(key),
			VOICE_AUTOSTART_KEY,
		);
		expect(stored).toBe('true');
	});

	test('AK3b: Einschalten + Berechtigung verweigert → Schalter bleibt aus und Hinweis sichtbar', async ({
		page,
	}) => {
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'denied' }));
		await page.goto('/settings/general');
		await waitForStableView(page);

		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));

		await toggle.click();

		// getUserMedia wurde aufgerufen.
		await expect.poll(() => page.evaluate(() => window.__getUserMediaCalled === true)).toBe(true);

		// Schalter bleibt aus (Berechtigung verweigert → Einstellung nicht gespeichert).
		await expect(toggle).not.toBeChecked();

		// Ein Hinweis ist sichtbar (z. B. KolAlert oder anderes Feedback-Element).
		const hint = page.locator('[class*="alert"], kol-alert, [role="alert"]').first();
		await expect(hint).toBeVisible();
	});

	/**
	 * AK1 — Persistenz: Einstellung wird nach Reload korrekt wiederhergestellt.
	 */
	test('AK1: Einstellung bleibt nach Seiten-Reload erhalten (localStorage-Persistenz)', async ({ page }) => {
		// Vor dem Laden true in localStorage setzen (simuliert vorherige Aktivierung).
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/settings/general');
		await waitForStableView(page);

		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));

		// Schalter muss nach Reload an sein.
		await expect(toggle).toBeChecked();
	});

	/**
	 * AK4 — Auto-Start Task-Formular: Einstellung an + Berechtigung → Aufnahme startet automatisch
	 * beim Öffnen des TaskForm.
	 */
	test('AK4: TaskForm — Titel-Mic startet automatisch, wenn Einstellung an (Anlegen)', async ({ page }) => {
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Aufnahme am Titel-Feld ist automatisch gestartet.
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'true');
	});

	test('AK4b: TaskForm — Titel-Mic startet automatisch beim Bearbeiten eines Tasks', async ({ page }) => {
		// Task anlegen
		const createRes = await page.request.post('/api/v1/tasks', {
			data: { title: 'Test-Task für Edit', description: '', pillar: 'health', priority: 3, effort: 3 },
		});
		expect(createRes.ok()).toBe(true);
		const { id: taskId } = (await createRes.json()) as { id: number };

		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		// Bearbeiten-Button des angelegten Tasks klicken.
		const editButton = page.getByRole('button', { name: /bearbeiten/i }).first();
		await editButton.click();
		await waitForStableView(page);
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

		// Aufnahme am Titel-Feld ist automatisch gestartet.
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'true');

		// Cleanup
		await page.request.delete(`/api/v1/tasks/${taskId}`);
	});

	/**
	 * AK5 — Auto-Start Serien-Formular: Einstellung an → Aufnahme startet automatisch beim Öffnen
	 * von SeriesFormModal (Anlegen und Bearbeiten).
	 */
	test('AK5: SeriesFormModal — Titel-Mic startet automatisch beim Anlegen (Einstellung an)', async ({ page }) => {
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Serien verwalten' }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Serie anlegen' })).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

		// Aufnahme am Titel-Feld ist automatisch gestartet.
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'Titel')).toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK6 — Nicht unterstützt / verweigert: Einstellung an, aber SpeechRecognition nicht verfügbar
	 * → kein Absturz; Feld normal nutzbar, Fehler über voiceError-Handling.
	 */
	test('AK6: Einstellung an, aber SpeechRecognition nicht unterstützt → kein Absturz', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: false, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Keine JS-Fehler.
		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);

		// Titel-Input ist weiterhin normal nutzbar.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeEditable();

		// Keine automatische Aufnahme (da nicht unterstützt).
		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
	});

	/**
	 * AK7 — Kein Auto-Start, wenn aus: Einstellung aus (Default) → keine automatische Aufnahme
	 * in TaskForm oder SeriesFormModal.
	 */
	test('AK7a: Einstellung aus → kein Auto-Start in TaskForm', async ({ page }) => {
		// Explizit false setzen (entspricht Default).
		await setVoiceAutostartInStorage(page, false);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
		await expect(micButton(page, 'Titel')).not.toHaveAttribute('aria-pressed', 'true');
	});

	test('AK7b: Einstellung aus → kein Auto-Start in SeriesFormModal', async ({ page }) => {
		await setVoiceAutostartInStorage(page, false);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Serien verwalten' }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Serie anlegen' })).toBeVisible();
		await waitForStableView(page);

		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
		await expect(micButton(page, 'Titel')).not.toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK8 — Mobile-First (375px): Allgemein-Tab mit Schalter verursacht kein horizontales Scrollen;
	 * Schalter ist sichtbar und bedienbar.
	 */
	test('AK8: Schalter verursacht kein horizontales Scrollen bei 375px-Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/settings/general');
		await waitForStableView(page);

		// Der Schalter muss sichtbar und bedienbar sein.
		const toggle = page
			.getByRole('checkbox', { name: /Sprachaufnahme automatisch starten/i })
			.or(page.getByRole('switch', { name: /Sprachaufnahme automatisch starten/i }));
		await expect(toggle).toBeVisible();

		// Kein horizontaler Überlauf.
		const overflowsHorizontally = await page.evaluate(() => {
			return document.body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});
