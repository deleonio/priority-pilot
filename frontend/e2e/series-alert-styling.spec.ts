import { test, expect } from './fixtures';

/**
 * E2E-Verhaltens-Spec für #692 — Serien-Alert Layout-Verbesserung
 * (mit PR #693 umgesetzt: `margin-top` auf `.series-actions`, `font-weight: 600` bei
 * `.series-tree-title` entfernt).
 *
 * Akzeptanzkriterien (aus Issue-Body):
 * 1. Alert-Abstand zum Button vergrößert (CSS margin/padding)
 * 2. Serien-Titel nicht fett (font-weight: normal)
 *
 * Spec: docs/spec/issue-692.md
 */

test.describe('Priority Pilot — #692: Serien-Alert Layout-Verbesserung', () => {
	test.beforeEach(async ({ page }) => {
		// Serien-Tab öffnen
		await page.goto('/');
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();

		// Eine Serie via API anlegen, damit .series-tree-title existiert
		await page.request.post('/api/v1/series', {
			data: {
				title: `E2E #692 Test Serie ${Date.now().toString(36)}`,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
	});

	// Die In-Memory-DB lebt über alle Specs des Backend-Prozesses weiter (ein Worker, kein Neustart
	// zwischen Testdateien) — die angelegte Serie über die API wieder abräumen, damit nachfolgende
	// Specs unabhängig von der Ausführungsreihenfolge einen definierten Zustand vorfinden.
	test.afterEach(async ({ page }) => {
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
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
