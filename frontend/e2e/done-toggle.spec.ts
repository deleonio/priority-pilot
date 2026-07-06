import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #315 „Binärer Erledigt-Toggle in der Aufgaben-Liste" (AK1, AK2, AK4, E2E).
 *
 * Jede Zeile im `TaskTree` erhält einen binären Toggle, der den Status Open↔Done schaltet
 * (`PATCH /tasks/{id}`) und nach Reload persistiert (AK1). Hat eine Aufgabe mindestens eine offene
 * direkte Unteraufgabe, ist der Toggle gesperrt (`disabled`) und ein Hinweis erklärt den Grund
 * (AK2); sind alle Unteraufgaben Done, ist der Toggle wieder aktiv. Der Toggle ist auf Mobilbreite
 * (375×812) ohne horizontales Scrollen bedienbar (AK4).
 *
 * Wie `task-tree.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy). Der
 * Baum-Aufbau erfolgt über die API — exakt wie `TaskForm.tsx`: eine Unteraufgabe ist der **Vorgänger**
 * der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit `{ dependingTaskId: childId }`, #336).
 * `afterEach` räumt alle Tasks ab, damit jeder Test vom leeren Zustand startet.
 *
 * `data-testid`-Konventionen (legt der Implementierer an):
 * - `done-toggle-{id}`      — der binäre Toggle-Button pro Aufgabe
 * - `done-blocked-hint-{id}` — der Hinweis-Text bei gesperrtem Toggle
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
	const doneToggle = (page: Page, id: number) => page.getByTestId(`done-toggle-${id}`);
	const doneBlockedHint = (page: Page, id: number) => page.getByTestId(`done-blocked-hint-${id}`);

	test('AK1: Toggle schaltet Open→Done, PATCH persistiert und übersteht Reload', async ({ page }) => {
		const id = await createTask(page, uniqueTitle('Erledigen'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(item(page, id)).toBeVisible();
		await expect(doneToggle(page, id)).toBeVisible();

		// Ausgangslage: die frisch angelegte Aufgabe ist offen.
		expect(await fetchStatus(page, id)).toBe('Open');

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

		// Erst auf Done schalten …
		await doneToggle(page, id).click();
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');

		// … dann wieder zurück auf Open.
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

		await expect(item(page, parentId)).toBeVisible();

		// #246-Guard auf den Toggle angewendet: gesperrt + erklärender Hinweis.
		await expect(doneToggle(page, parentId)).toBeDisabled();
		await expect(doneBlockedHint(page, parentId)).toBeVisible();

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

		// Unteraufgabe aufklappen und erledigen.
		await item(page, parentId)
			.getByRole('button', { name: /klappen/i })
			.first()
			.click();
		await expect(item(page, childId)).toBeVisible();
		await doneToggle(page, childId).click();
		await expect.poll(async () => fetchStatus(page, childId)).toBe('Done');

		// Mit ausschließlich erledigten Unteraufgaben ist der Eltern-Toggle aktiv und ohne Hinweis.
		await expect(doneToggle(page, parentId)).toBeEnabled();
		await expect(doneBlockedHint(page, parentId)).toHaveCount(0);

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
