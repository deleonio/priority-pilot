import { expect, test } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2414 (AK1, AK3, AK7) — Vorlage blendet Felder ohne Wirkung aus.
 * Vertrag: docs/spec/issue-2414.md. Echtes Backend, 375 px, eigene Session (Shard-DB).
 */
test.describe('Balamentum — Serien-Vorlage blendet Felder aus (#2414)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('AK1/AK3/AK7 — Schalter aus/an blendet Rhythmus und Auto-Löschen aus/ein, ohne Überlauf', async ({ page }) => {
		await registerOwnSession(page, 'series-fields');
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByTestId('mode-switch').getByRole('checkbox').click();
		await openAccordionSection(page, 'Termin & Ort');

		const toggle = page.getByRole('checkbox', { name: 'Automatisch anlegen' });
		const rhythm = page.locator('kol-single-select[_label="Rhythmus"]');
		const autoDelete = page.locator('kol-input-checkbox[_label^="Automatisch löschen"]');
		await expect(rhythm).toBeVisible();
		await expect(autoDelete).toBeVisible();

		await toggle.focus();
		await page.keyboard.press('Space');
		await expect(toggle).not.toBeChecked();
		await expect(rhythm).toHaveCount(0);
		await expect(autoDelete).toHaveCount(0);

		await page.keyboard.press('Space');
		await expect(toggle).toBeChecked();
		for (const locator of [rhythm, autoDelete]) {
			await expect(locator).toBeVisible();
			const box = await locator.boundingBox();
			expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
			expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
		}
	});
});
