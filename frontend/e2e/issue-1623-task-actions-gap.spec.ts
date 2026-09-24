import { expect, test, type Page } from './fixtures';
import { waitForStableView, waitForStableBox } from './helpers';

/**
 * E2E-Vertrag für den Abstand zwischen den Aktions-Buttons im „Weitere Aktionen"-Popover
 * der Aufgabenzeile bei 375px (#1623, K2 aus #1504-UX-Wochenblick, dreimal unverändert
 * gemeldet).
 *
 * Vertrag (docs/spec/issue-1623.md):
 * - AK1: je zwei in Lesereihenfolge benachbarte Toolbar-Buttons haben horizontalen
 *   Abstand `next.x - (prev.x + prev.width) >= 8`.
 * - AK2: jeder der sechs Buttons ist >= 44x44px und liegt vollständig im 375px-Viewport
 *   (`x >= 0`, `x + width <= 375`).
 *
 * K1 (Access-Token-Karte, Fehler+Leer-Widerspruch) ist NICHT Teil dieses Vertrags — #1646.
 * Kopf-Toolbar (AK3) und Lösch-Bestätigung (AK4) sind Regressions-Bestand
 * (mobile-shell.spec.ts, header-toolbar.spec.ts, crud.spec.ts) — keine neuen Tests.
 */
test.describe('Balamentum — Abstand im „…"-Menü der Aufgabenliste (#1623)', () => {
	test.use({ viewport: { width: 375, height: 667 } });

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

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);

	/** Öffnet das „Weitere Aktionen"-Popover einer Aufgabe (#361-Muster, issue-1186). */
	const openActionsPopover = async (page: Page, id: number): Promise<void> => {
		await item(page, id)
			.getByRole('button', { name: /Weitere Aktionen/i })
			.click();
		await expect(item(page, id).locator('[role="toolbar"]')).toBeVisible();
	};

	/** Vermisst alle sechs Aktions-Buttons im geöffneten Popover in Reihenfolge. */
	const measureToolbarButtonBoxes = async (
		page: Page,
		id: number,
	): Promise<{ x: number; y: number; width: number; height: number }[]> => {
		const buttons = await item(page, id).locator('[role="toolbar"]').getByRole('button').all();
		const boxes: { x: number; y: number; width: number; height: number }[] = [];
		for (const button of buttons) {
			await waitForStableBox(page, button);
			const box = await button.boundingBox();
			expect(box, 'jeder Aktions-Button muss nach dem Öffnen eine Bounding-Box haben').not.toBeNull();
			boxes.push(box!);
		}
		return boxes;
	};

	test('AK1: benachbarte Aktions-Buttons haben >= 8px horizontalen Abstand (375px)', async ({ page }) => {
		const id = await createTask(page, 'Actions Gap #1623');

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, id)).toBeVisible();

		await openActionsPopover(page, id);

		const boxes = await measureToolbarButtonBoxes(page, id);
		expect(boxes.length, 'das Popover muss genau die 6 dokumentierten Aktionen zeigen').toBe(6);

		for (let i = 1; i < boxes.length; i++) {
			const prev = boxes[i - 1];
			const next = boxes[i];
			const gap = next.x - (prev.x + prev.width);
			expect(
				gap,
				`Abstand zwischen Button ${i - 1} und ${i} muss >= 8px sein (gemessen: ${gap}px)`,
			).toBeGreaterThanOrEqual(8);
		}
	});

	test('AK2: jeder Aktions-Button ist >= 44x44px und liegt vollständig im 375px-Viewport', async ({ page }) => {
		const id = await createTask(page, 'Actions Bounds #1623');

		await page.goto('/app/');
		await waitForStableView(page);
		await openTasksTab(page);
		await expect(item(page, id)).toBeVisible();

		await openActionsPopover(page, id);

		const boxes = await measureToolbarButtonBoxes(page, id);
		expect(boxes.length, 'das Popover muss genau die 6 dokumentierten Aktionen zeigen').toBe(6);

		for (const box of boxes) {
			expect(box.width, `Button-Breite muss >= 44px sein (gemessen: ${box.width})`).toBeGreaterThanOrEqual(44);
			expect(box.height, `Button-Höhe muss >= 44px sein (gemessen: ${box.height})`).toBeGreaterThanOrEqual(44);
			expect(box.x, `Button darf nicht links aus dem Viewport ragen (x=${box.x})`).toBeGreaterThanOrEqual(0);
			expect(
				box.x + box.width,
				`Button darf nicht rechts aus dem 375px-Viewport ragen (x+width=${box.x + box.width})`,
			).toBeLessThanOrEqual(375);
		}
	});
});
