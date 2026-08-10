import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #392 „Aufgabenliste: abgehakte Aufgaben nach 5 s automatisch ausblenden".
 *
 * Wenn eine Aufgabe auf „Erledigt" gesetzt wird, bleibt sie 5 Sekunden lang in der Liste sichtbar
 * (optimistisches Update, Undo-Fenster) und verschwindet dann automatisch — ohne manuellen Reload.
 * Wird die Aufgabe im 5-s-Fenster per „Wieder öffnen" zurückgesetzt, bricht das den Timer ab.
 *
 * Implementierungsstellen (Kern): `handleDoneToggle` in `frontend/src/App.tsx`, Timer-Ref (Map),
 * Cleanup-`useEffect`. Benannte Konstante `DONE_REMOVAL_DELAY_MS = 5000`.
 *
 * `page.clock` (Playwright built-in) steuert `setTimeout` deterministisch — keine echten Wartezeiten.
 * Clock muss vor `page.goto()` installiert sein, damit sie App-seitige `setTimeout`-Aufrufe erfasst.
 *
 * `data-testid`-Konventionen (vom Implementierer angelegt, vgl. done-toggle.spec.ts):
 * - `task-list-item-{id}` — Listen-Eintrag pro Blatt-Aufgabe (#537).
 *
 * Diese Specs sind rot, bis `App.tsx` den 5-s-Timer in `handleDoneToggle` einbaut.
 */
test.describe('Priority Pilot — 5-s-Auto-Entfernung abgehakter Aufgaben (#392)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `AutoRemove ${label} #${(runId += 1)}-${Date.now()}`;

	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
		expect(response.ok()).toBeTruthy();
	};

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
	const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');
	const doneToggle = (page: Page, id: number) =>
		toolbar(page, id).getByRole('button', { name: /Erledigt|Wieder öffnen/i });

	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	// Barriere gegen einen Fake-Clock-Race (#392, CI-flaky): `handleDoneToggle` plant den 5-s-Entfern-
	// Timer erst NACH `await api.updateTask()` — synchron unmittelbar nach dem optimistischen Update, das
	// den Toggle auf „Wieder öffnen" umschaltet. Erst dann darf `page.clock.fastForward(5000)` feuern,
	// sonst spult die Uhr in langsamen Umgebungen vor, bevor der Timer überhaupt existiert → er wird auf
	// „jetzt + 5 s" gelegt und feuert nie (Zeile bleibt sichtbar). `expect.poll` bestätigt nur den
	// Server-Stand, nicht den geplanten Client-Timer — deshalb zusätzlich auf den umgeschalteten Toggle
	// warten.
	const expectMarkedDoneInUi = async (page: Page, id: number): Promise<void> => {
		await expect(toolbar(page, id).getByRole('button', { name: /Wieder öffnen/i })).toBeVisible();
	};

	test('AK1: Karenzzeit — Aufgabe bleibt nach Abhaken zunächst sichtbar (< 5 s)', async ({ page }) => {
		// Clock vor goto installieren, damit App-seitige setTimeout-Aufrufe kontrollierbar sind.
		await page.clock.install();

		const id = await createTask(page, uniqueTitle('Karenzzeit'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, id)).toBeVisible();

		// Abhaken: Popover öffnen und Toggle klicken.
		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		// PATCH muss persistiert haben.
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');
		await expectMarkedDoneInUi(page, id);

		// Nach 4 Sekunden ist die Aufgabe noch sichtbar — kein automatisches Entfernen vor Ablauf.
		await page.clock.fastForward(4000);
		await expect(item(page, id)).toBeVisible();
	});

	test('AK2: Automatisches Entfernen nach 5 s — blockierte Oberaufgabe rückt als verfügbare Wurzel nach', async ({
		page,
	}) => {
		await page.clock.install();

		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind'));
		// Kind ist Vorgänger (Unteraufgabe) des Elternteils — Elternteil ist blockiert.
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// In der flachen Blatt-Liste (#537) ist nur childId ein Blatt (parentId hat eine Unteraufgabe).
		await expect(item(page, childId)).toBeVisible();

		// Unteraufgabe abhaken.
		await openActionsPopover(page, childId);
		await doneToggle(page, childId).click();
		await expect.poll(async () => fetchStatus(page, childId)).toBe('Done');
		await expectMarkedDoneInUi(page, childId);

		// 5 Sekunden vergehen → automatischer reload(), erledigte Aufgabe fällt aus GET /forest heraus.
		await page.clock.fastForward(5000);

		// Die erledigte Unteraufgabe ist nun aus der Liste entfernt.
		await expect(item(page, childId)).not.toBeVisible();

		// Die ehemals blockierte Oberaufgabe ist nun selbst ein Blatt (keine offenen Unteraufgaben
		// mehr) und erscheint deshalb in der flachen Liste.
		await expect(item(page, parentId)).toBeVisible();

		// Ihr Erledigt-Toggle ist aktiv (keine offenen Unteraufgaben mehr).
		await openActionsPopover(page, parentId);
		await expect(doneToggle(page, parentId)).toBeEnabled();
	});

	test('AK3: Undo im 5-s-Fenster bricht den automatischen Entferntimer ab', async ({ page }) => {
		await page.clock.install();

		const id = await createTask(page, uniqueTitle('Undo'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, id)).toBeVisible();

		// Abhaken.
		await openActionsPopover(page, id);
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');
		await expectMarkedDoneInUi(page, id);

		// 2 Sekunden später: noch im Fenster → „Wieder öffnen" klicken.
		await page.clock.fastForward(2000);
		await expect(doneToggle(page, id)).toBeVisible();
		await doneToggle(page, id).click();

		// Status ist wieder Open.
		await expect.poll(async () => fetchStatus(page, id)).toBe('Open');

		// Weitere 5 Sekunden vergehen — kein verspätetes Entfernen; die Aufgabe bleibt sichtbar.
		await page.clock.fastForward(5000);
		await expect(item(page, id)).toBeVisible();
	});

	test('AK4: Mobile (375×812) — Aufgabe wird nach 5 s entfernt, kein horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.clock.install();

		const id = await createTask(page, uniqueTitle('Mobil'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, id)).toBeVisible();

		// Kein horizontaler Überlauf vor dem Abhaken.
		const overflowBefore = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
		expect(overflowBefore).toBe(false);

		// Abhaken.
		await openActionsPopover(page, id);
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');
		await expectMarkedDoneInUi(page, id);

		// 5 Sekunden → automatisches Entfernen.
		await page.clock.fastForward(5000);

		// Aufgabe aus der Liste verschwunden.
		await expect(item(page, id)).not.toBeVisible();

		// Kein horizontaler Überlauf nach dem Entfernen.
		const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
		expect(overflowAfter).toBe(false);
	});
});
