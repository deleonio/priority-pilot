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
		// Dialog-Titel als role=heading abwarten — eindeutig der KolDialog (der gleichnamige Trigger ist
		// ein Button) und Beleg, dass der Dialog offen ist; danach Hydration/Fonts der neuen Felder.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);

		await expect(page).toHaveScreenshot('modal-create-task.png', { fullPage: true });
	});

	test('Säulen-Gewichtung-Modal geöffnet', async ({ page }) => {
		await mockApi(page, filledFixture);
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Säulen-Gewichtung' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page);

		await expect(page).toHaveScreenshot('modal-pillar-weights.png', { fullPage: true });
	});

	test('Fokus kehrt nach dem Schließen zum auslösenden Toolbar-Button zurück', async ({ page }) => {
		await mockApi(page, filledFixture);
		await page.goto('/');
		await waitForStableView(page);

		// Edit-Dialog über den „Bearbeiten"-Button der Tabellen-Toolbar (erste Zeile) öffnen.
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		// Über „Abbrechen" schließen (keine Mutation → der auslösende Button bleibt im DOM erhalten).
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();

		// Der Fokus muss zurück auf dem auslösenden „Bearbeiten"-Button liegen (tief im Shadow-DOM der
		// Tabelle/Toolbar), nicht im <body>.
		const focusedLabel = await page.evaluate(() => {
			let el: Element | null = document.activeElement;
			while (el?.shadowRoot?.activeElement != null) {
				el = el.shadowRoot.activeElement;
			}
			return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? el?.tagName.toLowerCase() ?? null;
		});
		expect(focusedLabel).toContain('Bearbeiten');
	});
});
