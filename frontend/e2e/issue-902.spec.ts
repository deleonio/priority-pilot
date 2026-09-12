import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { setTheme, waitForStableView } from './helpers';

/**
 * Spec-Test für #902 "@axe-core/playwright für gezielte E2E-A11y-Tests" (Stufe 1 TDD).
 *
 * Einziger Vertrag: AxeBuilder-Scan läuft auf Dashboard-Panels ohne Kontrast-Verstöße.
 * Repo-Struktur-Checks (package.json, Source-Files) gehören in Unit-Tests, nicht in E2E.
 *
 * Spezifikation: docs/spec/issue-902.md
 */

test.describe('#902 @axe-core/playwright für gezielte E2E-A11y-Tests', () => {
	test('AxeBuilder-Scan läuft ohne Kontrast-Verstößen auf Dashboard-Panels (Dark Mode)', async ({ page }) => {
		await page.goto('/');
		// Reihenfolge ist tragend: der Mount-Effekt von `useTheme` (theme.ts) ruft `applyTheme` mit der
		// gespeicherten bzw. System-Präferenz auf und überschreibt dabei `data-theme` UND den
		// Inline-`color-scheme`. Vor dem Mount gesetzt, wäre der Dunkelmodus also wieder weg — der Test
		// scannte den Hellmodus und bliebe grün.
		await waitForStableView(page);
		await setTheme(page, 'dark');

		// Dashboard-Panels müssen gerendert sein, bevor gescannt wird
		await expect(page.locator('.dashboard-next-task')).toBeVisible();

		const results = await new AxeBuilder({ page })
			.include('.dashboard-next-task')
			.include('.dashboard-suggestions')
			.withTags(['wcag2aa']) // WCAG AA (inkl. 1.4.3 Kontrast)
			.analyze();

		// Nur Kontrast-Verstöße melden (andere A11y-Themen werden separat getestet)
		const contrastViolations = results.violations.filter(
			(v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
		);
		expect(contrastViolations, 'Kontrast-Verstöße in Dashboard-Panels').toEqual([]);
	});
});
