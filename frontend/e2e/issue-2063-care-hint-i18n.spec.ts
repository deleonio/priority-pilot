import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #2063 (docs/spec/issue-2063.md): Fürsorge-Hinweis in der App-Sprache Englisch —
 * Knöpfe, Krisenhinweis (Nummer + tel:-Link wortgleich) und 375-px-Layout. Der Testnutzer hat
 * gesäte Säulen ohne erledigte Aufgaben — der Server liefert Vorschläge (Muster #1793). ROT,
 * bis `CareHint` seine Texte aus i18n zieht (heute hardcoded deutsch).
 */
const deleteAllTasks = async (page: Page): Promise<void> => {
	const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

const wechsleAufEnglisch = async (page: Page): Promise<void> => {
	await page.goto('/app/settings/general');
	await waitForStableView(page, 'Balamentum');
	// KoliBri-SingleSelect = Combobox; Endonym „English" (Muster #1879).
	await page.getByLabel('Sprache').click();
	await page.getByRole('option', { name: 'English' }).click();
};

test.describe('Dashboard — Fürsorge-Hinweis i18n (Issue #2063)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK2+AK5: Sprache en — Hinweis und Knöpfe englisch', async ({ page }) => {
		await openDashboard(page);
		await expect(page.getByTestId('care-hint')).toBeVisible();
		await wechsleAufEnglisch(page);

		await openDashboard(page);
		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		await expect(page.getByRole('button', { name: 'Accept suggestion' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Not today' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Not this suggestion again' })).toBeVisible();
		await expect(hint).not.toContainText('TelefonSeelsorge');
		await expect(hint).not.toContainText('Vorschlag übernehmen');
	});

	test('AK2: 375px — englischer Hinweis läuft nicht über den Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await openDashboard(page);
		await expect(page.getByTestId('care-hint')).toBeVisible();
		await wechsleAufEnglisch(page);

		await openDashboard(page);
		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		// Englisch nachweisen (ROT bis i18n) — erst dann ist die Layout-Assertion am richtigen Objekt.
		await expect(hint).toContainText('could use some care this week');
		// Bounding-Box statt scrollWidth — die App-Shell clippt mit overflow-x:hidden (MEMORY 2026-08-24).
		const box = await hint.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	});
});
