import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für das Herz der Startseite (Lebensbalance).
 *
 * Nagelt den Kernpunkt fest, den nur die echte Seite belegen kann: Das Herz steht als erstes Widget
 * des Dashboards, ist horizontal mittig und bleibt auf schmalen Viewports innerhalb der Seite. Die
 * Segmentierung je Säule und die Rechnung prüfen die Komponenten- und Unit-Tests.
 *
 * Die Breiten-Prüfung misst **Bounding-Boxen**, nicht `documentElement.scrollWidth`: Die App-Shell
 * clippt mit `overflow-x: hidden`, `scrollWidth` bleibt dadurch strukturell unter der Viewport-Breite
 * und eine Assertion darauf kann gar nicht fehlschlagen (Memory 2026-08-24, dort mit Mutationssonde
 * belegt). Geprüft wird zusätzlich bei 320 px, weil das Karten-Padding auf 375 px genug Überlauf
 * schluckt, um einen echten Fehler zu verstecken.
 */
test.describe('Dashboard — Herz der Lebensbalance', () => {
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	/** Bringt das Dashboard mit mindestens einem Task in den Blick (sonst fehlt der Tab). */
	const openDashboard = async (page: Page): Promise<void> => {
		await page.goto('/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E Herz Balance' } });

		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('steht als erstes Widget und mittig in seiner Karte (375×812)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);

		const heart = page.getByTestId('heart-balance-svg');
		await expect(heart).toBeVisible();

		// Je Säule ein Farbstreifen — ohne gepflegte Säulen gäbe es die Karte gar nicht.
		expect(await page.getByTestId('heart-column').count()).toBeGreaterThan(0);

		// Horizontal mittig: die Grafik-Mitte liegt auf der Mitte ihrer Karte (1 px Toleranz für
		// subpixelgenaues Layout).
		const heartBox = await heart.boundingBox();
		const cardBox = await page.locator('.dashboard-heart').boundingBox();
		expect(heartBox).not.toBeNull();
		expect(cardBox).not.toBeNull();
		const heartCenter = heartBox!.x + heartBox!.width / 2;
		const cardCenter = cardBox!.x + cardBox!.width / 2;
		expect(Math.abs(heartCenter - cardCenter)).toBeLessThanOrEqual(1);

		// Das Herz ist das erste Widget unter der Begrüßung — es steht über den Statuskacheln.
		const cardsBox = await page.locator('.dashboard-cards').boundingBox();
		expect(cardsBox).not.toBeNull();
		expect(cardBox!.y).toBeLessThan(cardsBox!.y);
	});

	// Die Grafik rendert mit `overflow: visible`, der Puls skaliert über die Viewbox hinaus und der
	// Wellenpfad steht seitlich über die Zeichenfläche — genau die Kombination, die auf schmalen
	// Geräten überläuft, wenn eine Breite einmal absolut statt relativ gesetzt wird.
	for (const width of [375, 320]) {
		test(`bleibt bei ${width} px innerhalb der Seitenbreite`, async ({ page }) => {
			await page.setViewportSize({ width, height: 812 });
			await openDashboard(page);

			await expect(page.getByTestId('heart-balance-svg')).toBeVisible();

			for (const selector of ['.dashboard-heart', '.heart-balance-stage', '.heart-balance-legend']) {
				const box = await page.locator(selector).boundingBox();
				expect(box, `${selector} hat keine Bounding-Box`).not.toBeNull();
				expect(box!.x, `${selector} ragt links aus der Seite`).toBeGreaterThanOrEqual(-1);
				expect(box!.x + box!.width, `${selector} ragt rechts aus der Seite`).toBeLessThanOrEqual(width + 1);
			}
		});
	}
});
