import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #315 „Binärer Erledigt-Toggle in der Aufgaben-Liste" (AK1, AK2, AK4, E2E).
 *
 * Jede Zeile im `TaskTree` erhält einen binären Toggle, der den Status Open↔Done schaltet
 * (`PATCH /tasks/{id}`) und nach Reload persistiert (AK1). Hat eine Aufgabe mindestens eine offene
 * direkte Unteraufgabe, ist der Toggle gesperrt (`disabled`) und sein (per `_hideLabel` visuell
 * verborgener, aber zugänglicher) Label-Text erklärt den Grund (AK2); sind alle Unteraufgaben Done,
 * ist der Toggle wieder aktiv. Der Toggle ist auf Mobilbreite (375×812) ohne horizontales Scrollen
 * bedienbar (AK4).
 *
 * Wie `task-tree.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy). Der
 * Baum-Aufbau erfolgt über die API — exakt wie `TaskForm.tsx`: eine Unteraufgabe ist der **Vorgänger**
 * der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit `{ dependingTaskId: childId }`, #336).
 * `afterEach` räumt alle Tasks ab, damit jeder Test vom leeren Zustand startet.
 *
 * `data-testid`-Konventionen (legt der Implementierer an):
 * - `done-toggle-{id}` — der binäre Toggle-Button pro Aufgabe; im gesperrten Zustand enthält sein
 *   zugänglicher Name auch den Sperrgrund (Assertion via `toHaveAccessibleName`).
 *
 * Diese Specs sind rot, bis `TaskTree.tsx` den Toggle rendert, `PATCH /tasks/{id}` auslöst und den
 * #246-Guard auf den Toggle anwendet.
 */
test.describe('Priority Pilot — Erledigt-Toggle in der Aufgaben-Liste (#315)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Toggle ${label} #${(runId += 1)}-${Date.now()}`;

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/**
	 * Verknüpft `childId` als Unteraufgabe von `parentId` — exakt wie `TaskForm.tsx`: das Kind wird zum
	 * **Vorgänger** der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit
	 * `dependingTaskId = childId`, #336). Damit erscheint das Kind im Wald unter `parent.dependents`.
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
		expect(response.ok()).toBeTruthy();
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

	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	/** Die Aktions-Toolbar eines Knotens (`KolToolbar` rendert `[role="toolbar"]`), im „…"-Popover verborgen. */
	const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');

	/** Der Erledigt-Toggle liegt jetzt als erstes Toolbar-Item hinter dem „…"-Popover (#387). */
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

		// Der Toggle liegt jetzt hinter dem „…"-Popover (#387) — erst öffnen.
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

	test('AK2: bei offener direkter Unteraufgabe ist der Toggle gesperrt und ein Hinweis sichtbar', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind-offen'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Im invertierten Baum ist childId die Wurzel — parentId (Oberaufgabe) muss erst aufgeklappt werden.
		await expect(item(page, childId)).toBeVisible();
		await item(page, childId)
			.getByRole('button', { name: /klappen/i })
			.first()
			.click();
		await expect(item(page, parentId)).toBeVisible();

		// Der Toggle liegt hinter dem „…"-Popover (#387) — erst öffnen.
		await openActionsPopover(page, parentId);

		// #246-Guard auf den Toggle angewendet: gesperrt + erklärender Grund im zugänglichen Namen.
		await expect(doneToggle(page, parentId)).toBeDisabled();
		await expect(doneToggle(page, parentId)).toHaveAccessibleName(/bitte erst alle Unteraufgaben erledigen/i);

		// Der gesperrte Toggle darf den Status nicht ändern.
		expect(await fetchStatus(page, parentId)).toBe('Open');
	});

	test('AK2: sind alle direkten Unteraufgaben Done, ist der Toggle wieder aktiv', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Im invertierten Baum ist childId die Wurzel — Unteraufgabe über ihr „…"-Popover (#387) erledigen.
		await expect(item(page, childId)).toBeVisible();
		await openActionsPopover(page, childId);
		await doneToggle(page, childId).click();
		await expect.poll(async () => fetchStatus(page, childId)).toBe('Done');

		// Oberaufgabe aufklappen (childId als Wurzel expandieren).
		await item(page, childId)
			.getByRole('button', { name: /klappen/i })
			.first()
			.click();
		await expect(item(page, parentId)).toBeVisible();

		// Toggle der Oberaufgabe hinter dem „…"-Popover öffnen (#387).
		await openActionsPopover(page, parentId);

		// Mit ausschließlich erledigten Unteraufgaben ist der Eltern-Toggle aktiv und ohne Sperrgrund im Namen.
		await expect(doneToggle(page, parentId)).toBeEnabled();
		await expect(doneToggle(page, parentId)).toHaveAccessibleName('Erledigt');

		// Und er lässt sich nun betätigen.
		await doneToggle(page, parentId).click();
		await expect.poll(async () => fetchStatus(page, parentId)).toBe('Done');
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
});

