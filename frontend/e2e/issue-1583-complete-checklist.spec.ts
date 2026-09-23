import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1583 „Checklisten beim Erledigen abhaken müssen".
 *
 * Spec-Bezug: docs/spec/issue-1583.md — AK1, AK3, AK4, AK5, AK6, AK8, AK9 (TF6–TF9). Heute setzt
 * der Erledigt-Toggle in der Aufgabenliste eine Aufgabe mit offenen Checklisten-Einträgen direkt auf
 * `Done`, ohne die Checkliste zu berücksichtigen — `CompleteTaskDialog` kennt weder eine
 * Checklisten-Sektion noch einen Sammel-Knopf. Alle Tests sind rot, bis `handleDoneToggle`
 * (`App.tsx`) den Dialog bei offenen Einträgen öffnet und `CompleteTaskDialog` die Checkliste
 * bedienbar macht.
 */

let runId = 0;
const uniqueTitle = (label: string): string => {
	const tail = ` #${(runId += 1)}`;
	return `E2E1583 ${label}${tail}`.slice(0, 60);
};

const createTaskWithChecklist = async (
	page: Page,
	title: string,
	checklist: { id: string; title: string; completed: boolean }[],
): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1, checklist },
	});
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { id: number };
	return task.id;
};

const createTask = async (page: Page, title: string): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { id: number };
	return task.id;
};

const fetchTask = async (page: Page, id: number): Promise<{ status: string; checklist?: { completed: boolean }[] }> => {
	const response = await page.request.get(`/api/v1/tasks/${id}`);
	expect(response.ok()).toBeTruthy();
	return (await response.json()) as { status: string; checklist?: { completed: boolean }[] };
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const openTasksTab = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await waitForStableView(page);
};

const item = (page: Page, id: number) => page.getByTestId(`task-list-item-${id}`);
const toolbar = (page: Page, id: number) => item(page, id).locator('[role="toolbar"]');

const openActionsPopover = async (page: Page, id: number): Promise<void> => {
	await item(page, id)
		.getByRole('button', { name: /Weitere Aktionen/i })
		.click();
};

const clickDoneToggle = async (page: Page, id: number): Promise<void> => {
	await openActionsPopover(page, id);
	await toolbar(page, id)
		.getByRole('button', { name: /Erledigt/i })
		.click();
};

test.describe('#1583 Checklisten beim Erledigen abhaken müssen', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('TF6 (AK1, AK6): Toggle öffnet den Dialog, Speichern mit einem offenen Eintrag lässt die Aufgabe offen', async ({
		page,
	}) => {
		const title = uniqueTitle('Zwei Eintraege');
		const id = await createTaskWithChecklist(page, title, [
			{ id: '11111111-1111-1111-1111-111111111111', title: 'Vertrag pruefen', completed: false },
			{ id: '22222222-2222-2222-2222-222222222222', title: 'Rechnung stellen', completed: false },
		]);

		await openTasksTab(page);
		await clickDoneToggle(page, id);

		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();
		const checklistSection = page.locator('[data-testid="checklist-section"]');
		await expect(checklistSection).toBeVisible();
		await expect(page.locator('[data-testid="checklist-item"]')).toHaveCount(2);

		// Kein PATCH beim bloßen Öffnen des Dialogs (AK1) — Status bleibt Open.
		expect((await fetchTask(page, id)).status).toBe('Open');

		await page.locator('[data-testid="checklist-item"]').first().getByRole('checkbox').click();
		await page.getByRole('button', { name: 'Checkliste speichern' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();

		await page.reload();
		await waitForStableView(page);
		const afterSave = await fetchTask(page, id);
		expect(afterSave.status).toBe('Open');
		expect(afterSave.checklist?.filter((c) => c.completed).length).toBe(1);
		await expect(item(page, id)).toContainText('1/2');
	});

	test('TF7 (AK3, AK4, AK5): Sammel-Knopf + Hauptknopf-Beschriftung führen zum Erledigen', async ({ page }) => {
		const title = uniqueTitle('Sammel-Knopf');
		const id = await createTaskWithChecklist(page, title, [
			{ id: '33333333-3333-3333-3333-333333333333', title: 'Erster Schritt', completed: false },
			{ id: '44444444-4444-4444-4444-444444444444', title: 'Zweiter Schritt', completed: false },
		]);

		await openTasksTab(page);
		await clickDoneToggle(page, id);
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();

		await expect(page.getByRole('button', { name: 'Checkliste speichern' })).toBeVisible();
		await page.getByRole('button', { name: 'Alle abhaken' }).click();
		await expect(page.getByRole('button', { name: 'Als erledigt markieren' })).toBeVisible();

		await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();

		await page.reload();
		await waitForStableView(page);
		const afterSave = await fetchTask(page, id);
		expect(afterSave.status).toBe('Done');
		expect(afterSave.checklist?.every((c) => c.completed)).toBe(true);
	});

	test('TF8 (AK8): Aufgabe ohne Checkliste bleibt beim direkten Toggle ohne Dialog', async ({ page }) => {
		const title = uniqueTitle('Ohne Checkliste');
		const id = await createTask(page, title);

		await openTasksTab(page);
		await clickDoneToggle(page, id);

		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();
		await expect.poll(async () => (await fetchTask(page, id)).status).toBe('Done');
	});

	test('TF9 (AK9, 375px): Dialog mit 20 Einträgen ist voll bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		const checklist = Array.from({ length: 20 }, (_, i) => ({
			id: `55555555-5555-5555-5555-5555555555${String(i).padStart(2, '0')}`,
			title: `Eintrag ${i + 1}`,
			completed: false,
		}));
		const title = uniqueTitle('20 Eintraege');
		const id = await createTaskWithChecklist(page, title, checklist);

		await openTasksTab(page);
		await clickDoneToggle(page, id);
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();

		const mainButton = page.getByRole('button', { name: 'Checkliste speichern' });
		await mainButton.scrollIntoViewIfNeeded();
		await expect(mainButton).toBeVisible();
		const buttonBox = await mainButton.boundingBox();
		expect(buttonBox).not.toBeNull();
		expect(buttonBox!.x).toBeGreaterThanOrEqual(0);
		expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(375);

		const modalBody = page.locator('.modal-body');
		const bodyBox = await modalBody.boundingBox();
		expect(bodyBox).not.toBeNull();
		expect(bodyBox!.x).toBeGreaterThanOrEqual(0);
		expect(bodyBox!.x + bodyBox!.width).toBeLessThanOrEqual(375);
	});
});
