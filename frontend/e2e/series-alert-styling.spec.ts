import { test, expect } from './fixtures';

/**
 * Rote End-to-End-Spec für #692 — Serien-Alert Layout-Verbesserung.
 *
 * Akzeptanzkriterien (aus Issue-Body):
 * 1. Alert-Abstand zum Button vergrößert (CSS margin/padding)
 * 2. Serien-Titel nicht fett (font-weight: normal)
 *
 * Spec: docs/spec/issue-692.md
 *
 * Diese Tests sind rot, solange:
 * - Alert keinen 8px+ Abstand nach unten zum Button hat
 * - Serien-Titel noch font-weight: bold haben
 */

test.describe('Priority Pilot — #692: Serien-Alert Layout-Verbesserung', () => {
	test.beforeEach(async ({ page }) => {
		// Serien-Tab öffnen
		await page.goto('/');
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
	});

	test('AK1 — Serien-Actions hat mindestens 8px margin-top', async ({ page }) => {
		// series-actions Container finden
		const seriesActions = page.locator('.series-actions').first();

		// Prüfen, dass Container sichtbar ist
		await expect(seriesActions).toBeVisible();

		// CSS-Prüfung: margin-top ≥ 8px (0.5rem = 8px bei 16px Basis)
		const marginTop = await seriesActions.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return parseInt(styles.marginTop) || 0;
		});

		expect(marginTop).toBeGreaterThanOrEqual(8);
	});

	test('AK2 — Serien-Titel haben font-weight: normal (nicht bold)', async ({ page }) => {
		// Serien-Titel in der Liste finden
		const seriesTitle = page.locator('.series-tree-title').first();

		// Prüfen, dass Serien-Titel sichtbar ist
		await expect(seriesTitle).toBeVisible();

		// Prüfen, dass Serien-Titel nicht fett ist
		const fontWeight = await seriesTitle.evaluate((el) => {
			return window.getComputedStyle(el).fontWeight;
		});

		// font-weight sollte 'normal' oder numerisch ≤ 400 sein
		const isNormal = fontWeight === 'normal' || parseInt(fontWeight) <= 400;
		expect(isNormal).toBe(true);
	});
});
