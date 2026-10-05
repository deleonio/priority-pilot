import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Journal-Tab (#2212, docs/spec/issue-2212.md) gegen das echte Backend: Einträge anlegen,
 * bearbeiten, löschen (AK4) und Mobile-Layout bei 375 px (AK5, Bounding-Box statt scrollWidth).
 */
const openJournal = async (page: Page, label: string): Promise<void> => {
	await registerOwnSession(page, label);
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Journal', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Neuer Eintrag' })).toBeVisible();
};

test.describe('#2212 Journal', () => {
	test('AK4: Eintrag anlegen, bearbeiten und löschen ohne Reload', async ({ page }) => {
		await openJournal(page, 'journal-crud');

		await page
			.getByRole('textbox', { name: /Eintrag/ })
			.first()
			.fill('Erster Gedanke');
		await page.getByRole('button', { name: 'Eintrag speichern' }).click();
		await expect(page.getByText('Erster Gedanke')).toBeVisible();

		await page.getByRole('button', { name: /^Eintrag vom .* bearbeiten$/ }).click();
		const editField = page.getByRole('textbox', { name: /^Eintrag vom / });
		await editField.fill('Geänderter Gedanke');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByText('Geänderter Gedanke')).toBeVisible();
		await expect(page.getByText('Erster Gedanke')).toHaveCount(0);

		await page.getByRole('button', { name: /^Eintrag vom .* löschen$/ }).click();
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByText('Geänderter Gedanke')).toHaveCount(0);
	});

	test('AK5: 375 px ohne Überlauf, Bedienelemente mindestens 44 px hoch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openJournal(page, 'journal-mobile');
		await page
			.getByRole('textbox', { name: /Eintrag/ })
			.first()
			.fill('Mobiler Eintrag');
		await page.getByRole('button', { name: 'Eintrag speichern' }).click();
		await expect(page.getByText('Mobiler Eintrag')).toBeVisible();

		for (const name of ['Eintrag speichern', /^Eintrag vom .* bearbeiten$/, /^Eintrag vom .* löschen$/]) {
			const box = await page.getByRole('button', { name }).first().boundingBox();
			expect(box, `${String(name)} sichtbar`).not.toBeNull();
			expect(box!.height).toBeGreaterThanOrEqual(44);
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
	});
});
