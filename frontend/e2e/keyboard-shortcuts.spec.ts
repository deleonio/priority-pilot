import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #243 — „CTA Buttons sollen immer mit Strg+Enter abgesendet werden".
 *
 * Vertrag: In jedem Dialog/Formular mit einem primären CTA (KolButton `_variant="primary"`) löst
 * `Strg+Enter` (bzw. auf macOS `⌘+Enter`) die primäre Aktion aus — ohne dass der CTA-Button
 * fokussiert sein muss und aus jedem Fokus innerhalb des Dialogs heraus. Ist der CTA deaktiviert
 * (z. B. weil ein Pflichtfeld leer ist), passiert nichts. In mehrzeiligen Textfeldern darf der
 * Shortcut die Aktion auslösen, ohne einen Zeilenumbruch einzufügen.
 *
 * Die Umsetzung erfolgt über einen noch fehlenden Hook `useCtrlEnter`
 * (`frontend/src/lib/useCtrlEnter.ts`), der in die betroffenen Formulare/Dialoge eingebunden wird
 * (TaskForm, QuickCaptureModal, DeleteTaskDialog, DependencyModal, PillarWeightsModal,
 * Serien-Formular). Bis dahin ist diese Spec rot: die Tests prüfen ausschließlich das
 * beobachtbare Soll-Verhalten (Aktion ausgelöst / nicht ausgelöst), nicht den Hook selbst.
 *
 * **Isolation:** Tests, die einen Task anlegen, räumen über `afterEach` alle Tasks via echter API
 * wieder ab (analog `crud.spec.ts`), damit jeder Test von einem leeren Zustand startet.
 */
