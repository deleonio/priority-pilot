import { expect, test } from '@playwright/test';
import { emptyFixture, filledFixture } from './fixtures';
import { mockApi, waitForStableView } from './helpers';

test.describe('Priority Pilot — Visual-Snapshots', () => {
	test('Hauptansicht befüllt', async ({ page }) => {
		await mockApi(page, filledFixture);
		await page.goto('/');
		await waitForStableView(page);

		await expect(page).toHaveScreenshot('main-filled.png', { fullPage: true });
	});

	test('Hauptansicht leer', async ({ page }) => {
		await mockApi(page, emptyFixture);
		await page.goto('/');
		await waitForStableView(page);
		// Sicherstellen, dass der Leer-Zustand der Task-Tabelle gerendert ist.
		await expect(page.getByText('Noch keine Tasks vorhanden.', { exact: false })).toBeVisible();

		await expect(page).toHaveScreenshot('main-empty.png', { fullPage: true });
	});

	test('Fehlerzustand (Endpunkt liefert 500)', async ({ page }) => {
		await mockApi(page, filledFixture, { forest: true });
		await page.goto('/');
		await waitForStableView(page);
		// Der KolAlert mit der Fehlermeldung muss sichtbar sein.
		await expect(page.getByText('Daten konnten nicht geladen werden', { exact: false })).toBeVisible();

		await expect(page).toHaveScreenshot('main-error.png', { fullPage: true });
	});

	test('Create-Task-Modal geöffnet', async ({ page }) => {
		await mockApi(page, filledFixture);
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		// Auf den Modal-Titel warten (eigene Wait-Bedingung, da neue KoliBri-Felder hydrieren).
		await waitForStableView(page, 'Neuen Task anlegen');
		await expect(page.getByRole('dialog')).toBeVisible();

		await expect(page).toHaveScreenshot('modal-create-task.png', { fullPage: true });
	});

	test('Säulen-Gewichtung-Modal geöffnet', async ({ page }) => {
		await mockApi(page, filledFixture);
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Säulen-Gewichtung' }).click();
		await waitForStableView(page, 'Säulen-Gewichtung');
		await expect(page.getByRole('dialog')).toBeVisible();

		await expect(page).toHaveScreenshot('modal-pillar-weights.png', { fullPage: true });
	});
});
