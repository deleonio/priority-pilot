import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * ROTER Spec-Test für #1821 AK6 (Spec: docs/spec/issue-1821.md) — eine erledigte Aufgabe lässt sich
 * in der Bearbeiten-Ansicht speichern, ohne Fehlerdialog; sie bleibt erledigt und zeigt den neuen Titel.
 *
 * Erledigt-Zustand: Der Dialog wird geöffnet, solange die Aufgabe noch offen ist; dann setzt ein
 * API-Aufruf sie auf Done (erledigte Aufgaben blenden sich aus der Liste aus, siehe
 * done-auto-remove.spec.ts). Das Speichern trifft damit einen Done-Task — heute mit 409 abgelehnt.
 * Die Säulen-Änderung ist auf API-Ebene in tasks-done-edit-guard.test.ts abgedeckt (kein UI-Doppel).
 */
const OLD_TITLE = 'E2E 1821 Alt';
const NEW_TITLE = 'E2E 1821 Neu';

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const editDoneTask = async (page: Page): Promise<void> => {
	// Eigene Session: ohne Konto gilt `GET /pillars` über alle Säulen der Shard-DB; je nach Shard-Lage
	// verteilt das Formular dann unter 5 % je Säule und `PATCH /tasks` antwortet 400 (#2235/#2229).
	await registerOwnSession(page, 'done-edit-1821');
	const created = await page.request.post('/api/v1/tasks', {
		data: { title: OLD_TITLE, priority: 3, estimatedEffort: 1 },
	});
	const { id } = (await created.json()) as { id: number };

	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
	await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
	await waitForStableView(page);

	expect((await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } })).ok()).toBeTruthy();

	let dialogSeen = false;
	page.on('dialog', () => {
		dialogSeen = true;
	});
	await page.getByRole('textbox', { name: 'Titel' }).fill(NEW_TITLE);
	await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();

	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
	expect(dialogSeen).toBe(false);

	const task = (await (await page.request.get(`/api/v1/tasks/${id}`)).json()) as { title: string; status: string };
	expect(task.title).toBe(NEW_TITLE);
	expect(task.status).toBe('Done');
};

test.describe('#1821 Erledigte Aufgabe bearbeiten', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK6: Titel einer erledigten Aufgabe speichern → kein Fehler, Status bleibt Done', async ({ page }) => {
		await editDoneTask(page);
	});

	test('AK6 (375 px): dasselbe bei schmalem Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await editDoneTask(page);
	});
});
