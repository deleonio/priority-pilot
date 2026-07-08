import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #390: Dashboard zeigt genau drei Statuskacheln (Gesamt, Offen, Erledigt);
 * die Kachel „In Bearbeitung" ist entfernt. Bei Mobilbreite 375×812 passen alle drei Kacheln
 * ohne horizontalen Overflow in eine Reihe (AK3, Mobile-First).
 */
test.describe('Dashboard — drei Statuskacheln (Issue #390)', () => {
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

	test('AK3: genau drei Kacheln bei 375×812, kein horizontaler Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Mindestens ein Task anlegen, damit die Tab-Ansicht (inkl. Dashboard-Tab) erscheint.
		await page.goto('/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #390 Kachel-Test' } });

		await page.reload();
		await waitForStableView(page);

		// Zum Dashboard-Tab wechseln.
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		// Genau drei Kacheln sichtbar (Gesamt, Offen, Erledigt).
		await expect(page.locator('.dashboard-cards > li')).toHaveCount(3);

		// Keine InProcess-Akzentkachel vorhanden.
		await expect(page.locator('.dashboard-cards .dashboard-card-accent.inprocess')).toHaveCount(0);

		// Kein horizontaler Overflow bei 375 px.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});
});
