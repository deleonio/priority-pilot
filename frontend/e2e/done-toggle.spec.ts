import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für den binären Erledigt-Toggle (#315 / #387) in der **flachen Blatt-Liste** (#537).
 *
 * Die Aufgabenliste (Tab 1) zeigt seit #537 ausschließlich Blatt-Aufgaben (`dependents.length === 0`)
 * als flache Liste — ohne Baumstruktur und ohne Aufklappfunktionalität. Jeder Blatt-Eintrag trägt
 * hinter einem „…"-Popover (#361) eine Aktions-Toolbar (#387), deren erstes Element der binäre
 * Toggle ist, der den Status Open↔Done schaltet (`PATCH /tasks/{id}`) und nach Reload persistiert.
 *
 * Blatt-Aufgaben haben per Definition keine Unteraufgaben → der frühere Guard (#315/#246 — „gesperrt
 * bei offener Unteraufgabe") greift hier nicht mehr. Die Guard-Logik selbst (`isDoneBlockedBySubtasks`)
 * bleibt als Funktion erhalten und ist durch Unit-Tests (`task-done-toggle.test.ts`) vollständig
 * abgedeckt; sie wird nur in der Aufgabenliste nicht mehr aktiv, da nur Blätter (ohne Unteraufgaben)
 * angezeigt werden.
 *
 * Wie die übrigen Specs läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy).
 * `afterEach` räumt alle Tasks ab, damit jeder Test vom leeren Zustand startet.
 *
 * `data-testid`-Konventionen:
 * - `task-list-item-{id}` — Listen-Eintrag pro Blatt-Aufgabe (#537).
 * - `done-toggle-{id}` — der binäre Toggle-Button pro Aufgabe (im Popover).
 */
test.describe('Priority Pilot — Erledigt-Toggle in der flachen Blatt-Liste (#315 / #387)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `Toggle ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/** Liest den aktuellen Status einer Aufgabe direkt aus der API (für Persistenz-Assertions). */
	const fetchStatus = async (page: Page, id: number): Promise<string> => {
		const response = await page.request.get(`/api/v1/tasks/${id}`);
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { status: string };
		return task.status;
	};

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

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	/** Die Aktions-Toolbar eines Knotens (`KolToolbar` rendert `[role="toolbar"]`), im „…"-Popover verborgen. */
	const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');

	/** Der Erledigt-Toggle liegt als erstes Toolbar-Item hinter dem „…"-Popover (#387). */
	const doneToggle = (page: Page, id: number) =>
		toolbar(page, id).getByRole('button', { name: /Erledigt|Wieder öffnen/i });

	/** Öffnet das „Weitere Aktionen"-Popover („…") eines Knotens (#361). */
	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	test('AK1: Toggle schaltet Open→Done, PATCH persistiert und übersteht Reload', async ({ page }) => {
		const id = await createTask(page, uniqueTitle('Erledigt'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, id)).toBeVisible();

		// Ausgangslage: die frisch angelegte Aufgabe ist offen.
		expect(await fetchStatus(page, id)).toBe('Open');

		// Der Toggle liegt hinter dem „…"-Popover (#387) — erst öffnen.
		await openActionsPopover(page, id);
		await expect(doneToggle(page, id)).toBeVisible();
		await doneToggle(page, id).click();

		// PATCH /tasks/{id} hat den Status persistiert.
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// Persistenz nach Reload: Status bleibt „Done".
		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		expect(await fetchStatus(page, id)).toBe('Done');
	});

	test('AK1: Toggle schaltet Done→Open zurück, PATCH persistiert und übersteht Reload', async ({ page }) => {
		const id = await createTask(page, uniqueTitle('Wieder öffnen'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Erst auf Done schalten … (Toggle liegt hinter dem „…"-Popover, #387).
		await openActionsPopover(page, id);
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// … dann wieder zurück auf Open — kein Neuöffnen nötig, das Popover bleibt offen (#387).
		await expect(doneToggle(page, id)).toBeVisible();
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Open');

		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		expect(await fetchStatus(page, id)).toBe('Open');
	});

	test('AK4: der Toggle ist auf 375×812 ohne horizontales Scrollen bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const id = await createTask(page, uniqueTitle('Mobil'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Der Toggle liegt hinter dem „…"-Popover (#387) — erst öffnen.
		await openActionsPopover(page, id);
		const toggle = doneToggle(page, id);
		await expect(toggle).toBeVisible();

		// Kein horizontaler Überlauf: der Seiteninhalt ragt nicht über die Viewport-Breite hinaus.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);

		// Der Toggle liegt vollständig innerhalb des Viewports und ist betätigbar.
		const box = await toggle.boundingBox();
		expect(box).not.toBeNull();
		if (box !== null) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
		}

		await toggle.click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');
	});

	test('#387/AK1: der Toggle ist vor Öffnen des Popovers nicht direkt sichtbar, danach in der Toolbar', async ({
		page,
	}) => {
		const id = await createTask(page, uniqueTitle('Sichtbarkeit'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, id)).toBeVisible();

		// Vor dem Öffnen des „…"-Popovers ist die Toolbar — und damit der Erledigt-Toggle — verborgen.
		await expect(toolbar(page, id)).toBeHidden();
		await expect(doneToggle(page, id)).toBeHidden();

		await openActionsPopover(page, id);

		// Nach dem Öffnen liegt der Toggle als Button in der Toolbar mit Name „Erledigt"/„Wieder öffnen".
		await expect(toolbar(page, id)).toBeVisible();
		await expect(doneToggle(page, id)).toBeVisible();
	});

	test('#387/AK4: der Toggle ist nach Öffnen des Popovers auf 360px ohne horizontalen Überlauf bedienbar', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 360, height: 780 });
		const id = await createTask(page, uniqueTitle('Mobil'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await openActionsPopover(page, id);

		const toggle = doneToggle(page, id);
		await expect(toggle).toBeVisible();

		// Kein horizontaler Überlauf: der Seiteninhalt ragt nicht über die Viewport-Breite hinaus.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);

		// Der Toggle liegt vollständig innerhalb des Viewports und ist betätigbar.
		const box = await toggle.boundingBox();
		expect(box).not.toBeNull();
		if (box !== null) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(360 + 1);
		}

		await toggle.click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');
	});
});
