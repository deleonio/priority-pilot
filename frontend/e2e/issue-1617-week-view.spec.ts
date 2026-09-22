import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1617: Wochenansicht des Tagesplans.
 * AK1: Wochenansicht zeigt alle 7 Tage mit ihren Aufgaben.
 * AK2: Aus der Wochenansicht kann man einen Tag anwählen und landet in der bestehenden Tagesansicht.
 * AK3: Manuell geplante (per Deadline datierte) Aufgaben werden dem richtigen Tag zugeordnet.
 */
test.describe('Dashboard — Wochenansicht (#1617)', () => {
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

	test('AK1/AK3: zeigt 7 Tageskarten, eine mit Deadline heute datierte Aufgabe erscheint genau einmal', async ({
		page,
	}) => {
		const todayIso = new Date().toISOString().slice(0, 10);
		await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #1617 Wochenaufgabe', deadline: todayIso },
		});

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Wochenansicht' }).click();

		const dayCards = page.locator('.week-view-day');
		await expect(dayCards).toHaveCount(7);

		// Die Aufgabe erscheint unter genau einem Wochentag (dem heutigen).
		await expect(page.locator('.week-view-day', { hasText: 'E2E #1617 Wochenaufgabe' })).toHaveCount(1);
	});

	test('AK2: ein Klick auf „Tag öffnen" führt zur bestehenden Tagesansicht zurück', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Wochenansicht' }).click();
		await expect(page.locator('.week-view-grid')).toBeVisible();

		await page.getByRole('button', { name: 'Tag öffnen' }).first().click();

		await expect(page.locator('.week-view-grid')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible();
	});
});