test.describe('CTA-Buttons per Strg+Enter absenden (#243)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `KB ${label} #${(runId += 1)}-${Date.now()}`;

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

	/** Wechselt auf den „Aufgaben"-Tab (die Task-Tabelle liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Öffnet den „Neuen Task anlegen"-Dialog und überbrückt den Schnellerfassungs-Schritt (#236) via
	 * „Überspringen", sodass das reguläre Formular mit dem Titel-Feld sichtbar ist.
	 */
	const openTaskForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
	};

	test('AK1: Strg+Enter im offenen Dialog löst die primäre Aktion aus (Task wird gespeichert)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const title = uniqueTitle('Strg+Enter');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		// Kein Klick auf „Speichern": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Der Dialog schließt sich (Aktion ausgeführt) und der Task erscheint in der Liste.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('AK2: ⌘+Enter (macOS) löst dieselbe primäre Aktion aus wie Strg+Enter', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const title = uniqueTitle('Meta+Enter');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		// macOS-Simulation: auf Linux gedrückt, muss der Hook `metaKey` gleichwertig behandeln.
		await page.keyboard.press('Meta+Enter');

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('AK3: bei deaktiviertem CTA (Pflichtfeld leer) passiert bei Strg+Enter nichts', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Titel bleibt bewusst leer → der Speichern-Button ist deaktiviert (Pflichtfeld-Validierung).
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('');

		// Fokus in das leere Titel-Feld setzen und den Shortcut auslösen.
		await page.getByRole('textbox', { name: 'Titel' }).click();
		await page.keyboard.press('Control+Enter');

		// Kurz warten, damit ein (fälschlich) ausgelöstes Schließen Zeit hätte, sichtbar zu werden.
		await page.waitForTimeout(500);

		// Nichts ist passiert: der Dialog ist weiterhin offen (Heading bleibt sichtbar).
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

		// Gegenprobe: es wurde kein Task angelegt.
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		expect(tasks).toHaveLength(0);
	});

	test('AK4: Strg+Enter aus einem Textfeld heraus löst die Aktion aus, ohne Zeilenumbruch einzufügen', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		const title = uniqueTitle('Textfeld');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		// Fokus in das mehrzeilige Beschreibungs-Textfeld setzen — hier wäre ein Zeilenumbruch möglich.
		const description = page.getByLabel('Beschreibung (optional)');
		const descriptionText = 'Erste Zeile Beschreibung';
		await description.fill(descriptionText);
		await description.click();

		await page.keyboard.press('Control+Enter');

		// Aktion ausgelöst: der Dialog ist geschlossen …
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		// … und der Task wurde angelegt.
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		// Kein Zeilenumbruch: der gespeicherte Beschreibungstext enthält kein „\n".
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { title: string; description: string | null }[];
		const created = tasks.find((task) => task.title === title);
		expect(created).toBeDefined();
		expect(created?.description ?? '').toBe(descriptionText);
		expect(created?.description ?? '').not.toContain('\n');
	});

	test('AK5: auf 375-px-Viewport löst der Shortcut aus, ohne horizontales Scrollen / Layout-Bruch', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await openTaskForm(page);

		// Kein horizontaler Overflow, während der Dialog offen ist.
		const overflowBefore = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(overflowBefore, 'Kein horizontales Scrollen bei geöffnetem Dialog').toBe(true);

		const title = uniqueTitle('Mobile');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		await page.keyboard.press('Control+Enter');

		// Der Shortcut löst auch auf schmalem Viewport die primäre Aktion aus.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// Layout unverändert: weiterhin kein horizontaler Overflow nach dem Absenden.
		const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(overflowAfter, 'Kein horizontales Scrollen nach dem Absenden').toBe(true);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	/**
	 * Legt über die UI einen Task mit dem gegebenen Titel an und wartet, bis der Dialog geschlossen ist
	 * (analog `crud.spec.ts`: Schnellerfassung „Überspringen", Titel füllen, „Speichern").
	 */
	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	// --- DeleteTaskDialog ------------------------------------------------------------------------
	// UI-Flow eindeutig aus `crud.spec.ts` ableitbar: Task anlegen → in der Liste „Löschen" klicken →
	// Bestätigungsdialog („Task löschen") → primärer CTA „Endgültig löschen" (Variante `danger`).
	test('AK6: Strg+Enter im Löschen-Dialog löst „Endgültig löschen" aus (Task verschwindet)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Löschen');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		// Kein Klick auf „Endgültig löschen": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Der Dialog schließt sich und der Task ist weg — als einziger Task kehrt die App in den
		// leeren Anfangszustand zurück.
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible();
		await expect(page.getByText(title, { exact: true })).toHaveCount(0);
	});

	// --- PillarWeightsModal ----------------------------------------------------------------------
	// UI-Flow eindeutig aus `crud.spec.ts` ableitbar: Einstellungs-Popover → „Säulen-Gewichtung" →
	// primärer CTA „Speichern". Die vorhandenen Säulen-Rohwerte sind gültig (Default > 0), daher ist
	// der CTA aktiv und der Shortcut löst das Speichern aus.
	test('AK7: Strg+Enter im Säulen-Gewichtungs-Dialog löst „Speichern" aus (Dialog schließt)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Neuer Flow: direkt zur Settings-Route navigieren
		await page.goto('/settings/pillars');
		await waitForStableView(page);
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page);

		// Ersten Slider auf das Maximum setzen (gültige Verteilung sichergestellt), CTA bleibt aktiv.
		const sliders = page.locator('input[type="range"]');
		await expect(sliders.first()).toBeVisible();
		await sliders.first().press('End');

		// Kein Klick auf „Speichern": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Nach Speichern navigiert die Settings-Seite zurück zum Dashboard (Heading verschwindet).
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden();
	});

	// --- Serien-Formular -------------------------------------------------------------------------
	// UI-Flow eindeutig aus `series.spec.ts` ableitbar: Kopf-Toolbar „Serien verwalten" → „Neue Serie
	// anlegen" → Titel + Startdatum füllen → primärer CTA „Speichern". Nach dem Speichern wird die
	// Serie gelistet. `afterEach` (deleteAllTasks) räumt nur Tasks ab, daher die Serie hier explizit
	// über die echte API wieder löschen, damit der Test isoliert bleibt.
	test('AK8: Strg+Enter im Serien-Formular löst „Speichern" aus (Serie wird angelegt)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Serien verwalten' }).click();
		await expect(page.getByRole('heading', { name: 'Serien', exact: true })).toBeVisible();
		await waitForStableView(page);

		const title = uniqueTitle('Serie');
		await page.getByRole('button', { name: 'Neue Serie anlegen' }).click();
		await expect(page.getByRole('group', { name: 'Neue Serie anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByLabel('Startdatum').fill('2026-09-07');

		// Kein Klick auf „Speichern": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Das Formular schließt sich und die Serie erscheint in der Serien-Liste.
		await expect(page.getByRole('group', { name: 'Neue Serie anlegen' })).toBeHidden();
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		// Persistenz gegenprüfen und die angelegte Serie wieder abräumen (afterEach löscht nur Tasks).
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number; title: string }[];
		const created = series.find((entry) => entry.title === title);
		expect(created).toBeDefined();
		if (created) await page.request.delete(`/api/v1/series/${created.id}`);
	});

	// --- QuickCaptureModal -----------------------------------------------------------------------
	// UI-Flow eindeutig aus `quick-capture.spec.ts` ableitbar: „Neuen Task anlegen" öffnet den
	// Schnellerfassungs-Schritt; primärer CTA dort ist „Verarbeiten und weiter" (aktiv sobald Text
	// vorhanden). `parse-text` wird — wie in `quick-capture.spec.ts` — gemockt (kein echtes LLM); der
	// Shortcut muss den Parse-Schritt auslösen und ins vorausgefüllte Formular führen.
	test('AK9: Strg+Enter im Schnellerfassungs-Schritt löst „Verarbeiten und weiter" aus', async ({ page }) => {
		await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ title: 'Geparster Kurzbefehl-Task' }),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Kurztext für die Schnellerfassung');

		// Kein Klick auf „Verarbeiten und weiter": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Nach dem (gemockten) Parsen verschwindet der Capture-Schritt und das Formular ist vorbelegt.
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toBeHidden();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('Geparster Kurzbefehl-Task');
		// Hier wird nur vorausgefüllt, nicht gespeichert; afterEach räumt evtl. Tasks dennoch ab.
	});

	// --- DependencyModal -------------------------------------------------------------------------
	// UI-Flow aus `TaskTree.tsx` (Toolbar-Button „Abhängigkeiten") und der Combobox-Bedienung in
	// `crud.spec.ts`/`series.spec.ts` ableitbar: zwei Tasks anlegen, beim ersten den Abhängigkeits-
	// Dialog öffnen, den zweiten als Vorgänger auswählen → primärer CTA „Hinzufügen" wird aktiv. Der
	// Shortcut muss die Abhängigkeit anlegen (Dialog bleibt offen, der neue Vorgänger erscheint in der
	// Liste „Aktuelle Vorgänger").
	test('AK10: Strg+Enter im Abhängigkeits-Dialog löst „Hinzufügen" aus (Vorgänger erscheint)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const predecessorTitle = uniqueTitle('Vorgänger');
		const targetTitle = uniqueTitle('Ziel');
		await createTaskViaUi(page, predecessorTitle);
		await createTaskViaUi(page, targetTitle);

		await openTasksTab(page);

		// Abhängigkeits-Dialog des Ziel-Tasks öffnen (Toolbar-Button „Abhängigkeiten", per Icon/Label).
		const targetItem = page.locator('.task-tree-item', { hasText: targetTitle }).first();
		await targetItem.getByRole('button', { name: 'Abhängigkeiten' }).click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten:/ })).toBeVisible();
		await waitForStableView(page);

		// Den Vorgänger-Task in der KolSingleSelect-Combobox auswählen (analog crud.spec.ts).
		await page.getByLabel('Vorgänger-Task').click();
		await page.getByRole('option', { name: new RegExp(predecessorTitle) }).click();

		// Kein Klick auf „Hinzufügen": der Shortcut allein muss die primäre Aktion auslösen.
		await page.keyboard.press('Control+Enter');

		// Der Vorgänger erscheint in der Liste „Aktuelle Vorgänger" (Dialog bleibt offen).
		await expect(page.locator('.dependency-list').getByText(new RegExp(predecessorTitle))).toBeVisible();
	});

	// --- Bewusst NICHT als eigener Shortcut-Test abgedeckt --------------------------------------
	// Alle sechs betroffenen Dialoge (TaskForm via AK1–AK5, DeleteTaskDialog AK6, PillarWeightsModal
	// AK7, Serien-Formular AK8, QuickCaptureModal AK9, DependencyModal AK10) sind oben abgedeckt.
});
