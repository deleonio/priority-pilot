import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-e2e für #241 — „Fortschrittsanzeige pro Task inkl. Unter-Tasks" gegen das echte Backend.
 *
 * Vertrag: Ein Task mit Sub-Tasks führt serverseitig einen Fortschritt „erledigt/gesamt" (der Task
 * selbst zählt mit), berechnet über den kompletten Teilbaum seiner Abhängigen. Tasks ohne Sub-Tasks
 * haben keinen Fortschritt. Der Fortschritt ist über `GET /forest` in `node.progress` verfügbar.
 *
 * Seit #537 zeigt der Aufgaben-Tab (Tab 1) nur noch **Blatt-Aufgaben** als flache Liste — Eltern-
 * Tasks mit Sub-Tasks erscheinen dort nicht mehr und tragen somit auch keinen Fortschritts-Badge.
 * Die Fortschritts-Logik selbst (Server-seitige Berechnung über `node.progress`) ist hiervon
 * unberührt und wird in diesen Specs über `GET /forest` verifiziert. Blatt-Tasks ohne Unteraufgaben
 * zeigen erwartungsgemäß keinen Fortschritt (weder in der UI noch in der API).
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

	/** Wechselt auf den „Aufgaben"-Tab (die flache Blatt-Liste liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/** Der Listeneintrag eines Tasks, verankert über `data-testid="task-list-item-<id>"` (#537). */
	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	/**
	 * Sucht einen Task-Knoten im `/forest`-Wald (inkl. aller `dependents`) anhand seiner ID und gibt
	 * seinen Fortschritt `{ done, total }` zurück bzw. `null`, wenn der Knoten nicht gefunden wurde.
	 */
	const findProgress = async (page: Page, id: number): Promise<{ done: number; total: number } | null> => {
		const response = await page.request.get('/api/v1/forest');
		const forest = (await response.json()) as Array<{
			id: number;
			progress?: { done: number; total: number };
			dependents: unknown[];
		}>;
		const search = (nodes: typeof forest): { done: number; total: number } | null => {
			for (const node of nodes) {
				if (node.id === id) return node.progress ?? null;
				const found = search(node.dependents as typeof forest);
				if (found) return found;
			}
			return null;
		};
		return search(forest);
	};

	test('AK1: Eltern-Task mit zwei Sub-Tasks führt serverseitig Fortschritt „0/3" (über GET /forest)', async ({
		page,
	}) => {
		const titelA = uniqueTitle('A');
		const idA = await createTask(page, titelA);
		const idB = await createTask(page, uniqueTitle('B'));
		const idC = await createTask(page, uniqueTitle('C'));
		// B und C sind Unteraufgaben von A.
		await addSubtask(page, idA, idB);
		await addSubtask(page, idA, idC);

		await page.goto('/');
		await waitForStableView(page);

		// A + 2 Sub-Tasks = 3 Tasks, keiner erledigt → Fortschritt „0/3" serverseitig (node.progress).
		// Seit #537 erscheinen Eltern-Tasks mit Sub-Tasks nicht mehr in der flachen Blatt-Liste (Tab 1);
		// der Fortschritt bleibt aber über GET /forest verfügbar und korrekt.
		const progress = await findProgress(page, idA);
		expect(progress).toEqual({ done: 0, total: 3 });
	});

	test('AK3: Blatt-Task ohne Sub-Tasks zeigt keinen Fortschritt in der UI (keine 1/1-Anzeige)', async ({ page }) => {
		const titelSolo = uniqueTitle('Solo');
		const idSolo = await createTask(page, titelSolo);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		const node = item(page, idSolo);
		await expect(node).toBeVisible();
		// Kein redundanter Fortschrittswert für eine Blatt-Aufgabe ohne Abhängige.
		await expect(node.getByText('1/1')).toHaveCount(0);
	});

	test('AK4: Fortschritt aktualisiert sich nach Statusänderung eines Sub-Tasks (über GET /forest)', async ({
		page,
	}) => {
		const titelA = uniqueTitle('A');
		const idA = await createTask(page, titelA);
		const idB = await createTask(page, uniqueTitle('B'));
		// B ist Unteraufgabe von A → A + 1 Sub-Task = 2 Tasks, keiner erledigt → „0/2".
		await addSubtask(page, idA, idB);

		await page.goto('/');
		await waitForStableView(page);

		// Initial: 0/2.
		expect(await findProgress(page, idA)).toEqual({ done: 0, total: 2 });

		// B über die echte API auf „Erledigt" setzen.
		await page.request.patch(`/api/v1/tasks/${idB}`, { data: { status: 'Done' } });

		// Nach dem Reload: der Fortschritt (#241) zählt B serverseitig weiter (`node.progress`
		// über die ungefilterte Abhängigkeitskette) → A zeigt aktualisiert „1/2".
		await page.reload();
		await waitForStableView(page);
		expect(await findProgress(page, idA)).toEqual({ done: 1, total: 2 });
	});

	test('AK5: Blatt-Liste ist auf mobilen Viewports (375px) ohne horizontalen Überlauf sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		const titelSolo = uniqueTitle('Solo');
		const idSolo = await createTask(page, titelSolo);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Blatt-Liste muss auch auf 375px-Viewport ohne horizontales Scrollen sichtbar sein.
		await expect(item(page, idSolo)).toBeVisible();
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});
});
