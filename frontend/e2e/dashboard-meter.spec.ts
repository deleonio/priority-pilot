import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #219: Meter auf der Dashboard-Homepage zeigt den Ist-Anteil erledigter Tasks
 * statt der fixen Zielgewichtung. Die Einstellungs-Gewichtung soll als Zielwert weiterhin sichtbar
 * bleiben.
 *
 * Abgedeckte Akzeptanzkriterien (AK3 — Zielwert sichtbar):
 *   AK3 — Zielwert (Einstellungs-Gewichtung) bleibt neben dem Meter erkennbar dargestellt
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

	// AK3 — Zielwert (Einstellungs-Gewichtung) bleibt neben dem Meter sichtbar
	test('AK3: Ziel-Label mit prozentualer Gewichtung wird neben dem Meter angezeigt', async ({ page }) => {
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

		// AK3: Für jede Säule ist der Zielwert (Einstellungs-Gewichtung) sichtbar dargestellt —
		// erwartet wird mindestens ein Element mit data-testid="pillar-target-weight".
		// Die konkrete Formatierung (z. B. „Ziel: 20 %") legt die Implementierung fest.
		await expect(page.locator('[data-testid="pillar-target-weight"]').first()).toBeVisible();
	});
});