/**
 * Roter TDD-Vertrag für #387 „Mobile Ansicht der Aufgabenliste kompakter (Erledigt-Schalter in die
 * Toolbar)". Der binäre Erledigt-Toggle (`done-toggle-{id}`) wandert aus der direkt sichtbaren Zeile
 * (`.task-tree-row-controls`) als **erstes** Element in die bestehende Aktions-Toolbar (`KolToolbar` →
 * `[role="toolbar"]`), die hinter dem „…"-Popover liegt (#361/#307). Der Toggle ist also erst nach
 * `openActionsPopover` erreichbar; sein zugänglicher Name bleibt „Erledigt" bzw. „Wieder öffnen"
 * (gesperrt: der Sperrgrund, #315/#246).
 *
 * Locator-Konvention (analog zum Edit-Icon-Button aus #307):
 * - Toolbar eines Knotens: `item(page, id).locator('[role="toolbar"]')`,
 * - Erledigt-Toggle in der Toolbar: `toolbar(page, id).getByRole('button', { name: /Erledigt|Wieder öffnen/i })`.
 *
 * Verhalten (PATCH/Persistenz/Guard) und Backend-Anbindung bleiben unverändert zum bisherigen Vertrag
 * (#315) — nur die **Platzierung** wechselt ins Popover. Diese Specs sind rot, bis `TaskTree.tsx` den
 * Toggle als erstes Toolbar-Item ins „…"-Popover verschiebt.
 */
test.describe('#387 — Erledigt-Toggle in der „…"-Toolbar', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Toolbar-Toggle ${label} #${(runId += 1)}-${Date.now()}`;

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

	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	/** Das Aufklapp-/Zuklapp-Steuerelement eines Knotens (bleibt direkt sichtbar in der Zeile). */
	const expandToggle = (page: Page, id: number) =>
		item(page, id)
			.getByRole('button', { name: /Auf|Zuklappen|klappen/i })
			.first();

	/** Die Aktions-Toolbar eines Knotens (`KolToolbar` rendert `[role="toolbar"]`), im Popover verborgen. */
	const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');

	/** Der Erledigt-Toggle liegt jetzt als erstes Toolbar-Item hinter dem „…"-Popover. */
	const doneToggle = (page: Page, id: number) =>
		toolbar(page, id).getByRole('button', { name: /Erledigt|Wieder öffnen/i });

	/** Öffnet das „Weitere Aktionen"-Popover („…") eines Knotens (#361). */
	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
	};

	test('AK1: der Toggle ist vor Öffnen des Popovers nicht direkt sichtbar, danach in der Toolbar', async ({ page }) => {
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

	test('AK2: Popover öffnen → Klick schaltet Open→Done, PATCH persistiert und übersteht Reload', async ({ page }) => {
		const id = await createTask(page, uniqueTitle('Erledigt'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Ausgangslage: die frisch angelegte Aufgabe ist offen.
		expect(await fetchStatus(page, id)).toBe('Open');

		await openActionsPopover(page, id);
		await doneToggle(page, id).click();

		// PATCH /tasks/{id} hat den Status persistiert.
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// Persistenz nach Reload: Status bleibt „Done".
		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);
		expect(await fetchStatus(page, id)).toBe('Done');

		// Und der Toggle im Popover schaltet zurück auf Open.
		await openActionsPopover(page, id);
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Open');
	});

	test('AK3: bei offener direkter Unteraufgabe ist der Toolbar-Toggle gesperrt', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind-offen'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Im invertierten Baum (#363) ist childId die Wurzel — Oberaufgabe (parentId) aufklappen.
		await expect(item(page, childId)).toBeVisible();
		await expandToggle(page, childId).click();
		await expect(item(page, parentId)).toBeVisible();

		// Popover öffnen: der Erledigt-Toggle ist das erste Toolbar-Item und wegen offener Unteraufgabe
		// gesperrt; sein zugänglicher Name nennt den Sperrgrund (#246/#315-Guard, weiterhin gültig).
		await openActionsPopover(page, parentId);
		const firstButton = toolbar(page, parentId).getByRole('button').first();
		await expect(firstButton).toBeDisabled();
		await expect(firstButton).toHaveAccessibleName(/bitte erst alle Unteraufgaben erledigen/i);

		// Der gesperrte Toggle darf den Status nicht ändern.
		expect(await fetchStatus(page, parentId)).toBe('Open');
	});

	test('AK3: sind alle direkten Unteraufgaben Done, ist der Toolbar-Toggle wieder aktiv', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Unteraufgabe (childId = Wurzel) über ihr Popover erledigen.
		await expect(item(page, childId)).toBeVisible();
		await openActionsPopover(page, childId);
		await doneToggle(page, childId).click();
		await expect.poll(async () => fetchStatus(page, childId)).toBe('Done');

		// Oberaufgabe aufklappen und deren Popover öffnen.
		await expandToggle(page, childId).click();
		await expect(item(page, parentId)).toBeVisible();
		await openActionsPopover(page, parentId);

		// Mit ausschließlich erledigten Unteraufgaben ist der Eltern-Toggle aktiv und ohne Sperrgrund.
		const firstButton = toolbar(page, parentId).getByRole('button').first();
		await expect(firstButton).toBeEnabled();
		await expect(firstButton).toHaveAccessibleName(/Erledigt|Wieder öffnen/i);

		// Und er lässt sich nun betätigen.
		await doneToggle(page, parentId).click();
		await expect.poll(async () => fetchStatus(page, parentId)).toBe('Done');
	});

	test('AK4: der Toggle ist nach Öffnen des Popovers auf 360px ohne horizontalen Überlauf bedienbar', async ({
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
