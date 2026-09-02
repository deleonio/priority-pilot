import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1168 „Dashboard-Signal-Panel: 'Jetzt starten' → 'Erledigt'".
 *
 * Spec-Bezug: docs/spec/issue-1168.md — AK2–AK6 (TF3–TF6). Der Button „Jetzt starten" öffnet heute
 * den Task-Edit-Dialog; ein Bestätigungsdialog „Aufgabe erledigen" existiert noch nicht. Alle Tests
 * sind rot, bis `CompleteTaskDialog` existiert und im Panel verdrahtet ist. Die Komponente selbst
 * wird bewusst nur über diese e2e-Suite geprüft (keine separate Unit-Test-Datei mit einem Import
 * auf das noch nicht existierende Modul `./CompleteTaskDialog` — das würde `knip`/`tsc` schon beim
 * Spec-Commit als unauflösbaren Import melden, nicht erst als roten Testlauf).
 *
 * `GET /next` liefert die Aufgabe mit der höchsten `priority` unter den offenen, unblockierten
 * Aufgaben (`server/src/logics/find.ts:33`) — die Seeds nutzen deshalb klar unterschiedliche
 * Prioritäten, um die Reihenfolge deterministisch zu machen.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const createTask = async (page: Page, title: string, priority: number): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', { data: { title, priority } });
	const created = (await response.json()) as { id: number };
	return created.id;
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

const taskStatus = async (page: Page, id: number): Promise<string> => {
	const response = await page.request.get(`/api/v1/tasks/${id}`);
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { status: string };
	return task.status;
};

test.describe('#1168 „Erledigt"-Button im Dashboard-Signal-Panel', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('TF3 (AK2, AK4, AK5): Bestätigen setzt Status auf Done und das Panel zeigt ohne Reload die nächste Aufgabe', async ({
		page,
	}) => {
		const firstId = await createTask(page, 'E2E #1168 Erste Aufgabe', 5);
		await createTask(page, 'E2E #1168 Zweite Aufgabe', 2);

		await openDashboard(page);
		await expect(page.getByText('E2E #1168 Erste Aufgabe', { exact: false })).toBeVisible();

		await page.getByRole('button', { name: 'Erledigt' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();
		await expect(page.getByText('E2E #1168 Erste Aufgabe', { exact: false })).toBeVisible();

		await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();

		// Ohne manuellen Reload zeigt das Panel jetzt die zweite Aufgabe (AK5).
		await expect(page.locator('.dashboard-next-task-content')).toContainText('E2E #1168 Zweite Aufgabe');

		await expect.poll(async () => taskStatus(page, firstId)).toBe('Done');
	});

	test('TF4 (AK5, Leerfall): einzige Aufgabe erledigen zeigt den Leer-Text', async ({ page }) => {
		await createTask(page, 'E2E #1168 Einzige Aufgabe', 5);

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigt' }).click();
		await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();

		await expect(page.locator('.dashboard-next-task-empty')).toBeVisible();
		await expect(page.locator('.dashboard-next-task-empty')).toContainText('Aktuell steht keine Aufgabe an');
	});

	test('TF5 (AK3): Abbrechen schließt den Dialog ohne Statusänderung', async ({ page }) => {
		const id = await createTask(page, 'E2E #1168 Abbrechen-Aufgabe', 5);

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigt' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();

		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();

		// Panel zeigt weiterhin dieselbe Aufgabe, Status bleibt offen.
		await expect(page.locator('.dashboard-next-task-content')).toContainText('E2E #1168 Abbrechen-Aufgabe');
		expect(await taskStatus(page, id)).toBe('Open');
	});

	test('TF6 (AK6): schlägt das Erledigen fehl, bleibt der Dialog offen und zeigt eine Fehlermeldung', async ({
		page,
	}) => {
		const id = await createTask(page, 'E2E #1168 Fehler-Aufgabe', 5);

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigt' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();

		await page.route(`**/api/v1/tasks/${id}`, (route: Route) => {
			if (route.request().method() === 'PATCH') {
				return route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Serverfehler' }),
				});
			}
			return route.continue();
		});

		await page.getByRole('button', { name: 'Als erledigt markieren' }).click();

		// Dialog bleibt offen, zeigt eine Fehlermeldung; Panel-Inhalt bleibt unverändert.
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.locator('.dashboard-next-task-content')).toContainText('E2E #1168 Fehler-Aufgabe');

		await page.unroute(`**/api/v1/tasks/${id}`);
		expect(await taskStatus(page, id)).toBe('Open');
	});
});
