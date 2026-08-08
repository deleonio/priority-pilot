// Fixture: Zwei Tests mit identischem 375px-Viewport-Setup, aber unterschiedlichen
// Assertion-Targets → dürfen NICHT als redundant gelten.
// (Regression: früher kollidierte die Body-Präfix-Signatur auf dem gemeinsamen Setup
//  und flaggte alle 375px-Tests als Duplikate.)
import { test, expect } from '@playwright/test';

test.describe('Header @375px', () => {
	test('AK5: Logo sichtbar und kein Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await expect(page.locator('header img')).toBeVisible();
	});

	test('AK6: Navigation eingeklappt', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await expect(page.locator('nav[aria-expanded="false"]')).toBeHidden();
	});
});
