import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-e2e für #241 — „Fortschrittsanzeige pro Task inkl. Unter-Tasks" gegen das echte Backend.
 *
 * Vertrag: Im Aufgabenwald (`TaskTree`, #238) zeigt jeder Task mit Sub-Tasks einen Fortschritt
 * „erledigt/gesamt" (der Task selbst zählt mit), berechnet über den kompletten Teilbaum seiner
 * Abhängigen. Tasks ohne Sub-Tasks zeigen keinen Fortschritt.
 *
 * Setup wie in `suggestions.spec.ts`: Tasks und Abhängigkeiten werden über die echte API (Vite-Proxy
 * → Backend) geseedet. Eine Unteraufgabe wird — exakt wie `TaskForm.tsx` — als **Vorgänger** der
 * Eltern-Aufgabe angelegt (`POST /tasks/{parentId}/dependencies { dependingTaskId: childId }`, #336);
 * im Aufgabenwald erscheint das Kind dann als Sub-Task (`dependents`-Eintrag) des Elternteils.
 */
test.describe('Fortschrittsanzeige pro Task (#241)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `PROG ${label} #${(runId += 1)}-${Date.now()}`;

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

	/** Legt einen Task über die echte API an und liefert dessen ID zurück. */
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/**
	 * Macht `childId` zur Unteraufgabe von `parentId` — exakt wie `TaskForm.tsx`: das Kind wird zum
	 * **Vorgänger** der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit
	 * `dependingTaskId = childId`, #336). Im Wald erscheint das Kind als Sub-Task unter `parent`.
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
	};

	/** Wechselt auf den „Aufgaben"-Tab (der Aufgabenwald liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/** Der Listeneintrag eines Tasks im Baum, verankert über `data-testid="task-tree-item-<id>"`. */
	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	test('AK1: Task mit zwei Sub-Tasks zeigt „0/3"', async ({ page }) => {
		const titelA = uniqueTitle('A');
		const idA = await createTask(page, titelA);
		const idB = await createTask(page, uniqueTitle('B'));
		const idC = await createTask(page, uniqueTitle('C'));
		// B und C sind Unteraufgaben von A.
		await addSubtask(page, idA, idB);
		await addSubtask(page, idA, idC);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Im invertierten Baum (#363) sind B und C Wurzeln; A erscheint als aufklappbares Kind unter
		// jeder — deshalb genau einen Sub-Task (B) aufklappen und den A-Knoten darunter prüfen.
		await expect(item(page, idB)).toBeVisible();
		await item(page, idB)
			.getByRole('button', { name: /klappen/i })
			.first()
			.click();
		const aUnderB = item(page, idB).getByTestId(`task-tree-item-${idA}`);
		await expect(aUnderB).toBeVisible();

		// A + 2 Sub-Tasks = 3 Tasks, keiner erledigt → „0/3" im Knoten von A.
		await expect(aUnderB.getByText('0/3')).toBeVisible();
	});

	test('AK3: Task ohne Sub-Tasks zeigt keinen Fortschritt (keine 1/1-Anzeige)', async ({ page }) => {
		const titelSolo = uniqueTitle('Solo');
		const idSolo = await createTask(page, titelSolo);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		const node = item(page, idSolo);
		await expect(node).toBeVisible();
		// Kein redundanter Fortschrittswert für eine Aufgabe ohne Abhängige.
		await expect(node.getByText('1/1')).toHaveCount(0);
	});

	test('AK4: Fortschritt aktualisiert sich nach Statusänderung eines Sub-Tasks', async ({ page }) => {
		const titelA = uniqueTitle('A');
		const idA = await createTask(page, titelA);
		const idB = await createTask(page, uniqueTitle('B'));
		// B ist Unteraufgabe von A → A + 1 Sub-Task = 2 Tasks, keiner erledigt → „0/2".
		await addSubtask(page, idA, idB);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Im invertierten Baum (#363) ist B die Wurzel; A erst durch Aufklappen von B sichtbar machen.
		await expect(item(page, idB)).toBeVisible();
		await item(page, idB)
			.getByRole('button', { name: /klappen/i })
			.first()
			.click();
		await expect(item(page, idB).getByTestId(`task-tree-item-${idA}`).getByText('0/2')).toBeVisible();

		// B über die echte API auf „Erledigt" setzen.
		await page.request.patch(`/api/v1/tasks/${idB}`, { data: { status: 'Done' } });

		// Nach dem Reload: Die erledigte Unteraufgabe B verschwindet aus dem Baum (#392), A rückt als
		// neue Wurzel nach. Der Fortschritt (#241) zählt B serverseitig aber weiter (`node.progress`
		// über die ungefilterte Abhängigkeitskette) → A zeigt aktualisiert „1/2", obwohl B nicht mehr
		// sichtbar ist. Genau dieser Schnittpunkt #392 ∩ #241 wird hier abgesichert.
		await page.reload();
		await waitForStableView(page);
		await openTasksTab(page);

		// B ist ausgeblendet …
		await expect(item(page, idB)).toHaveCount(0);
		// … A ist jetzt selbst Wurzel und zeigt den aktualisierten Fortschritt „1/2".
		await expect(item(page, idA)).toBeVisible();
		await expect(item(page, idA).getByText('1/2')).toBeVisible();
	});

	test('AK5: Fortschrittsanzeige ist auf mobilen Viewports (375px) sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		const titelA = uniqueTitle('A');
		const idA = await createTask(page, titelA);
		const idB = await createTask(page, uniqueTitle('B'));
		// B ist Unteraufgabe von A → A + 1 Sub-Task = 2 Tasks gesamt.
		await addSubtask(page, idA, idB);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Im invertierten Baum (#363) ist B die Wurzel; A erst durch Aufklappen von B sichtbar machen.
		await expect(item(page, idB)).toBeVisible();
		await item(page, idB)
			.getByRole('button', { name: /klappen/i })
			.first()
			.click();

		// Fortschrittsanzeige muss auch auf 375px-Viewport ohne horizontales Scrollen sichtbar sein.
		await expect(item(page, idB).getByTestId(`task-tree-item-${idA}`).getByText('0/2')).toBeVisible();
	});
});
