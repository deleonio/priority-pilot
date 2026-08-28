import { expect, test, type Page } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1080 — „Settings KI deaktivierbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Spezifikation: docs/spec/issue-1080.md
 *
 * Vertrag: Im Settings-Tab „KI-Provider" gibt es zwei unabhängige, sofort wirkende und
 * persistente Schalter — „KI-Features aktiv" (Hauptschalter) und „Schnellerfassung aktiv".
 * KI aus → Toolbar-Button „Säulen-Berater" und die Lektorat-Buttons im TaskForm verschwinden.
 * Schnellerfassung aus → „Neuen Task anlegen" öffnet direkt das Task-Formular.
 *
 * **Präferenzen vor dem Seitenaufbau:** Die Storage-Keys werden per `page.addInitScript` gesetzt
 * (Muster `pp-voice-autostart` in `voice-autostart.spec.ts`) — die Keys müssen exakt denen in
 * `frontend/src/lib/aiPreferences.ts` entsprechen (Mirror, dort per Unit-Test gesichert).
 * Defaults sind bewusst **an** (= Status quo), damit `quick-capture.spec.ts`,
 * `pillar-advisor*.spec.ts` und `lektorat-button.spec.ts` unverändert grün bleiben.
 */

/** Storage-Key der KI-Hauptpräferenz (muss mit aiPreferences.ts übereinstimmen). */
const AI_ENABLED_KEY = 'pp-ai-enabled';
/** Storage-Key der Schnellerfassungs-Präferenz (muss mit aiPreferences.ts übereinstimmen). */
const QUICK_CAPTURE_ENABLED_KEY = 'pp-quick-capture-enabled';

/** Schalter-Locator mit Rollen-Fallback: KoliBri exponiert `switch` bzw. `checkbox` je Version. */
const switchControl = (page: Page, name: RegExp) =>
	page.getByRole('switch', { name }).or(page.getByRole('checkbox', { name }));

/** Setzt beide Präferenzen vor dem Seitenaufbau (Werte wie in localStorage: 'true'/'false'). */
const initPreferences = (page: Page, prefs: { aiEnabled: boolean; quickCaptureEnabled: boolean }): void => {
	const script = (key: string, value: boolean): string =>
		`try { localStorage.setItem(${JSON.stringify(key)}, '${value}'); } catch (e) {}`;
	page.addInitScript(script(AI_ENABLED_KEY, prefs.aiEnabled));
	page.addInitScript(script(QUICK_CAPTURE_ENABLED_KEY, prefs.quickCaptureEnabled));
};

/** Öffnet den KI-Provider-Tab der Einstellungen. */
const openLlmTab = async (page: Page): Promise<void> => {
	await page.goto('/settings/llm');
	await waitForStableView(page, 'Priority Pilot');
};

