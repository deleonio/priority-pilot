import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #537 „Aufgabenliste auf Blatt-Aufgaben beschränken". Die `TaskTree`-
 * Komponente (#238/#363) stellt heute den **invertierten Aufgabenwald** dar: Blatt-Tasks liegen
 * zwar oben, jeder Knoten mit (semantischen) Eltern trägt aber einen **Aufklappschalter**
 * (`task-tree-toggle`), über den sich die Oberaufgabe aufklappen lässt. Gewünscht ist stattdessen
 * eine **flache Liste ausschließlich der Blatt-Aufgaben** (`dependents.length === 0`) — ohne
 * Baumstruktur, ohne Aufklappfunktionalität, sortiert nach Wertbeitrag (absteigend).
 *
 * Backend-Vertrag (`GET /forest`) bleibt unverändert (Oberaufgaben = Wurzeln, `dependents` =
 * Unteraufgaben); die Filterung auf Blätter erfolgt clientseitig auf dem originalen Wald
 * (nicht auf dem invertierten). Diese Specs kodieren die **neue** flache Liste und sind **rot**,
 * bis `TaskTree.tsx` umgebaut ist.
 *
 * **DOM-Vertrag (neu, vorwärtsgerichtet — AK6 „.task-tree → .task-list"):**
 *  - Container: `data-testid="task-list"`
 *  - Eintrag:   `data-testid="task-list-item-{id}"`
 *
 * Wie `task-tree.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy). Der
 * Baum-Aufbau erfolgt über die API: eine Unteraufgabe wird als Abhängigkeit modelliert — das Kind
 * ist der **Vorgänger** der Eltern-Aufgabe (`POST /tasks/{parentId}/dependencies` mit
 * `{ dependingTaskId: childId }`, #336). Im Wald (`GET /forest`) erscheint das Kind als
 * `dependents`-Eintrag des Elternteils; nur das Kind ist ein Blatt (`dependents.length === 0`).
 *
 * `afterEach` räumt alle Tasks über die echte API ab, damit jeder Test vom leeren Zustand startet.
 */
test.describe('Priority Pilot — Aufgabenliste als flache Blatt-Liste (#537)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `Flat ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt einen Task über die echte API an und liefert seine ID zurück. */
	const createTask = async (page: Page, title: string, priority = 3, estimatedEffort = 1): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority, estimatedEffort },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
	};

	/**
	 * Verknüpft `childId` als Unteraufgabe von `parentId` — das Kind wird zum Vorgänger der
	 * Eltern-Aufgabe und taucht im Wald unter `parent.dependents` auf (nur das Kind ist ein Blatt).
	 */
	const addSubtask = async (page: Page, parentId: number, childId: number): Promise<void> => {
		const response = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
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

	/** Wurzelcontainer der neuen flachen Liste. */
	const list = (page: Page) => page.getByTestId('task-list');

	/** Ein Listeneintrag, verankert über `data-testid="task-list-item-<id>"`. */
	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	test('AK1/T1: Liste zeigt ausschließlich Blatt-Aufgaben — Eltern-Task ist nicht sichtbar', async ({ page }) => {
		const parentTitle = uniqueTitle('Eltern');
		const childTitle = uniqueTitle('Blatt');
		const parentId = await createTask(page, parentTitle);
		const childId = await createTask(page, childTitle);
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(list(page)).toBeVisible();

		// Das Blatt (Kind) ist sichtbar …
		await expect(item(page, childId)).toBeVisible();
		await expect(item(page, childId)).toContainText(childTitle);

		// … die Nicht-Blatt-Oberaufgabe hingegen wird in der Aufgabenliste NICHT gerendert.
		await expect(item(page, parentId)).toHaveCount(0);
		await expect(page.getByText(parentTitle, { exact: true })).toHaveCount(0);
	});

	test('AK1/T1: Einzelaufgabe ohne Unteraufgaben ist als Blatt sichtbar', async ({ page }) => {
		const soloTitle = uniqueTitle('Solo');
		const soloId = await createTask(page, soloTitle);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(list(page)).toBeVisible();
		await expect(item(page, soloId)).toBeVisible();
		await expect(item(page, soloId)).toContainText(soloTitle);
	});

	test('AK2/T2: Kein Aufklappschalter (task-tree-toggle) im DOM — auch nicht bei ehemals gefächerten Knoten', async ({
		page,
	}) => {
		// Eltern+Kind: früher hätte der Blatt-Knoten einen Aufklapp-Symbol getragen. Jetzt: keine Toggles.
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Blatt'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(list(page)).toBeVisible();

		// Kein Aufklapp-/Zuklapp-Button irgendwo im Dokument.
		await expect(page.getByRole('button', { name: /aufklappen|zuklappen|klappen/i })).toHaveCount(0);

		// AK2/AK6: Die Baum-CSS-Strukturklassen sind ersatzlos entfernt.
		await expect(page.locator('.task-tree-toggle')).toHaveCount(0);
		await expect(page.locator('.task-tree-toggle-placeholder')).toHaveCount(0);
		await expect(page.locator('.task-tree-children')).toHaveCount(0);
	});

	test('AK7/T6: Blatt-Aufgaben sind nach Wertbeitrag absteigend sortiert', async ({ page }) => {
		// Drei Einzelaufgaben (Blätter) mit bewusst unterschiedlichen Prioritäten, sodass ihre
		// serverseitigen `value`-Beiträge voneinander abweichen (Blatt-Wert ≙ Priorität, da ohne
		// Abhängigkeiten und ohne Säulenbezug der Säulen-Faktor neutral 1 bleibt).
		const aId = await createTask(page, uniqueTitle('A'), 5, 1);
		const bId = await createTask(page, uniqueTitle('B'), 3, 0.5);
		const cId = await createTask(page, uniqueTitle('C'), 1, 0.1);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(list(page)).toBeVisible();

		// Erwartete Reihenfolge = Blätter nach `value` absteigend (aus dem Original-Wald, nicht invertiert).
		const forestResponse = await page.request.get('/api/v1/forest');
		expect(forestResponse.ok()).toBeTruthy();
		const forest = (await forestResponse.json()) as Array<{ id: number; value: number; dependents: unknown[] }>;
		const leavesById = new Map<number, number>();
		const collect = (nodes: typeof forest): void => {
			for (const n of nodes) {
				if ((n.dependents ?? []).length === 0) leavesById.set(n.id, n.value);
				collect(n.dependents as typeof forest);
			}
		};
		collect(forest);

		const expected = [aId, bId, cId]
			.filter((id) => leavesById.has(id))
			.sort((x, y) => (leavesById.get(y) ?? 0) - (leavesById.get(x) ?? 0));

		// DOM-Reihenfolge der sichtbaren Listeneinträge entspricht der Wert-Sortierung.
		const domIds = await list(page)
			.locator('[data-testid]')
			.evaluateAll((els) =>
				els
					.map((el) => el.getAttribute('data-testid') ?? '')
					.filter((t) => t.startsWith('task-list-item-'))
					.map((t) => Number(t.replace('task-list-item-', ''))),
			);
		expect(domIds).toEqual(expected);
	});

	test('AK5/T3: Titelfilter arbeitet auf der flachen Blatt-Liste', async ({ page }) => {
		const keepTitle = uniqueTitle('Sichtbar-Treffer');
		const hideTitle = uniqueTitle('Versteckt-KeinTreffer');
		const keepId = await createTask(page, keepTitle);
		const hideId = await createTask(page, hideTitle);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(list(page)).toBeVisible();
		await expect(item(page, keepId)).toBeVisible();

		// Filtern nach dem einen Titel …
		await page.getByPlaceholder('Nach Titel filtern…').fill('Sichtbar-Treffer');
		await page.getByRole('button', { name: 'Filtern' }).click();
		await waitForStableView(page);

		// … lässt nur den treffenden Blatt-Eintrag, der andere verschwindet (flach, ohne Kontextpfad).
		// Hinweis: die App behält ausgefilterte Items im DOM (nur CSS-versteckt), daher ist eine
		// Sichtbarkeits-Assertion korrekter als ein DOM-count (vgl. tasks-tab-filter.spec.ts).
		await expect(item(page, keepId)).toBeVisible();
		await expect(item(page, hideId)).not.toBeVisible();
	});

	test('T5: Flache Blatt-Liste ist auf 360 px ohne horizontalen Überlauf lesbar', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 800 });

		const aTitle = uniqueTitle('Mobil-A');
		const bTitle = uniqueTitle('Mobil-B');
		await createTask(page, aTitle);
		await createTask(page, bTitle);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(list(page)).toBeVisible();
		await expect(page.getByText(aTitle, { exact: true })).toBeVisible();

		// Kein horizontaler Überlauf: die Liste ragt nicht über die Viewport-Breite hinaus.
		const overflowsHorizontally = await page.evaluate(() => {
			const root = document.querySelector('[data-testid="task-list"]');
			if (root === null) return true;
			return root.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});
