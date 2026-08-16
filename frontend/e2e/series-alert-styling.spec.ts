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

		// "Fällige Instanzen generieren" klicken, um Alert zu triggern
		await page.getByRole('button', { name: 'Fällige Instanzen generieren' }).click();

		// Auf Alert warten
		await page.getByRole('alert', { name: /Ergebnis/i }).waitFor({ state: 'visible' });
	});

	test('AK1 — Serien-Alert hat mindestens 8px Abstand nach unten zum Button', async ({ page }) => {
		// Alert-Box finden
		const alert = page.getByRole('alert', { name: /Ergebnis/i });

		// Prüfen, dass Alert existiert
		await expect(alert).toBeVisible();

		// CSS-Prüfung: margin-bottom oder padding-bottom ≥ 8px
		const marginBottom = await alert.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return parseInt(styles.marginBottom) || parseInt(styles.paddingBottom) || 0;
		});

		expect(marginBottom).toBeGreaterThanOrEqual(8);
	});

	test('AK2 — Serien-Titel im Alert haben font-weight: normal (nicht bold)', async ({ page }) => {
		// Serien-Titel in der Liste finden (nicht im Alert - die series-tree-title)
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
