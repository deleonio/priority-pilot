import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote E2E-Specs für #1346 — AK7: Bearbeiten-Dialog nennt die Task-ID im Titel (`(#<id>)`), bleibt
 * bei 375px frei von horizontalem Überlauf; der Löschen-Dialog nennt die ID ebenfalls.
 *
 * Spezifikation: `docs/spec/issue-1346.md`. Läuft gegen das echte Backend (Muster `crud.spec.ts`).
 */
test.describe('Priority Pilot — Task-ID in Bearbeiten-/Löschen-Dialog (#1346, AK7)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

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

	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	test('Bearbeiten-Dialog: Titel enthält „(#<id>)", kein horizontaler Überlauf bei 375px', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTaskViaUi(page, 'E2E #1346 Bearbeiten');
		await openTasksTab(page);
		await expect(page.getByText('E2E #1346 Bearbeiten', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		const heading = page.getByRole('heading', { name: /Aufgabe bearbeiten: E2E #1346 Bearbeiten \(#\d+\)/ });
		await expect(heading).toBeVisible();

		const box = await heading.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		const dialogBox = await page.locator('kol-dialog').first().boundingBox();
		expect(dialogBox).not.toBeNull();
		expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(375);
	});

	test('Löschen-Dialog nennt die ID als „(#<id>)"', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTaskViaUi(page, 'E2E #1346 Löschen');
		await openTasksTab(page);
		await expect(page.getByText('E2E #1346 Löschen', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();

		await expect(page.getByText(/\(#\d+\)/)).toBeVisible();
	});
});
