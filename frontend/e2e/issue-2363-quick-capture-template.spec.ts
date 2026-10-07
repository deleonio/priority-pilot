import { expect, test, type Page } from './fixtures';
import type { Locator } from '@playwright/test';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2363 — „Aus Vorlage" im Schnellerfassen (AK2, AK4, AK5).
 * Vertrag: docs/spec/issue-2363.md. Echtes Backend, 375 px, eigene Session.
 */
test.describe('Balamentum — Aus Vorlage erfassen im Schnellerfassen (#2363)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	const deleteAll = async (page: Page): Promise<void> => {
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};
	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	const createSeries = async (page: Page, title: string, autoCreate: boolean): Promise<void> => {
		// Server-Regel (series.ts): rhythm „none" nur mit autoCreate:false; autoCreate-Serien brauchen
		// echten Rhythmus + startDate (Pflicht bei POST), startDate muss zum Wochentag-Rhythmus passen.
		const data = autoCreate
			? {
					title,
					rhythm: 'weekly',
					startDate: '2030-01-07T00:00:00.000Z',
					priority: 3,
					estimatedEffort: 0.5,
					autoCreate,
				}
			: { title, rhythm: 'none', priority: 3, estimatedEffort: 0.5, autoCreate };
		const response = await page.request.post('/api/v1/series', { data });
		expect(response.ok()).toBeTruthy();
	};

	const openQuickCapture = async (page: Page): Promise<Locator> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		return dialog;
	};

	/** AK5: nichts ragt über den 375-px-Viewport hinaus (Bounding-Box, nicht scrollWidth). */
	const inBox = async (locator: Locator): Promise<void> => {
		const box = await locator.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	};

	test('AK2 — Schnellerfassen → „Aus Vorlage" → Vorlage wählen → Aufgabe in der Liste', async ({ page }) => {
		await registerOwnSession(page, 'quick-capture-template');
		const title = 'E2E 2363 Vorlage';
		await createSeries(page, title, false);
		await createSeries(page, 'E2E 2363 Automatisch', true);

		const dialog = await openQuickCapture(page);
		await dialog.getByRole('button', { name: 'Aus Vorlage' }).click();

		const entry = page.getByRole('button', { name: title });
		await expect(entry).toBeVisible();
		// AK1-Filter auch Ende-zu-Ende: die autoCreate-Serie taucht in der Auswahl nicht auf.
		await expect(page.getByRole('button', { name: 'E2E 2363 Automatisch' })).toHaveCount(0);

		await entry.click();
		await expect(dialog).toContainText(`Aufgabe anlegen: ${title}`);
		await expect(dialog.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
		await inBox(dialog);

		await dialog.getByRole('button', { name: 'Aufgabe anlegen' }).click();
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });
		await expect(row).toBeVisible();
		await expect(row.getByText('Vorlage')).toBeVisible();
	});

	test('AK4/AK5 — Tastaturpfad Button → Auswahl → Eintrag → Dialog, Escape schließt', async ({ page }) => {
		await registerOwnSession(page, 'quick-capture-template-kb');
		const title = 'E2E 2363 Tastatur';
		await createSeries(page, title, false);

		const dialog = await openQuickCapture(page);

		// AK4: Button → Auswahl per Tastatur (Fokus statt britter Tab-Zählung — Pinned in der Spec).
		const ausVorlage = dialog.getByRole('button', { name: 'Aus Vorlage' });
		await expect(ausVorlage).toBeVisible();
		await ausVorlage.focus();
		await page.keyboard.press('Enter');
		const entry = page.getByRole('button', { name: title });
		await expect(entry).toBeVisible();
		await inBox(dialog); // AK5

		// AK4: Escape schließt die Auswahl zurück in den Capture-Schritt.
		await page.keyboard.press('Escape');
		await expect(entry).toHaveCount(0);
		await expect(ausVorlage).toBeVisible();

		// Erneut öffnen, Eintrag per Tastatur wählen → vorbefüllter Dialog.
		await ausVorlage.focus();
		await page.keyboard.press('Enter');
		await expect(entry).toBeVisible();
		await entry.focus();
		await page.keyboard.press('Enter');
		await expect(dialog).toContainText(`Aufgabe anlegen: ${title}`);
		await inBox(dialog); // AK5

		// AK4: Escape im Dialog schließt ihn.
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});
});
