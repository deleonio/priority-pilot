import { expect, test, type Page } from './fixtures';
import { registerOwnSession, taskTitleText, waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #2399 „Daten bei Rückkehr in den Vordergrund neu laden“ (Spec docs/spec/issue-2399.md).
 *
 * AK4: eine per API (anderes Gerät) angelegte Aufgabe ist nach der Rückkehr ohne Seiten-Neuladen sichtbar.
 * AK3: ein offenes Formular behält seine Eingaben während und nach dem Refetch.
 * Gegen das echte Backend; der Wechsel in den Vordergrund wird per `visibilityState` + Event simuliert.
 */

const createTaskViaApi = async (page: Page, title: string): Promise<void> => {
	const response = await page.request.post('/api/v1/tasks', { data: { title } });
	expect(response.ok()).toBeTruthy();
};

const returnToForeground = async (page: Page): Promise<void> => {
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
	});
};

const isTasksList = (url: string): boolean => /\/api\/v1\/tasks(\?|$)/.test(url);

test.describe('Balamentum — #2399: Refetch bei Rückkehr in den Vordergrund', () => {
	test('AK4 — per API angelegte Aufgabe erscheint nach der Rückkehr ohne Neuladen', async ({ page }) => {
		await registerOwnSession(page, 'refetch');
		await createTaskViaApi(page, 'Bestand 2399');
		await page.goto('/app/');
		await waitForStableView(page);

		await createTaskViaApi(page, 'Anderes Gerät 2399');
		await returnToForeground(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(taskTitleText(page, 'Anderes Gerät 2399')).toBeVisible();
	});

	test('AK3 — offenes Formular behält die Eingabe nach dem Refetch', async ({ page }) => {
		await registerOwnSession(page, 'refetch-form');
		await createTaskViaApi(page, 'Bestand 2399');
		await page.goto('/app/');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		const title = page.getByRole('textbox', { name: 'Titel' });
		await title.fill('Halbfertiger Entwurf');

		const refetch = page.waitForResponse((r) => r.request().method() === 'GET' && isTasksList(r.url()));
		await returnToForeground(page);
		await refetch;

		await expect(title).toHaveValue('Halbfertiger Entwurf');
	});
});
