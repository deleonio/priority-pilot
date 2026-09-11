import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#290): App-Version-Fußzeile in der Haupt-App.
 * AK2: Fußzeile mit contentinfo-Role ist in der authentifizierten Haupt-App sichtbar.
 * AK4: Keine horizontalen Scroll-Überlauf auf 375px Viewport.
 */

const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, displayName: 'Test User', email: 'test@example.com' }),
		}),
	);
};

test.describe('App-Version-Fußzeile (#290)', () => {
	test('AK2: Fußzeile mit App-Version ist in der Haupt-App sichtbar', async ({ page }) => {
		await mockAuthenticated(page);
		await page.goto('/');

		const footer = page.getByRole('contentinfo');
		await expect(footer).toBeVisible();
		await expect(footer).toContainText(/\d+\.\d+\.\d+/);
	});

	test('AK4: Kein horizontaler Overflow bei Viewport 375×812 (Mobile-First)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockAuthenticated(page);
		await page.goto('/');

		const footer = page.getByRole('contentinfo');
		await expect(footer).toBeVisible();

		const overflowsHorizontally = await page.evaluate(() => {
			return document.documentElement.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});
