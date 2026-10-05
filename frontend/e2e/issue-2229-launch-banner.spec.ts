import { expect, test, type Page } from './fixtures';

/**
 * Rote Spec-e2e für #2229 (docs/spec/issue-2229.md) — AK3, AK4, AK7.
 * Der E2E-Server läuft ohne `LAUNCH_BANNER_ENABLED`; der An-Zustand kommt über die echte
 * `/auth/me`-Antwort mit gepatchtem Feld (Playwright holt sie vom Backend-Mock der Fixture und
 * ergänzt `launchBanner`).
 */
const enableBanner = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', async (route) => {
		const response = await route.fetch();
		const json = (await response.json()) as Record<string, unknown>;
		await route.fulfill({ response, json: { ...json, launchBanner: true } });
	});
};

test.describe('Balamentum — #2229: Einladungs-Banner', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await enableBanner(page);
	});

	test('AK3: Feedback-Knopf führt zum Feedback-Formular', async ({ page }) => {
		await page.goto('/app/');
		await expect(page.getByTestId('launch-banner')).toBeVisible();
		await page.getByTestId('launch-banner-feedback').click();
		await expect(page).toHaveURL(/\/app\/hilfe\/feedback/);
	});

	test('AK4: Schließen + Reload → Banner bleibt weg', async ({ page }) => {
		await page.goto('/app/');
		await page.getByTestId('launch-banner-dismiss').click();
		await expect(page.getByTestId('launch-banner')).toHaveCount(0);
		await page.reload();
		await expect(page.locator('header').first()).toBeVisible();
		await expect(page.getByTestId('launch-banner')).toHaveCount(0);
	});

	test('AK7: 375px — keine Überlappung mit der Kopfzeile, Knöpfe mindestens 44px hoch', async ({ page }) => {
		await page.goto('/app/');
		const banner = page.getByTestId('launch-banner');
		await expect(banner).toBeVisible();
		const bannerBox = (await banner.boundingBox())!;
		const headerBox = (await page.locator('header').first().boundingBox())!;
		expect(bannerBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 0.5);
		expect(bannerBox.x).toBeGreaterThanOrEqual(0);
		expect(bannerBox.x + bannerBox.width).toBeLessThanOrEqual(375.5);
		for (const id of ['launch-banner-feedback', 'launch-banner-dismiss']) {
			const box = (await page.getByTestId(id).boundingBox())!;
			expect(box.height, id).toBeGreaterThanOrEqual(44);
		}
	});
});
