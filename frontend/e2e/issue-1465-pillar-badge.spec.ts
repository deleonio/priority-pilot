import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Test für #1465 (C): Aufgabenliste (`TaskTree`) und Serienliste (`SeriesTab`) zeigen an
 * Einträgen ohne Säulen-Gewichtung das Icon-Badge „Keine Säulen-Gewichtung gesetzt"; Einträge mit
 * Beitrag tragen keines. Es ersetzt das beschreibungs-getriebene „Hinweis"-Badge aus #1430 — dessen
 * mobiler Umbruch-Vertrag (375px, Bounding-Box statt `scrollWidth`, die App-Shell clippt
 * `overflow-x`) bleibt erhalten. Läuft gegen das echte Backend (In-Memory-DB, Vite-Proxy).
 */
test.describe('Balamentum — #1465: Säulen-Badge mobil (375px)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `E2E #1465 ${label} ${tail}`;
	};

	/** Erste gewichtete Säule des Kontos — Grundlage für den „mit Beitrag"-Fall. */
	const firstPillarId = async (page: Page): Promise<number> => {
		const response = await page.request.get('/api/v1/pillars');
		expect(response.ok()).toBeTruthy();
		const pillars = (await response.json()) as { id: number }[];
		expect(pillars.length).toBeGreaterThan(0);
		return pillars[0].id;
	};

	const createTaskViaApi = async (page: Page, title: string, pillarId: number | null): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title,
				priority: 3,
				description: 'Bitte Schlüssel mitnehmen',
				...(pillarId === null ? {} : { pillars: [{ pillarId, share: 100 }] }),
			},
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	const createSeriesViaApi = async (page: Page, title: string, pillarId: number | null): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				description: 'Wochenrhythmus beachten',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: new Date().toISOString().slice(0, 10),
				...(pillarId === null ? {} : { pillars: [{ pillarId, share: 100 }] }),
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

	test('Badge nur ohne Säulen-Gewichtung, in beiden Listen, Zeile bleibt innerhalb 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const pillarId = await firstPillarId(page);
		const taskWithout = await createTaskViaApi(page, uniqueTitle('Aufgabe ohne Säule'), null);
		const taskWith = await createTaskViaApi(page, uniqueTitle('Aufgabe mit Säule'), pillarId);
		const seriesWithout = await createSeriesViaApi(page, uniqueTitle('Serie ohne Säule'), null);
		const seriesWith = await createSeriesViaApi(page, uniqueTitle('Serie mit Säule'), pillarId);

		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		const rowWithout = page.getByTestId(`task-list-item-${taskWithout}`);
		await expect(rowWithout.getByTestId('pillar-missing-badge')).toBeVisible();
		await expect(page.getByTestId(`task-list-item-${taskWith}`).getByTestId('pillar-missing-badge')).toHaveCount(0);
		// Das beschreibungs-getriebene Badge aus #1430 gibt es nicht mehr — beide Aufgaben haben eine
		// Beschreibung, keine trägt „Hinweis".
		await expect(page.getByText('Hinweis', { exact: true })).toHaveCount(0);

		const taskBox = await rowWithout.boundingBox();
		expect(taskBox).not.toBeNull();
		expect(taskBox!.x + taskBox!.width, 'Aufgabenzeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);

		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await waitForStableView(page, 'Serien');

		const seriesRow = page.getByTestId(`series-tree-item-${seriesWithout}`);
		await expect(seriesRow.getByTestId('pillar-missing-badge')).toBeVisible();
		await expect(page.getByTestId(`series-tree-item-${seriesWith}`).getByTestId('pillar-missing-badge')).toHaveCount(0);

		const seriesBox = await seriesRow.boundingBox();
		expect(seriesBox).not.toBeNull();
		expect(seriesBox!.x + seriesBox!.width, 'Serienzeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);
	});
});
