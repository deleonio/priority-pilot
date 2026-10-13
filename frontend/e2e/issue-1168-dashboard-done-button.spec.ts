import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1168 „Dashboard-Signal-Panel: 'Jetzt starten' → 'Erledigt'".
 *
 * #2526-Test-Pflege: Der Panel-Knopf erledigt Plain-Tasks direkt (ADR 0024) — TF3/TF4 (Dialog-Fluss)
 * sind durch `issue-2526-complete-inline.spec.ts` abgelöst und entfernt; TF5/TF6 prüfen den
 * verbliebenen Dialogfall (offene Checkliste) mit Checklisten-Seed.
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

// #2526 (ADR 0024): Ohne offene Checkliste erledigt das Panel direkt — nur mit ihr öffnet der
// Panel-Knopf weiterhin den Bestätigungsdialog. TF5/TF6 seeden ihn deshalb.
const createChecklistTask = async (page: Page, title: string, priority: number): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: {
			title,
			priority,
			checklist: [
				// Server verlangt UUID-Ids (validateChecklist, tasks.ts) — Muster #1583-Spec.
				{ id: '11111111-1111-1168-1118-111111111161', title: 'Erster Punkt', completed: false },
				{ id: '22222222-2222-2168-2228-222222222262', title: 'Zweiter Punkt', completed: false },
			],
		},
	});
	const created = (await response.json()) as { id: number };
	return created.id;
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
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

	test('TF5 (AK3): Abbrechen schließt den Dialog ohne Statusänderung', async ({ page }) => {
		const id = await createChecklistTask(page, 'E2E #1168 Abbrechen-Aufgabe', 5);

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen' }).click();
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
		const id = await createChecklistTask(page, 'E2E #1168 Fehler-Aufgabe', 5);

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();
		// #2526-Test-Pflege: Der Checklisten-Seed macht den Hauptknopf zunächst zu „Checkliste speichern“
		// (CompleteTaskDialog.tsx mainLabel) — erst „Alle abhaken“ schaltet auf „Als erledigt markieren“ (#1583-Muster).
		await page.getByRole('button', { name: 'Alle abhaken' }).click();
		await expect(page.getByRole('button', { name: 'Als erledigt markieren' })).toBeVisible();

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
