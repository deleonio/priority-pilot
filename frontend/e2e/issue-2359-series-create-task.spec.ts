import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2359 — „Aufgabe anlegen" aus Vorlage (AK2, AK4, AK6).
 * Vertrag: docs/spec/issue-2359.md. Echtes Backend, 375 px, eigene Session.
 */
test.describe('Balamentum — Aufgabe aus Vorlage anlegen (#2359)', () => {
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

	const openTab = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: { title, rhythm: 'none', priority: 3, estimatedEffort: 0.5, autoCreate: false },
		});
		expect(response.ok()).toBeTruthy();
		const id = ((await response.json()) as { id: number }).id;
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien & Vorlagen', exact: true }).click();
		await expect(page.getByTestId(`series-tree-item-${id}`)).toBeVisible();
		return id;
	};

	test('AK2/AK4/AK6 — Vorlage → „Aufgabe anlegen" → Titel ändern → Aufgabe mit „Vorlage (geändert)"', async ({
		page,
	}) => {
		await registerOwnSession(page, 'series-create-task');
		const title = 'E2E 2359 Vorlage';
		const id = await openTab(page, title);

		const action = page.getByTestId(`series-tree-item-${id}`).getByRole('button', { name: 'Aufgabe anlegen' });
		const box = await action.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);
		await action.click();

		const dialog = page.getByRole('dialog');
		const dialogBox = await dialog.boundingBox();
		expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
		expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(375);

		await page.locator('kol-dialog').getByRole('textbox', { name: 'Titel' }).fill(`${title} heute`);
		await page.locator('kol-dialog').getByRole('button', { name: 'Aufgabe anlegen' }).click();
		await expect(page.getByText(`Aufgabe angelegt: ${title} heute`)).toBeVisible();

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		// Über die Aufgabenzeile eingegrenzt: das inaktive Serien-Panel bleibt gemountet (hidden) und trägt
		// die Erfolgsmeldung mit demselben Titel.
		const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: `${title} heute` }) });
		await expect(row).toBeVisible();
		await expect(row.getByText('Vorlage (geändert)')).toBeVisible();
	});
});
