import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #1793 (docs/spec/issue-1793.md): Fürsorge-Hinweis auf dem Dashboard gegen das echte
 * Backend. Der Testnutzer hat gesäte Säulen ohne erledigte Aufgaben — jede Säule ist defizitär, der
 * Server liefert also Vorschläge. ROT, bis `CareHint` im Dashboard eingebunden ist.
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

test.describe('Dashboard — Fürsorge-Hinweis (Issue #1793)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1: genau ein Hinweis, oberhalb von „Nächste Aufgabe"', async ({ page }) => {
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #1793 Anker' } });
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toHaveCount(1);
		const hintBox = await hint.boundingBox();
		const nextBox = await page.locator('.dashboard-next-task').boundingBox();
		expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(nextBox!.y + 1);
	});

	test('AK2: Übernehmen legt genau einen Task an und blendet den Hinweis aus', async ({ page }) => {
		await openDashboard(page);
		await expect(page.getByTestId('care-hint')).toBeVisible();
		const vorher = ((await (await page.request.get('/api/v1/tasks')).json()) as unknown[]).length;

		await page.getByRole('button', { name: 'Vorschlag übernehmen' }).click();

		await expect(page.getByTestId('care-hint')).toHaveCount(0);
		await expect
			.poll(async () => ((await (await page.request.get('/api/v1/tasks')).json()) as unknown[]).length)
			.toBe(vorher + 1);
	});

	test('AK3: Ablehnen blendet den Hinweis aus', async ({ page }) => {
		await openDashboard(page);
		await expect(page.getByTestId('care-hint')).toBeVisible();
		// Das E2E-Backend läuft im Pass-Through-Modus ohne Sitzung (`userId` undefined): das echte
		// `POST …/dismissals` scheitert dort mit 500 und der Hinweis käme zurück. Nur die Ablehnung wird
		// bedient — bisher gewann der Test nur das Rennen gegen diese Antwort (CSRF-Token-Fetch im Weg).
		await page.route('**/scores/care-suggestions/dismissals', (route) => route.fulfill({ status: 204 }));

		await page.getByRole('button', { name: 'Vorschlag ablehnen' }).click();

		await expect(page.getByTestId('care-hint')).toHaveCount(0);
	});

	test('AK4: „Nicht jetzt" blendet den Hinweis aus, auch nach Reload', async ({ page }) => {
		await openDashboard(page);
		await page.getByRole('button', { name: 'Nicht jetzt' }).click();
		await expect(page.getByTestId('care-hint')).toHaveCount(0);

		await page.reload();
		await waitForStableView(page);
		await expect(page.getByTestId('care-hint')).toHaveCount(0);
	});

	test('AK7: bei 375 px passt der Hinweis ohne Überlauf, Aktionen ≥ 44 px hoch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);
		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();

		const box = await hint.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		for (const name of ['Vorschlag übernehmen', 'Nicht jetzt', 'Vorschlag ablehnen']) {
			const button = await hint.getByRole('button', { name }).boundingBox();
			expect(button!.height).toBeGreaterThanOrEqual(44);
			expect(button!.x + button!.width).toBeLessThanOrEqual(375 + 1);
		}
	});
});
