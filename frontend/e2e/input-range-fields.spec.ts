import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #287 — „Alle InputNumber-Felder auf InputRange umstellen".
 *
 * Vertrag: Die drei numerischen Eingaben (Priorität, geschätzter Aufwand im TaskForm sowie das
 * Abhängigkeits-Gewicht im DependencyModal) werden von `KolInputNumber` (rendert ein natives
 * `<input type="number">`) auf `KolInputRange` (rendert ein natives `<input type="range">` im offenen
 * Shadow-DOM) umgestellt:
 *  - Priorität: `min=1 max=5 step=1`
 *  - Aufwand:   `min=0.1 max=1 step=0.1`
 *  - Gewicht:   `min=0.1 max=1 step=0.1`
 *
 * Die Produktivumsetzung folgt; bis dahin sind diese Tests rot — es existiert noch kein
 * `input[type="range"]` mit den geforderten Attributen in TaskForm/DependencyModal (dort steckt bislang
 * `input[type="number"]`).
 *
 * **Selektor-Wahl:** `KolInputRange` exponiert KEIN `role="slider"` und kein `aria-label` aus seinem
 * `_label`; im (offenen) Shadow-DOM steckt jedoch ein natives `<input type="range">`. Playwrights
 * CSS durchdringt offene Shadow-Roots, daher zielen wir direkt auf diese Range-Inputs (analog der
 * Säulen-Gewichtung in `crud.spec.ts`). `End`/`Home` setzen den Range zuverlässig auf Max/Min,
 * `ArrowRight` bewegt um genau einen Step.
 *
 * **Isolation:** Jeder Test legt Tasks an; `afterEach` räumt alle Tasks über die echte API ab, damit
 * jeder Test von einem leeren Zustand startet (analog `crud.spec.ts`).
 */
test.describe('InputRange-Felder statt InputNumber (#287)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `IR ${label} #${(runId += 1)}-${Date.now()}`;

	/** Legt über die echte API einen Task an und gibt dessen ID zurück (Vite-Proxy → Backend). */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 0.5 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/** Löscht alle aktuell vorhandenen Tasks über die echte API. */
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

	/** Öffnet den Bearbeiten-Dialog des ersten Tasks und wartet, bis das Formular stabil steht. */
	const openFirstTaskEdit = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
	};

	test('AK1: Priorität ist ein Range-Input [min=1 max=5 step=1], Wert persistiert über Speichern + Reload', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTask(page, uniqueTitle('Priorität'));
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openFirstTaskEdit(page);

		// Das Prioritäts-Feld muss als Range-Slider mit exakt diesen Attributen vorliegen.
		const priority = page.locator('input[type="range"][min="1"][max="5"][step="1"]');
		await expect(priority).toBeVisible();

		// Auf das Minimum (1) setzen und speichern.
		await priority.press('Home');
		await expect(priority).toHaveValue('1');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();

		// Harter Reload: die Werte kommen frisch aus dem Backend — beweist die Persistenz.
		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		await openFirstTaskEdit(page);

		await expect(page.locator('input[type="range"][min="1"][max="5"][step="1"]')).toHaveValue('1');
	});

	test('AK2: Aufwand ist ein Range-Input [min=0.1 max=1 step=0.1], Wert persistiert über Speichern + Reload', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTask(page, uniqueTitle('Aufwand'));
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openFirstTaskEdit(page);

		// Das Aufwands-Feld muss als Range-Slider mit exakt diesen Attributen vorliegen.
		const effort = page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]');
		await expect(effort).toBeVisible();

		// Auf das Maximum (1) setzen und speichern.
		await effort.press('End');
		await expect(effort).toHaveValue('1');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();

		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		await openFirstTaskEdit(page);

		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toHaveValue('1');
	});

	test('AK3: Gewicht im Abhängigkeits-Dialog ist ein Range-Input [min=0.1 max=1 step=0.1]', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Zwei Tasks anlegen: Der Dialog zeigt den Gewichts-Slider nur, wenn mindestens ein
		// weiterer Task als Vorgänger-Kandidat verfügbar ist (options.length > 0).
		await createTask(page, uniqueTitle('Ziel'));
		await createTask(page, uniqueTitle('Vorgänger'));
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await page.getByRole('button', { name: 'Abhängigkeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);

		// Das Gewichts-Feld muss als Range-Slider mit exakt diesen Attributen vorliegen.
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toBeVisible();
	});

	test('AK4: ArrowRight verschiebt den Prioritäts-Slider dauerhaft (kein Reset auf den Ausgangswert)', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTask(page, uniqueTitle('State'));
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openFirstTaskEdit(page);

		// Vom Minimum aus zwei Steps nach rechts. Wird der Wert intern über `useRef` statt `useState`
		// gehalten, springt der Slider nach dem Re-Render auf den Ausgangswert zurück — dann bleibt
		// hier nicht „3" stehen. Der Test verlangt also, dass die neue Position erhalten bleibt.
		const priority = page.locator('input[type="range"][min="1"][max="5"][step="1"]');
		await priority.press('Home');
		await expect(priority).toHaveValue('1');
		await priority.press('ArrowRight');
		await priority.press('ArrowRight');
		await expect(priority).toHaveValue('3');
	});

	test('AK5: Kein horizontaler Overflow im Task-Formular auf 375-px-Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		await createTask(page, uniqueTitle('Mobile-Form'));
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await openFirstTaskEdit(page);

		// Beide Range-Slider müssen sichtbar sein …
		await expect(page.locator('input[type="range"][min="1"][max="5"][step="1"]')).toBeVisible();
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toBeVisible();

		// … ohne einen horizontalen Overflow zu erzeugen.
		const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(noOverflow).toBe(true);
	});

	test('AK5b: Kein horizontaler Overflow im Abhängigkeits-Dialog auf 375-px-Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		// Zwei Tasks anlegen: Der Dialog zeigt den Gewichts-Slider nur, wenn mindestens ein
		// weiterer Task als Vorgänger-Kandidat verfügbar ist (options.length > 0).
		await createTask(page, uniqueTitle('Mobile-Dep'));
		await createTask(page, uniqueTitle('Mobile-Dep-Quelle'));
		await page.reload();
		await waitForStableView(page);

		await openTasksTab(page);
		await page.getByRole('button', { name: 'Abhängigkeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Abhängigkeiten/ })).toBeVisible();
		await waitForStableView(page);

		// Der Gewichts-Slider ist sichtbar …
		await expect(page.locator('input[type="range"][min="0.1"][max="1"][step="0.1"]')).toBeVisible();

		// … ohne einen horizontalen Overflow zu erzeugen.
		const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
		expect(noOverflow).toBe(true);
	});
});
