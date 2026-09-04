import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für das Herz der Startseite (Lebensbalance).
 *
 * Nagelt bei 375×812 den Kernpunkt fest, den nur die echte Seite belegen kann: Das Herz steht als
 * erstes Widget des Dashboards, ist horizontal mittig und läuft auf Handybreite nicht über. Die
 * Segmentierung je Säule und die Rechnung prüfen die Komponenten- und Unit-Tests.
 */
test.describe('Dashboard — Herz der Lebensbalance', () => {
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

	test('steht mittig und ohne Overflow bei 375×812', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Mindestens ein Task, damit die Tab-Ansicht mit dem Dashboard-Tab erscheint.
		await page.goto('/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E Herz Balance' } });

		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		const heart = page.getByTestId('heart-balance-svg');
		await expect(heart).toBeVisible();

		// Je Säule ein Segment — ohne gepflegte Säulen gäbe es die Karte gar nicht.
		expect(await page.getByTestId('heart-column').count()).toBeGreaterThan(0);

		// Horizontal mittig: die Grafik-Mitte liegt auf der Mitte ihrer Karte (1 px Toleranz für
		// subpixelgenaues Layout).
		const card = page.locator('.dashboard-heart');
		const heartBox = await heart.boundingBox();
		const cardBox = await card.boundingBox();
		expect(heartBox).not.toBeNull();
		expect(cardBox).not.toBeNull();
		const heartCenter = heartBox!.x + heartBox!.width / 2;
		const cardCenter = cardBox!.x + cardBox!.width / 2;
		expect(Math.abs(heartCenter - cardCenter)).toBeLessThanOrEqual(1);

		// Das Herz ist das erste Widget unter der Begrüßung — es steht über den Statuskacheln.
		const cardsBox = await page.locator('.dashboard-cards').boundingBox();
		expect(cardsBox).not.toBeNull();
		expect(cardBox!.y).toBeLessThan(cardsBox!.y);

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});
});
