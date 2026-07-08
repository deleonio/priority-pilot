import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #272 — „Allgemein-Einstellung: Auto-Sprachaufnahme im ersten Eingabefeld
 * (Schalter)" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Der Allgemein-Tab (aus #271) erhält einen Schalter „Sprachaufnahme automatisch starten"
 * (Default: aus). Ist er an, wird beim Öffnen von TaskForm und Serien-Formular das erste
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
const buildInitScript = (opts: { speechSupported: boolean; mediaPermission: 'granted' | 'denied' | 'prompt' }) => `
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
		`
				: `
		delete window.SpeechRecognition;
		delete window.webkitSpeechRecognition;
		`
		}

		window.__fireSpeechResult = (text, isFinal) => {
			if (activeInstance && typeof activeInstance.onresult === 'function') {
				activeInstance.onresult({
					resultIndex: 0,
					results: { 0: { 0: { transcript: text }, isFinal: isFinal !== false }, length: 1 },
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
		__fireSpeechResult?: (text: string, isFinal?: boolean) => void;
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
		await waitForStableView(page, 'Priority Pilot');

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
		await waitForStableView(page, 'Priority Pilot');

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
		const stored = await page.evaluate((key) => localStorage.getItem(key), VOICE_AUTOSTART_KEY);
		expect(stored).toBe('true');
	});

	test('AK3b: Einschalten + Berechtigung verweigert → Schalter bleibt aus und Hinweis sichtbar', async ({ page }) => {
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'denied' }));
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

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
		await waitForStableView(page, 'Priority Pilot');

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

		// Zum Tab „Aufgaben" wechseln – Bearbeiten-Buttons sind dort, nicht im Dashboard.
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await waitForStableView(page);

		// Bearbeiten-Button des angelegten Tasks klicken (liegt im „…"-Popover, #361).
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
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
	 * des Serien-Formulars (Anlegen und Bearbeiten).
	 */
	test('AK5: Serien-Formular — Titel-Mic startet automatisch beim Anlegen (Einstellung an)', async ({ page }) => {
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);
		await page.getByTestId('mode-switch').getByRole('checkbox').click();
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
	 * in TaskForm oder Serien-Formular.
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

	test('AK7b: Einstellung aus → kein Auto-Start im Serien-Formular', async ({ page }) => {
		await setVoiceAutostartInStorage(page, false);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);
		await page.getByTestId('mode-switch').getByRole('checkbox').click();
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
		await waitForStableView(page, 'Priority Pilot');

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

// ---------------------------------------------------------------------------
// #281 — Schnellerfassung: Voice-Autostart im Capture-Textfeld
// ---------------------------------------------------------------------------

/** Öffnet die Schnellerfassung und bleibt im Capture-Schritt (NICHT überspringen). */
const openQuickCapture = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	// Sicherstellen, dass wir im Capture-Schritt sind (Textarea sichtbar, NICHT überspringen).
	await expect(page.getByRole('textbox', { name: /Beschreibe deinen Task/i })).toBeVisible();
};

test.describe('#281 Schnellerfassung: Voice-Autostart im Capture-Textfeld', () => {
	test.afterEach(async ({ page }) => {
		// Keine Tasks angelegt in diesen Tests — trotzdem aufräumen für Isolation.
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	});

	/**
	 * AK1 — Auto-Start bei aktiver Einstellung:
	 * pp-voice-autostart=true + Sprachunterstützung vorhanden → Aufnahme startet automatisch
	 * am Capture-Feld „Beschreibe deinen Task" (window.__speechRecognitionStarted===true,
	 * Mic-Button aria-pressed="true").
	 */
	test('AK1: Einstellung an → Aufnahme startet automatisch im Capture-Feld', async ({ page }) => {
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'Beschreibe deinen Task')).toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK2 — Kein Auto-Start bei ausgeschalteter Einstellung (Default):
	 * pp-voice-autostart=false → keine automatische Aufnahme im Capture-Feld.
	 */
	test('AK2: Einstellung aus (Default) → kein Auto-Start im Capture-Feld', async ({ page }) => {
		await setVoiceAutostartInStorage(page, false);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
		await expect(micButton(page, 'Beschreibe deinen Task')).not.toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK3 — Keine Sprachunterstützung → kein Absturz:
	 * Einstellung an, aber SpeechRecognition nicht verfügbar → keine JS-Fehler,
	 * Textfeld sichtbar und editierbar, keine Aufnahme gestartet.
	 */
	test('AK3: Einstellung an, SpeechRecognition nicht verfügbar → kein Absturz', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: false, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
		await expect(page.getByRole('textbox', { name: /Beschreibe deinen Task/i })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe deinen Task/i })).toBeEditable();
		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
	});

	/**
	 * AK4 — Mobile-First (375px):
	 * Kein horizontales Scrollen, Mic-Button sichtbar und bedienbar.
	 */
	test('AK4: 375px-Viewport — kein horizontales Scrollen, Mic-Button sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openQuickCapture(page);

		const overflowsHorizontally = await page.evaluate(() => {
			return document.body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
		await expect(micButton(page, 'Beschreibe deinen Task')).toBeVisible();
	});
});

/** Öffnet den Säulen-Berater über die Header-Toolbar. */
const openAdvisor = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Säulen-Berater' }).click();
	await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();
	await waitForStableView(page);
};

test.describe('Säulen-Berater: Voice-Autostart im Fragefeld', () => {
	/**
	 * AK1 — Auto-Start bei aktiver Einstellung:
	 * pp-voice-autostart=true + Sprachunterstützung vorhanden → Aufnahme startet automatisch
	 * am Fragefeld „Deine Frage oder Situation" (window.__speechRecognitionStarted===true,
	 * Mic-Button aria-pressed="true").
	 */
	test('AK1: Einstellung an → Aufnahme startet automatisch im Fragefeld', async ({ page }) => {
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openAdvisor(page);

		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await expect(micButton(page, 'Deine Frage oder Situation')).toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK2 — Kein Auto-Start bei ausgeschalteter Einstellung (Default):
	 * pp-voice-autostart=false → keine automatische Aufnahme im Fragefeld.
	 */
	test('AK2: Einstellung aus (Default) → kein Auto-Start im Fragefeld', async ({ page }) => {
		await setVoiceAutostartInStorage(page, false);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openAdvisor(page);

		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
		await expect(micButton(page, 'Deine Frage oder Situation')).not.toHaveAttribute('aria-pressed', 'true');
	});

	/**
	 * AK3 — Keine Sprachunterstützung → kein Absturz:
	 * Einstellung an, aber SpeechRecognition nicht verfügbar → keine JS-Fehler,
	 * Textfeld sichtbar und editierbar, keine Aufnahme gestartet.
	 */
	test('AK3: Einstellung an, SpeechRecognition nicht verfügbar → kein Absturz', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: false, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openAdvisor(page);

		expect(pageErrors, `Unerwartete pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
		await expect(page.getByRole('textbox', { name: /Deine Frage oder Situation/i })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Deine Frage oder Situation/i })).toBeEditable();
		const started = await page.evaluate(() => window.__speechRecognitionStarted === true);
		expect(started).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// #283 — Stabilität: Autostart verliert kein früh gesprochenes Ergebnis
// ---------------------------------------------------------------------------

test.describe('#283 Autostart: früh gesprochenes Ergebnis geht nicht verloren', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/**
	 * Issue-AK4 — der Mock startet die Engine asynchron (onstart per setTimeout, wie der echte
	 * Warmup): Ein Ergebnis, das UNMITTELBAR nach dem Mount eintrifft (also möglicherweise noch vor
	 * onstart), darf nicht verworfen werden.
	 */
	test('AK1: Ergebnis unmittelbar nach dem Mount landet im Titel-Feld', async ({ page }) => {
		await setVoiceAutostartInStorage(page, true);
		await page.addInitScript(buildInitScript({ speechSupported: true, mediaPermission: 'granted' }));
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Sobald die Aufnahme angestoßen ist (start() gerufen), SOFORT sprechen — ohne auf den
		// Lausch-Beginn (onstart → aria-pressed) zu warten.
		await expect.poll(() => page.evaluate(() => window.__speechRecognitionStarted === true)).toBe(true);
		await page.evaluate(() => window.__fireSpeechResult?.('Sofort gesprochener Titel'));

		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Sofort gesprochener Titel');
		// Kein Fehler-/Hinweistext — die frühe Eingabe ist ein Erfolgsfall.
		await expect(page.locator('.mic-error')).toHaveCount(0);
	});
});
