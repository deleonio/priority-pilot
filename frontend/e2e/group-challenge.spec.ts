import { expect, test, type Page } from './fixtures';
import { accordionTrigger, waitForStableView } from './helpers';

/**
 * #1992 AK5/AK7 — Gruppen-Challenge in der Gruppenansicht gegen das echte Backend: starten (mit
 * Inline-Bestätigung), danach Restlaufzeit + Rangfolge. AK7 per Bounding-Box statt scrollWidth
 * (App-Shell clippt overflow-x:hidden, Muster groups.spec.ts).
 */

const openGroup = async (page: Page, name: string): Promise<void> => {
	await page.goto('/app/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await page.getByRole('searchbox', { name: 'Name' }).fill(name);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeHidden();
	await waitForStableView(page, 'Gruppen');
	await accordionTrigger(page, name).click();
};

test.describe('Gruppen-Challenge (#1992)', () => {
	test.afterEach(async ({ page }) => {
		const response = await page.request.get('/api/v1/groups');
		const groups = (await response.json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	for (const width of [375, 1280]) {
		test(`Challenge starten zeigt Restlaufzeit und Rangfolge ohne Überlauf (${width}px, AK5/AK7)`, async ({ page }) => {
			await page.setViewportSize({ width, height: 812 });
			await openGroup(page, `E2E Challenge ${width}`);

			const card = page.getByTestId('group-challenge');
			await card.getByRole('button', { name: '7-Tage-Challenge starten' }).click();
			await card.getByRole('button', { name: 'Challenge starten', exact: true }).click();

			await expect(card.getByText(/Noch 7 Tage/)).toBeVisible();
			const row = card.locator('.group-challenge-zeile').first();
			await expect(row).toContainText('Noch kein Wert');
			await expect(card.getByRole('button')).toHaveCount(0);

			for (const box of [await card.boundingBox(), await row.boundingBox()]) {
				expect(box).not.toBeNull();
				expect(box!.x + box!.width, 'Challenge-Karte ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(width);
			}
		});
	}
});
