import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1447 „Bearbeiten-Button in 'Nächste Aufgabe' ergänzen".
 *
 * Spec-Bezug: docs/spec/issue-1447.md — AK2 (Klick öffnet den Bearbeiten-Dialog vorausgefüllt) und
 * AK4 (mobile-first 375px, beide Buttons sichtbar/antippbar, kein Overflow). AK1/AK3 (Button-Präsenz)
 * sind als Komponententests in `Dashboard.test.tsx` abgedeckt (dedup — kein Overlap mit dieser Suite).
 * Beide Tests sind rot, bis `Dashboard.tsx` den Icon-only-Button „Bearbeiten" rendert und `App.tsx`
 * ihn über `onEditTask={openEdit}` verdrahtet.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const createTask = async (page: Page, title: string, priority: number): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', { data: { title, priority } });
	const created = (await response.json()) as { id: number };
	return created.id;
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

test.describe('#1447 „Bearbeiten"-Button im Dashboard-Signal-Panel', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK2: Klick auf „Bearbeiten" öffnet den Bearbeiten-Dialog vorausgefüllt mit der nächsten Aufgabe', async ({
		page,
	}) => {
		await createTask(page, 'E2E #1447 Nächste Aufgabe', 5);

		await openDashboard(page);
		await expect(page.locator('.dashboard-next-task-content')).toContainText('E2E #1447 Nächste Aufgabe');

		// Icon-only-Button: zugänglicher Name kommt aus `_label` (KolButton → aria-label), kein sichtbarer Text.
		await page.locator('.dashboard-next-task-content').getByRole('button', { name: 'Bearbeiten' }).click();

		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten: E2E #1447 Nächste Aufgabe/ })).toBeVisible();
		// Test-Pflege #1447: `getByLabel('Titel')` trifft vier Elemente (Mikrofon-Button, Filterfeld,
		// Titel-Input, Lektorat-Button) → strict-mode-Verletzung. Auf die Textbox-Rolle verengt,
		// Prüfabsicht (Titel vorausgefüllt) unverändert.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('E2E #1447 Nächste Aufgabe');
	});

	test('AK4: bei 375×812 sind „Erledigen" und „Bearbeiten" beide vollständig sichtbar und antippbar, kein Overflow', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createTask(page, 'E2E #1447 Mobile Layout Test Aufgabe', 5);

		await openDashboard(page);

		const doneButton = page.locator('.dashboard-next-task-content').getByRole('button', { name: 'Erledigen' });
		const editButton = page.locator('.dashboard-next-task-content').getByRole('button', { name: 'Bearbeiten' });

		await expect(doneButton).toBeVisible();
		await expect(editButton).toBeVisible();

		const viewportWidth = 375;
		for (const button of [doneButton, editButton]) {
			const box = await button.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
		}

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});
});
