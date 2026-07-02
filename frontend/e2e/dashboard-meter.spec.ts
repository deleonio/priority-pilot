import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #219: Meter auf der Dashboard-Homepage zeigt den Ist-Anteil erledigter Tasks
 * statt der fixen Zielgewichtung. Die Einstellungs-Gewichtung fließt als Meter-Schwelle (`_low`)
 * ein statt als separater Zahlenwert — erkennbar über Farbe + Statustext ("Optimal"/"Suboptimal").
 *
 * Abgedeckte Akzeptanzkriterien (AK3 — Zielwert als Meter-Optimum sichtbar):
 *   AK3 — Zielwert (Einstellungs-Gewichtung) ist als Meter-Schwelle über Farbe/Statustext erkennbar
 *
 * Die Unit-Tests für AK1/AK2/AK4 (Berechnungslogik) befinden sich in pillar.test.ts.
 */
test.describe('Dashboard — Meter Ist-Anteil (Issue #219)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E Meter219 ${label} #${(runId += 1)}-${Date.now()}`;

	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByLabel('Titel').fill(title);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	const openDashboardTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	};

	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	const setFirstTaskDone = async (page: Page): Promise<void> => {
		await openTasksTab(page);
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		await page.getByLabel('Status').click();
		await page.getByRole('option', { name: 'Erledigt' }).click();
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Task bearbeiten/ })).toBeHidden();
	};

	// AK3 — Zielwert (Einstellungs-Gewichtung) ist als Meter-Schwelle über Farbe/Statustext erkennbar
	test('AK3: Zielwert ist als Meter-Statustext ("Optimal"/"Suboptimal") erkennbar, kein separater Zahlenwert', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);

		await createTaskViaUi(page, uniqueTitle('Zielwert'));
		await waitForStableView(page);

		// Task auf „Erledigt" setzen, damit Meter-Wert > 0
		await setFirstTaskDone(page);
		await waitForStableView(page);

		await openDashboardTab(page);
		await waitForStableView(page);

		// Das Dashboard zeigt „Meine Themen"-Widget mit Säulen-Liste
		await expect(page.getByRole('heading', { name: 'Meine Themen' })).toBeVisible();

		// AK3: Der Zielwert wird nicht mehr als separater Zahlenwert ausgewiesen …
		await expect(page.locator('[data-testid="pillar-target-weight"]')).toHaveCount(0);
		// … sondern fließt als Meter-Schwelle ein und ist über den Statustext neben dem Meter
		// erkennbar (Optimal = Ziel erreicht/grün, Suboptimal = darunter/gelb).
		const pillarsList = page.locator('.dashboard-pillars-list');
		await expect(pillarsList.getByText(/Optimal|Suboptimal/).first()).toBeVisible();
	});
});
