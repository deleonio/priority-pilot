import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1994 (docs/spec/issue-1994.md AK5/AK6/AK7): drei große, mehrfach verschobene
 * Aufgaben ⇒ die Next-Task-Karte zeigt den Aufteilen-Satz (375 px, im Viewport); nach Abschalten des
 * Schalters in den Einstellungen verschwindet er. Echtes Backend.
 */
const switchLocator = (page: Page) =>
	page
		.getByRole('checkbox', { name: /hinweis zum aufteilen/i })
		.or(page.getByRole('switch', { name: /hinweis zum aufteilen/i }));

// Fristen innerhalb des Vorlaufs (#1641, 3 Tage), sonst hält `GET /next` die Aufgaben zurück.
const inTagen = (tage: number): string => new Date(Date.now() + tage * 24 * 60 * 60 * 1000).toISOString();

const deleteAllTasks = async (page: Page): Promise<void> => {
	const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
	for (const task of tasks) await page.request.delete(`/api/v1/tasks/${task.id}`);
};

test.describe('Balamentum — #1994: Aufteilen-Hinweis', () => {
	test.afterEach(async ({ page }) => {
		await page.request.put('/api/v1/split-hint-config', { data: { splitHintEnabled: true } });
		await deleteAllTasks(page);
	});

	test('AK5/AK6/AK7 — 375px: Satz an der Karte, nach Abschalten verschwunden', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await deleteAllTasks(page);
		for (const i of [1, 2, 3]) {
			const created = await page.request.post('/api/v1/tasks', {
				data: { title: `Große Aufgabe ${i}`, priority: 3, estimatedEffort: 0.8, deadline: inTagen(0) },
			});
			expect(created.ok()).toBeTruthy();
			const { id } = (await created.json()) as { id: number };
			// Frist zweimal nach hinten setzen ⇒ postponeCount 2 (#1964, echte Route, kein Mock).
			for (const deadline of [inTagen(1), inTagen(2)]) {
				await page.request.patch(`/api/v1/tasks/${id}`, { data: { deadline } });
			}
		}

		await page.goto('/app/');
		await waitForStableView(page);
		const satz = page.locator('.dashboard-next-task-reasons').getByText(/kleinere Schritte/i);
		await expect(satz).toBeVisible();
		const box = await satz.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(-1);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		await page.goto('/app/settings/general');
		await waitForStableView(page, 'Balamentum');
		await expect(switchLocator(page)).toBeChecked();
		await switchLocator(page).click();
		await expect
			.poll(
				async () =>
					((await (await page.request.get('/api/v1/split-hint-config')).json()) as { splitHintEnabled: boolean })
						.splitHintEnabled,
			)
			.toBe(false);

		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.getByText(/kleinere Schritte/i)).toHaveCount(0);
	});
});
