import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1935 AK6 (Spec docs/spec/issue-1935.md) — Dialog-Vorgaben im KI-Tab bei
 * 375 px: speichern, Reload, Wert vorhanden, Bedienelemente innerhalb des Viewports
 * (Bounding-Box statt `scrollWidth`, MEMORY 2026-08-24). Eigene Session (MEMORY 2026-09-10).
 */

const TEST_EMAIL = 'mcp-instructions-1935@example.com';

test.describe('Balamentum — #1935: Dialog-Vorgaben für die KI', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('AK6: Vorgaben speichern, nach Reload sichtbar, ohne horizontalen Überlauf', async ({ page }) => {
		const res = await page.request.post('/auth/test-login', {
			data: { email: TEST_EMAIL, displayName: 'MCP Instructions Tester' },
		});
		expect(res.status()).toBe(200);

		await page.goto('/app/settings/llm');
		await waitForStableView(page, 'Allgemein');

		const input = page.getByTestId('mcp-instructions-input').locator('textarea');
		await input.fill('Antworte kurz und knapp.');
		await page.getByTestId('mcp-instructions-save').click();
		await expect(page.getByText('Dialog-Vorgaben gespeichert')).toBeVisible();

		await page.reload();
		await waitForStableView(page, 'Allgemein');
		await expect(page.getByTestId('mcp-instructions-input').locator('textarea')).toHaveValue(
			'Antworte kurz und knapp.',
		);

		for (const id of ['mcp-instructions-input', 'mcp-instructions-save']) {
			const box = await page.getByTestId(id).boundingBox();
			expect(box, `${id} sichtbar`).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
	});
});
