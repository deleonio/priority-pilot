import { expect, test } from '@playwright/test';

/**
 * #1976 (Vertrag: docs/spec/issue-1976.md) — Vorlagen-Seiten: Übersicht → Vorlage, Checkliste und
 * App-Link sichtbar, kein horizontaler Überlauf (Bounding-Box statt scrollWidth, App-Shell clippt).
 */
test.describe('Vorlagen (#1976)', () => {
	test('Übersicht lädt, Klick öffnet eine Vorlage mit Checkliste und App-Link', async ({ page }) => {
		const response = await page.goto('/vorlagen/');
		expect(response?.status(), '/vorlagen/ muss 200 liefern (build.ts schreibt die Seite)').toBe(200);
		const links = page.locator('main a[href^="/vorlagen/"]');
		expect(await links.count()).toBeGreaterThanOrEqual(6);
		const href = await links.first().getAttribute('href');
		await links.first().click();
		await expect(page).toHaveURL(new RegExp(`${href}$`));
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('ol > li').first()).toBeVisible();
		await expect(page.locator('a[href="/app/"]').first()).toBeVisible();
	});

	test('Vorlagen-Seite läuft nicht horizontal über', async ({ page }) => {
		await page.goto('/vorlagen/');
		const href = await page.locator('main a[href^="/vorlagen/"]').first().getAttribute('href');
		await page.goto(href ?? '/vorlagen/');
		const viewport = page.viewportSize()?.width ?? 375;
		const elements = await page.locator('main h1, main h2, main p, main li, main a').all();
		expect(elements.length, 'Seite muss sichtbaren Inhalt haben').toBeGreaterThan(5);
		for (const element of elements) {
			const box = await element.boundingBox();
			if (!box) continue;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(viewport + 1);
		}
	});
});
