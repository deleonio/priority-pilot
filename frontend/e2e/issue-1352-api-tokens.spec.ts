import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1352 (Spec docs/spec/issue-1352.md) — Settings-Tab „Zugriff" (API-Tokens).
 *
 * - AK8: „Token erzeugen" zeigt den Klartext genau einmal; nach Reload sind nur noch die
 *   Metadaten (Name, Datum) sichtbar, kein Klartext mehr.
 * - AK9: bei 375px Viewportbreite ist das Panel ohne horizontalen Overflow bedienbar; der
 *   Klartext-Token bricht um statt die Seite zu verbreitern (Bounding-Box-Assertion statt
 *   `scrollWidth`, MEMORY 2026-08-24 — die App-Shell clippt mit `overflow-x: hidden`).
 *
 * Läuft gegen das echte Backend (Vite-Proxy) wie llm-settings.spec.ts; das E2E-Backend läuft im
 * Pass-Through-Auth-Modus (kein SESSION_SECRET/Allowlist), daher kein expliziter Login nötig.
 */

const deleteAllTokens = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/api-tokens');
	if (!res.ok()) return;
	for (const token of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/api-tokens/${token.id}`);
	}
};

test.describe('Priority Pilot — #1352: API-Tokens (Settings-Tab „Zugriff")', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTokens(page);
	});

	test('AK8: Klartext erscheint genau einmal, nach Reload nur noch Metadaten', async ({ page }) => {
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		const panel = page.getByTestId('api-tokens-panel');
		await expect(panel).toBeVisible();

		await page.getByRole('button', { name: 'Token erzeugen' }).click();

		const plaintext = page.getByTestId('api-token-plaintext');
		await expect(plaintext).toBeVisible();
		const tokenText = (await plaintext.textContent())?.trim() ?? '';
		expect(tokenText.length).toBeGreaterThan(10);

		await page.reload();
		await waitForStableView(page, 'Allgemein');
		await expect(page.getByTestId('api-tokens-panel')).toBeVisible();
		// Nach Reload: kein Klartext mehr, nur die Zeile mit Name/Datum.
		await expect(page.getByTestId('api-token-plaintext')).toHaveCount(0);
		await expect(page.getByTestId('api-token-row')).toHaveCount(1);
		await expect(page.getByTestId('api-token-row').first()).not.toContainText(tokenText);
	});

	test('AK9: 375px — Panel ohne horizontalen Overflow, Klartext bricht um', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		await page.getByRole('button', { name: 'Token erzeugen' }).click();
		const plaintext = page.getByTestId('api-token-plaintext');
		await expect(plaintext).toBeVisible();

		const box = await plaintext.boundingBox();
		expect(box, 'Klartext-Anzeige muss eine Bounding-Box haben').not.toBeNull();
		// Bounding-Box darf den Viewport nicht überragen (kein horizontales Scrollen, AK9).
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});
});
