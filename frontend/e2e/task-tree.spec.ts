import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter TDD-Vertrag für #238 „Aufgaben-Übersicht von Table zu List". Die bisherige `KolTableStateful`-
 * Tabelle (siehe `TaskTable.tsx`) wird im „Aufgaben"-Tab durch die noch nicht existierende
 * `TaskTree`-Komponente ersetzt: eine expandierbare Liste, in der Unteraufgaben eingeklappt sind und
 * per Aufklapp-Symbol sichtbar gemacht werden. Diese Specs prüfen ausschließlich das neue Verhalten;
 * sie sind rot, bis `TaskTree.tsx` (mit `data-testid`-Verankerung) implementiert und in `App.tsx`
 * eingebunden ist.
 *
 * Wie `crud.spec.ts` läuft dies gegen das **echte** Backend (In-Memory-DB, Vite-Proxy). Der
 * Baum-Aufbau erfolgt bewusst über die API (schneller/robuster als Klick-Choreografie): Das Backend
 * modelliert eine Unteraufgabe als Abhängigkeit — ein Kind-Task hat den Eltern-Task als Vorgänger
 * (`POST /tasks/{childId}/dependencies` mit `{ dependingTaskId: parentId }`). Im Aufgabenwald
 * (`GET /forest`) erscheint das Kind dann als `dependents`-Eintrag des Elternteils. Wurzeln des
 * Waldes sind Tasks ohne Vorgänger.
 *
 * `afterEach` räumt alle Tasks über die echte API ab, damit jeder Test vom leeren Zustand startet.
 */
