import { expect, test, type Page } from './fixtures';
import { fullPillarContributions, seedMindestErledigungen, waitForStableView } from './helpers';

/**
 * E2E-Spec für #2522 (docs/spec/issue-2522.md): Nach dem Erledigen über die Dashboard-Karte
 * „Nächste Aufgabe" (CompleteTaskDialog) zeigt der Fürsorge-Hinweis ohne Seiten-Reload denselben
 * Stand wie ein Reload. ROT, bis `CareHint` auf `TASKS_CHANGED_EVENT` neu lädt und `completeTask`
 * das Event feuert. 375×812 (AK4).
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

test.describe('Dashboard — Fürsorge-Hinweis nach dem Erledigen (#2522)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1/AK2/AK4: Erledigen über „Nächste Aufgabe" — Hinweis ohne Reload auf Reload-Stand', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
		await page.request.post('/api/v1/tasks', {
			data: {
				title: 'E2E #2522 Fenster putzen',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
				// #2077: Vollverteilung mit Schwerpunkt erste Säule (Schreib-Regel des Backends).
				pillars: fullPillarContributions(pillars, 0),
			},
		});
		await seedMindestErledigungen(page); // Test-Pflege #2527: eigener Task braucht defizit-Vorschläge
		await openDashboard(page);

		const hint = page.getByTestId('care-hint');
		await expect(hint).toBeVisible();
		// Gate wie #2010: eigene Aufgaben stehen in der Auswahl vor den Vorlagen — der Hinweis
		// nennt Task X, sonst prüft der Test nicht den eigenen-Task-Weg.
		await expect(hint).toContainText('E2E #2522 Fenster putzen');

		await page.getByRole('button', { name: 'Erledigen' }).click();
		// #2526: Direkt-Erledigen ohne Dialog — der #2522-Trichter feuert nach dem PATCH.
		await expect(page.locator('.dashboard-next-task-feedback')).toBeVisible();

		// AK1: ohne Reload nennt der Hinweis die erledigte Aufgabe nicht mehr.
		await expect(hint).not.toContainText('E2E #2522 Fenster putzen');
		// AK2: erst nach dem Neuladen capturen — dann ist der Refetch gelandet; der Text muss dem
		// Stand nach einem Reload entsprechen. textContent beidseitig: `toHaveText` zöge zusätzlich
		// die KolButton-/KolAlert-Labels in den Vergleich und würde jeden korrekten Stand als
		// Unterschied werten (Test-Pflege #2522, Begründung im PR-Body).
		const ohneReload = await hint.textContent();
		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);
		expect(await page.getByTestId('care-hint').textContent()).toBe(ohneReload);
	});
});
