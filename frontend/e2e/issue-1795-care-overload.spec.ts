import { expect, test, type Page } from './fixtures';
import { waitForStableView, fullPillarContributions } from './helpers';

/**
 * E2E-Spec für #1795 (docs/spec/issue-1795.md): Bei Überlast einer Säule zeigt der Fürsorge-Hinweis
 * einen Erholungsvorschlag statt „… kam diese Woche zu kurz". Echtes Backend; Überlast entsteht durch
 * eine einzige erledigte Aufgabe der Säule „Wirksamkeit" (100 % des Aufwands im jüngeren Fenster).
 * ROT, bis Server `anlass` liefert und `CareHint` danach rahmt.
 */
const deleteAllTasks = async (page: Page): Promise<void> => {
	const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const erzeugeUeberlast = async (page: Page): Promise<void> => {
	const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number; name: string }[];
	const wirksamkeitIndex = pillars.findIndex((pillar) => pillar.name === 'Wirksamkeit');
	const created = await page.request.post('/api/v1/tasks', {
		// #2077: Vollverteilung mit Schwerpunkt Wirksamkeit (80 % > UEBERLAST_ANTEIL 0.5).
		data: {
			title: 'E2E #1795 Überlast',
			estimatedEffort: 1,
			pillars: fullPillarContributions(pillars, wirksamkeitIndex),
		},
	});
	const { id } = (await created.json()) as { id: number };
	await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

test.describe('Dashboard — Fürsorge-Hinweis bei Überlast (Issue #1795)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1/AK4: Überlast → Erholungsvorschlag, kein „kam diese Woche zu kurz"', async ({ page }) => {
		await erzeugeUeberlast(page);
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		await expect(hint).not.toContainText('zu kurz');
	});

	test('AK5: bei 375 px vollständig sichtbar, ohne Überlauf, Aktionen bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await erzeugeUeberlast(page);
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		await expect(hint).not.toContainText('zu kurz');
		const box = await hint.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		for (const name of ['Vorschlag übernehmen', 'Heute nicht', 'Diesen Vorschlag nicht mehr']) {
			const button = await hint.getByRole('button', { name }).boundingBox();
			expect(button!.height).toBeGreaterThanOrEqual(44);
			expect(button!.x + button!.width).toBeLessThanOrEqual(375 + 1);
		}
	});
});