test.describe('#1080 KI-Features deaktivierbar', () => {
	test('AK1+AK3: beide Schalter existieren im Tab „KI-Provider", Default an, umschaltbar', async ({ page }) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		const quickCaptureSwitch = switchControl(page, /^Schnellerfassung aktiv$/);
		await expect(aiSwitch).toBeVisible();
		await expect(quickCaptureSwitch).toBeVisible();

		// Defaults = Status quo: beide Features aktiv.
		await expect(aiSwitch).toBeChecked();
		await expect(quickCaptureSwitch).toBeChecked();

		// AK1: Hauptschalter umschaltbar …
		await aiSwitch.click();
		await expect(aiSwitch).not.toBeChecked();

		// AK3: … und die Schnellerfassung bleibt davon unabhängig wählbar (weiterhin an).
		await expect(quickCaptureSwitch).toBeChecked();
		await quickCaptureSwitch.click();
		await expect(quickCaptureSwitch).not.toBeChecked();
	});

	test('AK2: KI aus — „Säulen-Berater" fehlt in der Toolbar, keine Lektorat-Buttons im Formular', async ({ page }) => {
		// Schnellerfassung ebenfalls aus, damit das Anlegen direkt das TaskForm öffnet (KI-aus-Pfad).
		initPreferences(page, { aiEnabled: false, quickCaptureEnabled: false });

		await page.goto('/');
		await waitForStableView(page);

		// Toolbar: Der Button ist nicht gerendert (nicht nur ausgeblendet).
		await expect(
			page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: 'Säulen-Berater' }),
		).toHaveCount(0);
		// Die übrigen Kopf-Aktionen bleiben erhalten (nicht gleich die ganze Toolbar weg).
		await expect(
			page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: 'Neuen Task anlegen' }),
		).toBeVisible();

		// Anlege-Formular öffnet direkt (Schnellerfassung aus) und enthält keinen Lektorat-Button.
		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('button', { name: /lektorieren/ })).toHaveCount(0);
	});

	test('AK2: KI aus — auch der Bearbeiten-Dialog enthält keine Lektorat-Buttons', async ({ page }) => {
		initPreferences(page, { aiEnabled: false, quickCaptureEnabled: true });

		// Task über die echte API anlegen (Vite-Proxy), damit der Bearbeiten-Dialog geöffnet werden kann.
		const created = await page.request.post('/api/v1/tasks', {
			data: { title: '#1080 KI aus — Bearbeiten', status: 'Open' },
		});
		expect(created.ok()).toBeTruthy();
		const task = (await created.json()) as { id: number };

		try {
			await page.goto('/');
			await waitForStableView(page);
			// Die Task-Liste liegt im „Aufgaben"-Tab (nicht im Dashboard); „Bearbeiten" liegt hinter „Weitere Aktionen".
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
			await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
			await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

			await expect(page.getByRole('button', { name: /lektorieren/ })).toHaveCount(0);
		} finally {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	});

	test('AK4: Schnellerfassung aus — „Neuen Task anlegen" öffnet direkt das Task-Formular', async ({ page }) => {
		initPreferences(page, { aiEnabled: true, quickCaptureEnabled: false });

		await page.goto('/');
		await waitForStableView(page);

		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());

		// Direkt das Task-Formular (Feld „Titel") — ohne den Capture-Schritt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveCount(0);
	});

	test('AK4: Berater-Übernahme ohne Schnellerfassung — Vorschlagstext landet als Beschreibung', async ({ page }) => {
		initPreferences(page, { aiEnabled: true, quickCaptureEnabled: false });

		// Berater-Antwort mocken; die Säulen-Liste kommt vom echten Backend, damit die gemockte
		// `pillarIds`-Referenz zur geladenen Liste passt (Muster `pillar-advisor-adopt.spec.ts`).
		const pillarsResponse = await page.request.get('/api/v1/pillars');
		const pillars = (await pillarsResponse.json()) as { id: number }[];
		expect(pillars.length).toBeGreaterThan(0);

		await page.route('**/api/v1/pillars/advisor', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					advice: [{ activity: 'Spaziergang am Fluss', reason: 'Ein guter Ausgleich.', pillarIds: [pillars[0].id] }],
				}),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);
		await (await headerAction(page, 'Säulen-Berater')).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Berater' })).toBeVisible();

		await page.getByRole('textbox', { name: /Deine Frage oder Situation/ }).fill('Was tut mir gut?');
		await page.getByRole('button', { name: 'Beraten lassen' }).click();
		await expect(page.locator('.advisor-results').getByText('Spaziergang am Fluss')).toBeVisible();

		await page.getByRole('button', { name: 'Als Aufgabe übernehmen' }).click();

		// Auch dieser Einstieg weicht der Schnellerfassung aus (#1080) und nimmt den Vorschlagstext
		// als Beschreibungs-Vorbelegung mit (#327: `initialText` → `initialValues.description`).
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveCount(0);
		await expect(page.getByRole('textbox', { name: /^Beschreibung/ })).toHaveValue('Spaziergang am Fluss');
	});

	test('AK5: beide Einstellungen überleben das Neuladen unverändert', async ({ page }) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		const quickCaptureSwitch = switchControl(page, /^Schnellerfassung aktiv$/);
		await aiSwitch.click();
		await quickCaptureSwitch.click();
		await expect(aiSwitch).not.toBeChecked();
		await expect(quickCaptureSwitch).not.toBeChecked();

		await page.reload();
		await waitForStableView(page, 'Priority Pilot');

		await expect(aiSwitch).not.toBeChecked();
		await expect(quickCaptureSwitch).not.toBeChecked();
	});

	test('AK2: in den Einstellungen umgeschaltet — „Säulen-Berater" ist nach „Zurück" sofort weg', async ({ page }) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await aiSwitch.click();
		await expect(aiSwitch).not.toBeChecked();

		// Zurück in die Haupt-App: Der Button verschwindet ohne Seiten-Neuladen — die Einstellungen
		// dürfen keinen veralteten Wert in der bereits gemounteten Haupt-App hinterlassen.
		await page.getByRole('button', { name: 'Zurück' }).click();
		await waitForStableView(page);

		await expect(
			page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: 'Säulen-Berater' }),
		).toHaveCount(0);
	});

	test('AK6: 375px — beide Schalter sind voll sichtbar, ≥44px hoch und in der Viewport-Breite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openLlmTab(page);

		const switches = page.locator('.settings-llm kol-input-checkbox[_variant="switch"]');
		// Guard gegen leere Menge: genau die beiden neuen Schalter des Tabs.
		await expect(switches).toHaveCount(2);

		for (let i = 0; i < 2; i++) {
			const box = await switches.nth(i).boundingBox();
			expect(box).toBeTruthy();
			// Vollständig in der Viewport-Breite (kein Abschneiden, kein Horizontal-Scroll).
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
			// Touch-Target (Mobile-UI-Regel 2).
			expect(box!.height).toBeGreaterThanOrEqual(44);

			// Vertikal bedienbar: nach dem Scrollen vollständig im Viewport.
			await switches.nth(i).scrollIntoViewIfNeeded();
			const scrolled = await switches.nth(i).boundingBox();
			expect(scrolled).toBeTruthy();
			expect(scrolled!.y).toBeGreaterThanOrEqual(0);
			expect(scrolled!.y + scrolled!.height).toBeLessThanOrEqual(812);

			// Bedienbar: Umschalten ändert den Zustand (Assertion auf das native Input im Shadow-DOM,
			// da der `kol-input-checkbox`-Host selbst weder Checkbox noch Rolle `switch` trägt).
			await switches.nth(i).locator('input').click();
			await expect(switches.nth(i).locator('input')).not.toBeChecked();
		}
	});
});
