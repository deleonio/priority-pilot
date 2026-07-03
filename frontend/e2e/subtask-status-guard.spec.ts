import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #246 „Unteraufgaben-Done-Guard" (AK3 + AK4, End-to-End).
 *
 * Hat ein Task mindestens eine offene direkte Unteraufgabe, darf er im Bearbeiten-Dialog nicht auf
 * „Erledigt" gesetzt werden: die Option „Erledigt" ist im Status-Feld nicht wählbar (fehlt oder ist
 * deaktiviert), und ein Hinweis erklärt den Grund. Ohne offene Unteraufgaben bleibt „Erledigt" normal
 * wählbar.
 *
 * Wie `task-tree.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy). Der
 * Baum-Aufbau erfolgt über die API: eine Unteraufgabe ist eine Abhängigkeit — der Kind-Task hat den
 * Eltern-Task als Vorgänger (`POST /tasks/{childId}/dependencies` mit `{ dependingTaskId: parentId }`).
 * `afterEach` räumt alle Tasks ab, damit jeder Test vom leeren Zustand startet.
 *
 * Diese Specs sind rot, bis das Status-Feld die „Erledigt"-Option bei offenen Unteraufgaben
 * ausblendet/deaktiviert und den Hinweistext rendert.
 */
test.describe('Priority Pilot — Unteraufgaben-Done-Guard (#246)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Guard ${label} #${(runId += 1)}-${Date.now()}`;

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
	 * Verknüpft `childId` als Unteraufgabe von `parentId`: der Eltern-Task wird zum Vorgänger des
	 * Kindes. Damit erscheint das Kind im Wald unter `parent.dependents`.
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${childId}/dependencies`, {
			data: { dependingTaskId: parentId },
		});
		expect(response.ok()).toBeTruthy();
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

	/** Öffnet den Bearbeiten-Dialog des Tasks mit `id` und wartet, bis er sichtbar/stabil ist. */
	const openEditDialog = async (page: Page, id: number): Promise<void> => {
		await item(page, id).getByRole('button', { name: 'Bearbeiten' }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
	};

	test('AK3: mit offener Unteraufgabe ist „Erledigt" im Status-Feld nicht wählbar', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind-offen'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await openEditDialog(page, parentId);

		// Status-Listbox öffnen und prüfen, dass „Erledigt" fehlt oder deaktiviert ist.
		await page.getByLabel('Status').click();
		const doneOption = page.getByRole('option', { name: 'Erledigt' });
		const count = await doneOption.count();
		if (count > 0) {
			await expect(doneOption).toBeDisabled();
		} else {
			expect(count).toBe(0);
		}
	});

	test('AK4: bei blockiertem „Erledigt" ist ein erklärender Hinweis sichtbar', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind-offen'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await openEditDialog(page, parentId);

		// Der Dialog weist auf die offenen Unteraufgaben als Grund hin.
		await expect(page.getByTestId('subtask-done-hint')).toBeVisible();
	});

	test('AK3 negativ: ohne Unteraufgaben ist „Erledigt" normal wählbar', async ({ page }) => {
		const soloId = await createTask(page, uniqueTitle('Solo'));

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await openEditDialog(page, soloId);

		await page.getByLabel('Status').click();
		const doneOption = page.getByRole('option', { name: 'Erledigt' });
		await expect(doneOption).toBeVisible();
		await expect(doneOption).toBeEnabled();
	});

	test('AK3/AK4 Mobil: Hint und Status-Dropdown bei 375 px nutzbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const parentId = await createTask(page, uniqueTitle('Eltern-Mobil'));
		const childId = await createTask(page, uniqueTitle('Kind-Mobil'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await openEditDialog(page, parentId);

		const overflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(overflow).toBe(true);

		await expect(page.getByTestId('subtask-done-hint')).toBeVisible();
	});
});
