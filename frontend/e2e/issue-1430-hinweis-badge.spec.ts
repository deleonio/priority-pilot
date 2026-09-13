import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Test für #1430 (AK5, docs/spec/issue-1430.md): Ein Task und eine Serie mit nicht-leerem
 * `description` zeigen in Aufgabenliste (`TaskTree`) und Serienliste (`SeriesTab`) das Text-Badge
 * „Hinweis"; bei 375px bricht die Badge-Zeile um, ohne dass die Listenzeile horizontal über den
 * Viewport hinausragt (Zweizeilen-Modell #1258/#1259 — Bounding-Box statt `scrollWidth`, die
 * App-Shell clippt `overflow-x`). Läuft gegen das echte Backend (In-Memory-DB, Vite-Proxy).
 */
test.describe('Priority Pilot — #1430: Hinweis-Badge mobil (375px)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `E2E #1430 ${label} ${tail}`;
	};

	const createTaskViaApi = async (page: Page, title: string, description: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', { data: { title, priority: 3, description } });
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	const createSeriesViaApi = async (page: Page, title: string, description: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				description,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: new Date().toISOString().slice(0, 10),
			},
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	test.afterEach(async ({ page }) => {
		for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		for (const entry of (await (await page.request.get('/api/v1/series')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	});

	test('AK5: Hinweis-Badge in beiden Listen sichtbar, Zeile bleibt innerhalb 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const taskId = await createTaskViaApi(page, uniqueTitle('Aufgabe'), 'Bitte Schlüssel mitnehmen');
		const seriesId = await createSeriesViaApi(page, uniqueTitle('Serie'), 'Wochenrhythmus beachten');
		await page.goto('/');
		await waitForStableView(page);

		const taskRow = page.getByTestId(`task-list-item-${taskId}`);
		await expect(taskRow.getByText('Hinweis')).toBeVisible();
		const taskBox = await taskRow.boundingBox();
		expect(taskBox).not.toBeNull();
		expect(taskBox!.x + taskBox!.width, 'Aufgabenzeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);

		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await waitForStableView(page, 'Serien');

		const seriesRow = page.getByTestId(`series-tree-item-${seriesId}`);
		await expect(seriesRow.getByText('Hinweis')).toBeVisible();
		const seriesBox = await seriesRow.boundingBox();
		expect(seriesBox).not.toBeNull();
		expect(seriesBox!.x + seriesBox!.width, 'Serienzeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);
	});
});
