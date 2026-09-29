import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1818 (AK6, docs/spec/issue-1818.md): Liefert die Schnellerfassung einen Titel
 * über 65 Zeichen (gemockter `parse-text`, kein echtes LLM), zeigt „Anlegen" eine sichtbare deutsche
 * Meldung mit dem Limit im Formular — bei 375 px ohne horizontalen Überlauf (Bounding-Box statt
 * `scrollWidth`, die App-Shell clippt `overflow-x`).
 */
test.use({ viewport: { width: 375, height: 800 } });

test('AK6: Parser-Titel > 65 Zeichen → Meldung sichtbar im Formular, kein Überlauf (#1818)', async ({ page }) => {
	await page.route('**/api/v1/tasks/parse-text', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ title: 'Sehr langer Titel '.repeat(5).trim(), priority: 3, estimatedEffort: 0.5 }),
		}),
	);

	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await waitForStableView(page);
	await page.getByRole('textbox', { name: /Beschreibe/ }).fill('Irgendein Freitext');
	await page.getByRole('button', { name: 'Verarbeiten und weiter' }).click();
	await waitForStableView(page);

	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

	const alert = page.getByRole('alert').filter({ hasText: /65/ });
	await expect(alert).toBeVisible();
	await expect(alert).toContainText(/zu lang/i);
	const box = await alert.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(375);
});
