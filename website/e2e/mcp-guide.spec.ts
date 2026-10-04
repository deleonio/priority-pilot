import { expect, test } from '@playwright/test';

/**
 * #1978 (Vertrag: docs/spec/issue-1978.md) — MCP-Anleitungsseite in DE (/mcp/) und EN (/en/mcp/),
 * Mobile-First: kein horizontaler Überlauf bei 375 px (Bounding-Box-Prüfung, die App-Shell clippt
 * mit overflow-x: hidden — scrollWidth bleibt strukturell klein).
 */
test.describe('MCP-Anleitung (#1978)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	const contentSelector =
		'section.section h1, section.section h2, section.section p, section.section li, section.section code, section.section pre';

	async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
		const viewport = page.viewportSize()?.width ?? 375;
		const elements = await page.locator(contentSelector).all();
		expect(elements.length, 'Seite muss sichtbaren Inhalt haben').toBeGreaterThan(5);
		for (const element of elements) {
			const box = await element.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(viewport + 1);
		}
	}

	test('deutsche Seite /mcp/ lädt mit Endpunkt, Token-Schritt, Paketgrenzen und Prompts', async ({ page }) => {
		const response = await page.goto('/mcp/');
		expect(response?.status(), '/mcp/ muss 200 liefern (build.ts schreibt die Seite)').toBe(200);
		await expect(page.locator('h1').first()).toBeVisible();
		const body = await page.locator('body').textContent();
		expect(body).toContain('/mcp/v1');
		expect(body).toMatch(/API-?Tokens?/);
		expect(body).toContain('Plus');
		expect(body).toContain('Pro');
		expect(body).toContain('Frag deine Balance');
		expect(body).toContain('Plane meine Woche nach meiner Balance');
		await expect(page.locator('a[href*="claude.ai"]').first()).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});

	test('englische Seite /en/mcp/ lädt mit Endpunkt und Anbindung beider Anbieter', async ({ page }) => {
		const response = await page.goto('/en/mcp/');
		expect(response?.status(), '/en/mcp/ muss 200 liefern (build.ts schreibt die Seite)').toBe(200);
		await expect(page.locator('h1').first()).toBeVisible();
		const body = await page.locator('body').textContent();
		expect(body).toContain('/mcp/v1');
		expect(body).toMatch(/API-?Tokens?/);
		expect(body).toContain('ChatGPT');
		await expectNoHorizontalOverflow(page);
	});
});