test.describe('Priority Pilot — TaskTree (expandierbare Aufgaben-Liste, #238)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `Tree ${label} #${(runId += 1)}-${Date.now()}`;

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
	 * Verknüpft `childId` als Unteraufgabe von `parentId`: Der Eltern-Task wird zum Vorgänger des
	 * Kindes (`POST /tasks/{childId}/dependencies` mit `dependingTaskId = parentId`). Damit taucht das
	 * Kind im Wald unter `parent.dependents` auf.
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

	/** Der Wurzelcontainer des neuen Baums. */
	const tree = (page: Page) => page.getByTestId('task-tree');

	/**
	 * Der Listeneintrag eines Tasks im Baum. Verankert über `data-testid="task-tree-item-<id>"`, damit
	 * die Assertions unabhängig von der Wert-Sortierung des Waldes exakt einen Knoten treffen.
	 */
	const item = (page: Page, id: number) => page.getByTestId(`task-tree-item-${id}`);

	/** Das Aufklapp-/Zuklapp-Steuerelement innerhalb eines Knotens (per aria-expanded prüfbar). */
	const toggle = (page: Page, id: number) =>
		item(page, id)
			.getByRole('button', { name: /Auf|Zuklappen|klappen/i })
			.first();

	test('AK-1: Aufgabe mit Unteraufgaben zeigt ein Aufklapp-Symbol', async ({ page }) => {
		const parentTitle = uniqueTitle('Eltern');
		const parentId = await createTask(page, parentTitle);
		const childId = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(tree(page)).toBeVisible();
		await expect(item(page, parentId)).toContainText(parentTitle);
		await expect(toggle(page, parentId)).toBeVisible();
	});

	test('AK-7: Aufgabe ohne Unteraufgaben zeigt kein Aufklapp-Symbol', async ({ page }) => {
		const soloTitle = uniqueTitle('Solo');
		const soloId = await createTask(page, soloTitle);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(tree(page)).toBeVisible();
		await expect(item(page, soloId)).toContainText(soloTitle);
		await expect(item(page, soloId).getByRole('button', { name: /klappen/i })).toHaveCount(0);
	});

	test('AK-2: Aufklappen zeigt die Unteraufgaben in der Liste', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childTitle = uniqueTitle('Kind');
		const childId = await createTask(page, childTitle);
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Eingeklappter Anfangszustand: Das Kind ist noch nicht sichtbar.
		await expect(item(page, childId)).toBeHidden();

		await toggle(page, parentId).click();

		await expect(item(page, childId)).toBeVisible();
		await expect(item(page, childId)).toContainText(childTitle);
	});

	test('AK-4: Zuklappen verbirgt die Unteraufgaben wieder', async ({ page }) => {
		const parentId = await createTask(page, uniqueTitle('Eltern'));
		const childId = await createTask(page, uniqueTitle('Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await toggle(page, parentId).click();
		await expect(item(page, childId)).toBeVisible();

		await toggle(page, parentId).click();
		await expect(item(page, childId)).toBeHidden();
	});

	test('AK-3: Rekursives Aufklappen funktioniert über mehrere Ebenen', async ({ page }) => {
		const rootId = await createTask(page, uniqueTitle('Wurzel'));
		const midId = await createTask(page, uniqueTitle('Mitte'));
		const leafTitle = uniqueTitle('Blatt');
		const leafId = await createTask(page, leafTitle);
		await addSubtask(page, rootId, midId);
		await addSubtask(page, midId, leafId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		// Nur die Wurzel ist zunächst sichtbar; tiefere Ebenen sind verborgen.
		await expect(item(page, midId)).toBeHidden();
		await expect(item(page, leafId)).toBeHidden();

		await toggle(page, rootId).click();
		await expect(item(page, midId)).toBeVisible();
		// Solange die mittlere Ebene nicht aufgeklappt ist, bleibt das Blatt verborgen.
		await expect(item(page, leafId)).toBeHidden();

		await toggle(page, midId).click();
		await expect(item(page, leafId)).toBeVisible();
		await expect(item(page, leafId)).toContainText(leafTitle);
	});

	test('AK-8: Knoten-Zuordnung ist korrekt (Kind liegt unter seinem Elternteil)', async ({ page }) => {
		const parentAId = await createTask(page, uniqueTitle('Eltern-A'));
		const parentBId = await createTask(page, uniqueTitle('Eltern-B'));
		const childTitle = uniqueTitle('Kind-von-A');
		const childId = await createTask(page, childTitle);
		await addSubtask(page, parentAId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await toggle(page, parentAId).click();

		// Das Kind ist als Nachfahre von Eltern-A verschachtelt — nicht unter Eltern-B, das kein
		// Aufklapp-Symbol besitzt (keine Unteraufgaben).
		await expect(item(page, parentAId).getByTestId(`task-tree-item-${childId}`)).toBeVisible();
		await expect(item(page, parentBId).getByRole('button', { name: /klappen/i })).toHaveCount(0);
	});

	test('AK-5: Edit-Button öffnet den Dialog mit der richtigen Aufgabe', async ({ page }) => {
		const title = uniqueTitle('Bearbeitbar');
		const id = await createTask(page, title);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await item(page, id).getByRole('button', { name: 'Bearbeiten' }).click();

		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
	});

	test('AK-6: Listenansicht ist auf Mobilbreite ohne horizontales Scrollen lesbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		const parentTitle = uniqueTitle('Mobil-Eltern');
		const parentId = await createTask(page, parentTitle);
		const childId = await createTask(page, uniqueTitle('Mobil-Kind'));
		await addSubtask(page, parentId, childId);

		await page.goto('/');
		await waitForStableView(page);
		await openTasksTab(page);

		await expect(tree(page)).toBeVisible();
		await expect(item(page, parentId)).toContainText(parentTitle);

		// Kein horizontaler Überlauf: Der Baum-Container ragt nicht über die Viewport-Breite hinaus.
		const overflowsHorizontally = await page.evaluate(() => {
			const root = document.querySelector('[data-testid="task-tree"]');
			if (root === null) {
				return true;
			}
			return root.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * Roter TDD-Vertrag für #307: „Bearbeiten" wird vom separaten Button VOR der Toolbar zu einem
	 * Icon-Button und rückt als ERSTES Element in die Aktions-Toolbar (`kol-toolbar` → `[role="toolbar"]`).
	 * Der Accessible Name bleibt „Bearbeiten" (durch AK-5 oben gedeckt), aber es gibt keinen sichtbaren
	 * Klartext mehr. Diese Specs sind rot, bis `TaskTree.tsx` den Edit-Button als erstes Toolbar-Item
	 * mit `_hideLabel` rendert.
	 */
	test.describe('#307 — „Bearbeiten" als Icon-Button in der Aktions-Toolbar', () => {
		/** Die Aktions-Toolbar eines Knotens (`KolToolbar` rendert `[role="toolbar"]`). */
		const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');

		test('AK-307-1: „Bearbeiten" ist das erste Element der Aktions-Toolbar', async ({ page }) => {
			const title = uniqueTitle('Toolbar-Edit');
			const id = await createTask(page, title);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Die Toolbar existiert und ihr erster Button ist „Bearbeiten" (vor Abhängigkeiten/
			// Unteraufgabe/Löschen). Aktuell rot: „Bearbeiten" steht als separater Button VOR der Toolbar.
			await expect(toolbar(page, id)).toBeVisible();
			const firstButton = toolbar(page, id).getByRole('button').first();
			await expect(firstButton).toHaveAccessibleName('Bearbeiten');
		});

		test('AK-307-1b: „Bearbeiten"-Button trägt kein sichtbares Text-Label (Icon-only)', async ({ page }) => {
			const title = uniqueTitle('Icon-Edit');
			const id = await createTask(page, title);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			const editButton = toolbar(page, id).getByRole('button', { name: 'Bearbeiten' });
			await expect(editButton).toBeVisible();

			// KoliBri rendert bei `_hideLabel={true}` den Label-Text in einem `aria-hidden`-Span, damit der
			// Accessible Name erhalten bleibt, der Text aber optisch verborgen ist. Kein sichtbarer
			// Klartext „Bearbeiten" darf im Button-DOM erscheinen.
			const hasVisibleLabelText = await editButton.evaluate((el) => {
				const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				let node = walker.nextNode();
				while (node !== null) {
					const text = (node.textContent ?? '').trim();
					if (text.includes('Bearbeiten')) {
						// Prüfen, ob ein Vorfahre aria-hidden oder optisch versteckt ist.
						let ancestor: HTMLElement | null = node.parentElement;
						let hidden = false;
						while (ancestor !== null && ancestor !== el.parentElement) {
							const style = window.getComputedStyle(ancestor);
							if (
								ancestor.getAttribute('aria-hidden') === 'true' ||
								style.display === 'none' ||
								style.visibility === 'hidden' ||
								style.clip === 'rect(0px, 0px, 0px, 0px)'
							) {
								hidden = true;
								break;
							}
							ancestor = ancestor.parentElement;
						}
						if (!hidden) {
							return true;
						}
					}
					node = walker.nextNode();
				}
				return false;
			});
			expect(hasVisibleLabelText).toBe(false);
		});

		test('AK-307-5: Icon-Button „Bearbeiten" ist auf 375px in der Toolbar sichtbar', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 812 });

			const title = uniqueTitle('Mobil-Edit');
			const id = await createTask(page, title);

			await page.goto('/');
			await waitForStableView(page);
			await openTasksTab(page);

			// Der Edit-Icon-Button liegt in der Toolbar und ist auch mobil sichtbar (innerhalb des Viewports).
			const editButton = toolbar(page, id).getByRole('button', { name: 'Bearbeiten' });
			await expect(editButton).toBeVisible();

			const box = await editButton.boundingBox();
			expect(box).not.toBeNull();
			if (box !== null) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
			}
		});
	});
});
