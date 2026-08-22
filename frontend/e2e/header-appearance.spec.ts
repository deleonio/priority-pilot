import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Tests für den App-Header
 */
test.describe('#222 App-Header — Homogenität', () => {
	test('AK1: E-Mail-Adresse ist im App-Header nicht sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Die gemockte E-Mail darf nicht mehr im DOM vorhanden sein
		await expect(page.getByText('test@example.com')).not.toBeAttached();
	});
});

/**
 * Tests für Header-Layout und -Größe
 */
test.describe('#485 Header — Layout und Größe', () => {
	/** Toleranz für Rundungen der Layout-Engine (Sub-Pixel). */
	const TOLERANCE_PX = 2;

	/**
	 * Liest die Boundingboxen der Header-Elemente: Logo und Toolbar-Button
	 */
	const readHeaderBoxes = async (page: import('@playwright/test').Page) => {
		const header = page.getByRole('banner');
		const logoImg = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		const toolbarBtn = header.getByRole('toolbar', { name: /Kopf-Aktionen/i }).getByRole('button', {
			name: 'Neuen Task anlegen',
		});

		await expect(logoImg).toBeVisible();
		await expect(toolbarBtn).toBeVisible();

		const [headerBox, logoBox, buttonBox] = await Promise.all([
			header.boundingBox(),
			logoImg.boundingBox(),
			toolbarBtn.boundingBox(),
		]);

		expect(headerBox, 'Header muss eine Boundingbox haben').not.toBeNull();
		expect(logoBox, 'Logo-Bild muss eine Boundingbox haben').not.toBeNull();
		expect(buttonBox, 'Toolbar-Button muss eine Boundingbox haben').not.toBeNull();

		return { header: headerBox!, logo: logoBox!, button: buttonBox! };
	};

	test('AK3: Toolbar-Button = 1,25 × Header-Bezugshöhe', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { button } = await readHeaderBoxes(page);

		// Toolbar-Button sollte 44px (2.75rem) sein
		expect(button.height).toBeCloseTo(44, TOLERANCE_PX);
	});

	test('AK4: Logo, Toolbar-Button teilen sich eine Mittellinie (≥768px)', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { logo, button } = await readHeaderBoxes(page);

		const centerOf = (box: { y: number; height: number }): number => box.y + box.height / 2;
		const spread = Math.abs(centerOf(logo) - centerOf(button));

		expect(spread).toBeLessThanOrEqual(TOLERANCE_PX);
	});

	test('AK4: Header bleibt einzeilig (kein Umbruch) bei 1024px', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto('/');
		await waitForStableView(page);

		const { header, logo } = await readHeaderBoxes(page);

		expect(header.height).toBeLessThan(logo.height * 2);
	});

	test('AK6: Header-Elemente bleiben bei 375px sichtbar und bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoImg = header.getByRole('button', { name: /Zum Dashboard/i }).locator('img');
		const toolbarBtn = header
			.getByRole('toolbar', { name: /Kopf-Aktionen/i })
			.getByRole('button', { name: 'Neuen Task anlegen' });

		await expect(logoImg).toBeVisible();
		await expect(toolbarBtn).toBeVisible();

		// Bedienbar: Der Logo-Button reagiert weiterhin auf einen Klick
		await header.getByRole('button', { name: /Zum Dashboard/i }).click();
		await expect(page.getByRole('tab', { name: /Dashboard/i })).toHaveAttribute('aria-selected', 'true');
	});
});
