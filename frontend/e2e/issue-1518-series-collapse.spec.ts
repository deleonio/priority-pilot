import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Test für #1518 (Spec docs/spec/issue-1518.md, Journey 1): Eine tägliche Serie mit fünf offenen
 * Instanzen erscheint in der Aufgabenliste als genau EINE Zeile (AK11) mit Serien-Icon und
 * Screenreader-Text „Serienaufgabe" statt des Text-Badges „Serie"; die Zeile bleibt bei 375px innerhalb
 * des Viewports (AK12, Bounding-Box statt `scrollWidth` — die App-Shell clippt `overflow-x`). Der Graph
 * (Tab „Wald", `GET /graph`) und der Serien-Tab zeigen weiterhin alle Instanzen bzw. die Serie (AK13).
 * Läuft gegen das echte Backend (In-Memory-DB, Vite-Proxy).
 */
test.describe('Balamentum — #1518: eine Instanz je Serie in der Aufgabenliste (375px)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `E2E #1518 ${label} ${tail}`;
	};

	const dayFromTodayUtc = (days: number): string => {
		const day = new Date();
		day.setUTCHours(0, 0, 0, 0);
		return new Date(day.getTime() + days * 86_400_000).toISOString();
	};

	const createDailySeriesViaApi = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'daily',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: dayFromTodayUtc(0),
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

	test('AK11–AK13: eine Zeile mit Icon je Serie, Zeile innerhalb 375px, Graph zeigt alle Instanzen', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const title = uniqueTitle('Täglich');
		const seriesId = await createDailySeriesViaApi(page, title);
		const generated = await page.request.post(`/api/v1/series/${seriesId}/generate`, {
			data: { until: dayFromTodayUtc(30) },
		});
		expect(generated.ok()).toBeTruthy();
		const instances = (await generated.json()) as { id: number; deadline: string }[];
		// AK10: fünf offene Instanzen — nicht 30 Tage im Voraus.
		expect(instances.length).toBe(5);
		const earliest = [...instances].sort((a, b) => a.deadline.localeCompare(b.deadline))[0];

		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		// AK11: genau eine Zeile — die Instanz mit der frühesten Deadline ab heute.
		const section = page.locator('.task-section');
		await expect(section.getByText(title, { exact: true })).toHaveCount(1);
		const row = page.getByTestId(`task-list-item-${earliest.id}`);
		await expect(row).toBeVisible();
		await expect(row.getByRole('img', { name: 'Serienaufgabe' })).toBeVisible();
		await expect(section.getByText('Serie', { exact: true })).toHaveCount(0);

		// AK12: kein horizontaler Überlauf bei 375px.
		const box = await row.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x + box!.width, 'Aufgabenzeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);

		// AK13: der Graph (Tab „Wald") kennt weiterhin alle fünf Instanzen.
		const graph = (await (await page.request.get('/api/v1/graph')).json()) as { nodes: { title: string }[] };
		expect(graph.nodes.filter((node) => node.title === title).length).toBe(5);

		// AK13: der Serien-Tab zeigt die Serie unverändert.
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId(`series-tree-item-${seriesId}`)).toBeVisible();
	});
});
