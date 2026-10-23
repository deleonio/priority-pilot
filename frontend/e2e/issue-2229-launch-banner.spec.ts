import { expect, test, type Page } from './fixtures';
import { headerAction, MOBILE } from './helpers';

/**
 * Spec-e2e für #2229/#2480 (docs/spec/issue-2229.md) — AK3, AK7; AK1/AK2 (Schließen +
 * localStorage-Dismiss, geräteweit und je Login zurückgesetzt) 2026-10-11. Der
 * E2E-Server läuft ohne `LAUNCH_BANNER_ENABLED`; der An-Zustand kommt über die echte
 * `/auth/me`-Antwort mit gepatchtem Feld (Playwright holt sie vom Backend-Mock der Fixture
 * und ergänzt `launchBanner`).
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
		await page.setViewportSize(MOBILE);
		await enableBanner(page);
	});

	test.afterEach(async ({ page }) => {
		// Laufende `route.fetch`-Callbacks beim Testende nicht als Fehler werten.
		await page.unrouteAll({ behavior: 'ignoreErrors' });
	});

	test('AK3: Feedback-Knopf führt zum Feedback-Formular', async ({ page }) => {
		await page.goto('/app/');
		await expect(page.getByTestId('launch-banner')).toBeVisible();
		await expect(page.getByTestId('launch-banner-dismiss')).toBeVisible();
		await page.getByTestId('launch-banner-feedback').click();
		await expect(page).toHaveURL(/\/app\/hilfe\/feedback/);
	});

	test('AK1/AK2 (#2480): Schließen entfernt den Banner, auch über Reload', async ({ page }) => {
		await page.goto('/app/');
		await expect(page.getByTestId('launch-banner')).toBeVisible();
		await expect(page.getByTestId('launch-banner-dismiss')).toBeVisible();
		await page.getByTestId('launch-banner-dismiss').click();
		await expect(page.getByTestId('launch-banner')).toHaveCount(0);
		await page.reload();
		await expect(page.locator('header').first()).toBeVisible();
		await expect(page.getByTestId('launch-banner')).toHaveCount(0);
	});

	test('#2480: Abmelden setzt das Schließen zurück (Banner erscheint nach dem nächsten Login wieder)', async ({
		page,
	}) => {
		await page.route('**/auth/logout', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
		);
		await page.goto('/app/');
		await page.getByTestId('launch-banner-dismiss').click();
		await expect(page.getByTestId('launch-banner')).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => localStorage.getItem('pp-launch-banner-dismissed'))).toBe('1');

		// #2723: „Abmelden" liegt im Avatar-Popover — `headerAction` öffnet es vor dem Klick.
		await (await headerAction(page, /Abmelden|Logout/i)).click();
		await page.waitForURL(/\/login(\b|\/|$)/);
		expect(await page.evaluate(() => localStorage.getItem('pp-launch-banner-dismissed'))).toBeNull();
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
		const feedbackBox = (await page.getByTestId('launch-banner-feedback').boundingBox())!;
		expect(feedbackBox.height, 'launch-banner-feedback').toBeGreaterThanOrEqual(44);
		const dismissBox = (await page.getByTestId('launch-banner-dismiss').boundingBox())!;
		expect(dismissBox.height, 'launch-banner-dismiss').toBeGreaterThanOrEqual(44);
	});
});
