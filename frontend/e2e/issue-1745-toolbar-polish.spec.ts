import { expect, test, type Locator, type Page } from './fixtures';
import { waitForStableView, waitForStableBox } from './helpers';

/**
 * E2E-Vertrag für das Design-Polish der Task-Aktions-Toolbar (#1745).
 *
 * Vertrag (docs/spec/issue-1745.md):
 * - AK2: horizontaler Abstand zwischen letztem Icon-Knopf des Popover-Panels und dem
 *   „…"-Trigger-Knopf == 8px (±1px) und == gemessenem Icon-zu-Icon-Abstand (±1px).
 *   Das Panel liegt dank `_popoverAlign="left"` links neben dem Trigger
 *   (popoverAlign.ts) — Messung über Bounding-Boxen.
 * - AK3: computed border-radius und border-width des „…"-Knopfs == Werte eines
 *   Toolbar-Aktions-Knopfs (je ±1px).
 * - AK4: AK2/AK3 bei 375px wiederholt, alle Buttons + Trigger vollständig im Viewport.
 *
 * Icon-Abstände (>= 8px), 44x44px-Touch-Targets und Viewport-Grenzen der Icons deckt
 * bereits issue-1623-task-actions-gap.spec.ts ab — hier nicht dupliziert.
 */
test.describe('Balamentum — Design-Polish Task-Aktions-Toolbar (#1745)', () => {
	const createTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, estimatedEffort: 1 },
		});
		expect(response.ok()).toBeTruthy();
		const task = (await response.json()) as { id: number };
		return task.id;
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

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	/** Task anlegen, Aufgaben-Tab öffnen, Popover „Weitere Aktionen" öffnen (#1623-Muster). */
	const openActionsPopover = async (page: Page, title: string): Promise<number> => {
		const id = await createTask(page, title);
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(item(page, id)).toBeVisible();
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
		await expect(item(page, id).locator('[role="toolbar"]')).toBeVisible();
		return id;
	};

	/** Der „…"-Trigger-Knopf in der Zeile (bleibt beim Öffnen des Panels stehen). */
	const moreButton = (page: Page, id: number) => item(page, id).getByRole('button', { name: /Weitere Aktionen/i });

	type Box = { x: number; y: number; width: number; height: number };

	/** Vermisst die sechs Aktions-Buttons im geöffneten Popover in Reihenfolge (#1623-Muster). */
	const measureToolbarButtonBoxes = async (page: Page, id: number): Promise<Box[]> => {
		const buttons = await item(page, id).locator('[role="toolbar"]').getByRole('button').all();
		const boxes: Box[] = [];
		for (const button of buttons) {
			await waitForStableBox(page, button);
			const box = await button.boundingBox();
			expect(box, 'jeder Aktions-Button muss nach dem Öffnen eine Bounding-Box haben').not.toBeNull();
			boxes.push(box!);
		}
		return boxes;
	};

	const measureMoreButtonBox = async (page: Page, id: number): Promise<Box> => {
		const trigger = moreButton(page, id);
		await waitForStableBox(page, trigger);
		const box = await trigger.boundingBox();
		expect(box, 'der „…"-Knopf muss eine Bounding-Box haben').not.toBeNull();
		return box!;
	};

	/** AK2-Messung: Abstand Panel-Icon-Gruppe → „…"-Knopf gegen Icon-Abstand. */
	const expectGapBeforeMoreButton = async (page: Page, id: number): Promise<void> => {
		const boxes = await measureToolbarButtonBoxes(page, id);
		expect(boxes.length, 'das Popover muss genau die 6 dokumentierten Aktionen zeigen').toBe(6);
		const moreBox = await measureMoreButtonBox(page, id);

		const iconGap = boxes[1].x - (boxes[0].x + boxes[0].width);
		const gapBeforeMore = moreBox.x - (boxes[5].x + boxes[5].width);
		expect(
			Math.abs(gapBeforeMore - 8),
			`Abstand vor dem „…"-Knopf muss 8px sein (gemessen: ${gapBeforeMore}px)`,
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(gapBeforeMore - iconGap),
			`Abstand vor dem „…"-Knopf (${gapBeforeMore}px) muss dem Icon-Abstand (${iconGap}px) entsprechen`,
		).toBeLessThanOrEqual(1);
	};

	/** AK3-Messung: computed border-radius/border-width des „…"-Knopfs gegen einen Aktions-Knopf. */
	const expectMoreButtonMatchesActionStyle = async (page: Page, id: number): Promise<void> => {
		const readStyle = (locator: Locator) =>
			locator.evaluate((el) => {
				const style = getComputedStyle(el);
				return { radius: parseFloat(style.borderRadius), borderWidth: parseFloat(style.borderWidth) };
			});

		const actionButton = item(page, id).locator('[role="toolbar"]').getByRole('button').nth(1);
		await expect(actionButton).toBeVisible();
		const more = await readStyle(moreButton(page, id));
		const action = await readStyle(actionButton);

		expect(
			Math.abs(more.radius - action.radius),
			`border-radius des „…"-Knopfs (${more.radius}px) muss dem Aktions-Knopf (${action.radius}px) entsprechen`,
		).toBeLessThanOrEqual(1);
		expect(
			Math.abs(more.borderWidth - action.borderWidth),
			`border-width des „…"-Knopfs (${more.borderWidth}px) muss dem Aktions-Knopf (${action.borderWidth}px) entsprechen`,
		).toBeLessThanOrEqual(1);
	};

	test.describe('Desktop (1280px)', () => {
		test.use({ viewport: { width: 1280, height: 900 } });

		test('AK2: Abstand Icon-Gruppe → „…"-Knopf entspricht dem 8px-Icon-Abstand', async ({ page }) => {
			const id = await openActionsPopover(page, 'Toolbar Polish #1745');
			await expectGapBeforeMoreButton(page, id);
		});

		test('AK3: „…"-Knopf hat Radius und Randstärke der Aktions-Knöpfe', async ({ page }) => {
			const id = await openActionsPopover(page, 'Toolbar Polish Style #1745');
			await expectMoreButtonMatchesActionStyle(page, id);
		});
	});

	test.describe('Mobile (375px)', () => {
		test.use({ viewport: { width: 375, height: 667 } });

		test('AK4: AK2-Messung bei 375px ohne horizontalen Overflow', async ({ page }) => {
			const id = await openActionsPopover(page, 'Toolbar Polish Mobile #1745');
			await expectGapBeforeMoreButton(page, id);

			const boxes = [...(await measureToolbarButtonBoxes(page, id)), await measureMoreButtonBox(page, id)];
			for (const box of boxes) {
				expect(box.x, `Knopf darf nicht links aus dem Viewport ragen (x=${box.x})`).toBeGreaterThanOrEqual(0);
				expect(
					box.x + box.width,
					`Knopf darf nicht rechts aus dem 375px-Viewport ragen (x+width=${box.x + box.width})`,
				).toBeLessThanOrEqual(375);
			}
		});

		test('AK4: AK3-Messung bei 375px', async ({ page }) => {
			const id = await openActionsPopover(page, 'Toolbar Polish Mobile Style #1745');
			await expectMoreButtonMatchesActionStyle(page, id);
		});
	});
});
