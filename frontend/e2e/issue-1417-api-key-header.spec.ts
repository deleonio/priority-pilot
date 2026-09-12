import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1417 (Spec docs/spec/issue-1417.md) — Hinweisblock nennt den `api-key`-Header.
 *
 * - AK9: bei 375px Viewportbreite bleibt jede Zeile des Hinweisblocks `api-tokens__mcp-url`
 *   ohne horizontalen Überlauf sichtbar (Bounding-Box-Assertion statt `scrollWidth`, MEMORY
 *   2026-08-24/#1352 — die App-Shell clippt mit `overflow-x: hidden`).
 *
 * Läuft gegen das echte Backend (Vite-Proxy), Session über `POST /auth/test-login`
 * (Muster issue-1352-api-tokens.spec.ts).
 */

const TEST_EMAIL = 'api-key-header@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Api Key Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
};

test.describe('Priority Pilot — #1417: api-key-Header im Hinweisblock', () => {
	test('AK9: 375px — jede Zeile des Hinweisblocks bleibt ohne horizontalen Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const hint = page.locator('.api-tokens__mcp-url');
		await expect(hint).toBeVisible();

		const lines = hint.locator('span');
		const count = await lines.count();
		expect(count, 'Hinweisblock muss mehrere Zeilen enthalten').toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const box = await lines.nth(i).boundingBox();
			expect(box, `Zeile ${i} muss eine Bounding-Box haben`).not.toBeNull();
			expect(box!.x + box!.width, `Zeile ${i} darf den Viewport nicht überragen`).toBeLessThanOrEqual(375 + 1);
		}
	});

	test('AK8: der Hinweisblock nennt beide Header-Varianten', async ({ page }) => {
		await login(page);
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const hint = page.locator('.api-tokens__mcp-url');
		await expect(hint).toBeVisible();
		await expect(hint).toContainText('Authorization: Bearer');
		await expect(hint).toContainText('api-key:');
	});
});
