import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests #1997 (docs/spec/issue-1997.md): Jahresrückblick-Karte im Dashboard.
 *
 * AK5: Die Karte erscheint nur im Januar (Vorjahreswerte), sonst nicht. AK7: Bei 375 px bleibt
 * sie im Viewport (Bounding-Box statt scrollWidth — die App-Shell clippt, Memory 2026-08-24),
 * Teilen/Speichern sind ≥ 44 px hoch. Datumsabhängig → `page.clock.setFixedTime`.
 */

const JANUAR = new Date(2026, 0, 15, 12);
const FEBRUAR = new Date(2026, 1, 15, 12);
const MOBILE = { width: 375, height: 812 } as const;

test.describe('Jahresrückblick-Karte (#1997)', () => {
	test('AK5: im Januar erscheint die Karte', async ({ page }) => {
		await page.clock.setFixedTime(JANUAR);
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.getByTestId('yearly-recap-card')).toBeVisible();
	});

	test('AK5: im Februar ist keine Karte da', async ({ page }) => {
		await page.clock.setFixedTime(FEBRUAR);
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.getByTestId('yearly-recap-card')).toHaveCount(0);
	});

	test.describe('AK7: Mobile 375px', () => {
		test.use({ viewport: MOBILE });

		test('Karte bleibt im Viewport, Teilen und Speichern sind ≥44px hoch', async ({ page }) => {
			await page.clock.setFixedTime(JANUAR);
			await page.goto('/app/');
			await waitForStableView(page);

			const card = page.getByTestId('yearly-recap-card');
			await expect(card).toBeVisible();
			const cardBox = (await card.boundingBox())!;
			expect(cardBox.x, 'Karte ragt links aus dem Viewport').toBeGreaterThanOrEqual(-0.5);
			expect(cardBox.x + cardBox.width, 'Karte ragt bei 375px aus dem Viewport').toBeLessThanOrEqual(375 + 0.5);

			for (const id of ['yearly-share', 'yearly-download']) {
				const box = (await page.getByTestId(id).boundingBox())!;
				expect(box.height, `${id} zu klein für die Daumen-Zone`).toBeGreaterThanOrEqual(44);
				expect(box.x + box.width, `${id} ragt aus dem Viewport`).toBeLessThanOrEqual(375 + 0.5);
			}
		});
	});
});
