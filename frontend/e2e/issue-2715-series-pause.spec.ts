import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2715 — Serien pausieren und fortsetzen (AK1/AK2/AK3/AK5/AK6, UI-Anteil).
 *
 * Vertrag: docs/spec/issue-2715.md. Aus der Serien-Verwaltung lässt sich jede eigene
 * Automatik-Serie ohne Bestätigungsdialog pausieren (PATCH `active:false`) und jederzeit
 * fortsetzen; der Pausen-Zustand zeigt sich über das bestehende Text-Badge „Ruhend" (#1251).
 * Mobile-First: bei 375×812 bleibt die Aktion als Touch-Target ≥ 44px bedienbar, ohne dass der
 * Eintrag horizontal aus dem Viewport läuft (Bounding-Box statt scrollWidth — die App-Shell
 * clippt overflow-x, Muster issue-1251-series-resting.spec.ts).
 *
 * Läuft gegen das echte Backend (In-Memory-DB, Vite-Proxy, eigene Session je Test);
 * POST /series mit daily-Rhythmus legt sofort bis zu 5 Instanzen an (#2404) — dieser Bestand
 * dient AK3. Rot, bis SeriesTab die Aktionen rendert.
 */
test.describe('Balamentum — Serien pausieren und fortsetzen (#2715)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #2715 ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Räumt alle Tasks und Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	/** Legt eine aktive Automatik-Serie an — POST erzeugt sofort bis zu 5 Instanzen (#2404). */
	const createDailySeriesViaApi = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'daily',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				autoCreate: true,
				startDate: new Date().toISOString(),
			},
		});
		expect(response.ok()).toBeTruthy();
		const series = (await response.json()) as { id: number };
		return series.id;
	};

	const tasksOfSeries = async (page: Page, seriesId: number): Promise<{ id: number }[]> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as {
			id: number;
			seriesId: number | null;
		}[];
		return tasks.filter((task) => task.seriesId === seriesId);
	};

	const openSeriesTab = async (page: Page): Promise<void> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien & Vorlagen', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	test('AK1/AK2/AK5/AK6 — Pausieren wirkt sofort: Touch-Target, „Ruhend"-Badge, Fortsetzen nimmt zurück', async ({
		page,
	}) => {
		const title = uniqueTitle('Pausieren');
		const seriesId = await createDailySeriesViaApi(page, title);

		await openSeriesTab(page);
		const item = page.getByTestId(`series-tree-item-${seriesId}`);
		const pauseButton = item.getByRole('button', { name: 'Serie pausieren' });
		await expect(pauseButton).toBeVisible();

		// AK1: Touch-Target ≥ 44px, bedienbar im 375px-Viewport, kein horizontaler Überlauf.
		const box = await pauseButton.boundingBox();
		expect(box, 'Button-Bounding-Box messbar').not.toBeNull();
		expect(box?.height, 'AK1: Touch-Target mindestens 44px hoch').toBeGreaterThanOrEqual(44);
		expect(box?.x, 'AK1: Button beginnt im Viewport').toBeGreaterThanOrEqual(0);
		expect((box?.x ?? 0) + (box?.width ?? 0), 'AK1: Button endet im 375px-Viewport').toBeLessThanOrEqual(375);

		// AK2/AK5: Pausieren ohne Dialog — Badge „Ruhend" erscheint, „Fortsetzen" übernimmt den Platz.
		await pauseButton.click();
		await expect(item.getByText('Ruhend', { exact: true })).toBeVisible();
		const resumeButton = item.getByRole('button', { name: 'Fortsetzen' });
		await expect(resumeButton).toBeVisible();

		// AK6: jederzeit umkehrbar — Fortsetzen stellt den Ausgangszustand wieder her.
		await resumeButton.click();
		await expect(item.getByText('Ruhend', { exact: true })).toBeHidden();
		await expect(item.getByRole('button', { name: 'Serie pausieren' })).toBeVisible();
	});

	test('AK3 — bestehende Instanzen bleiben nach dem Pausieren sichtbar (Pausieren löscht nichts)', async ({ page }) => {
		const title = uniqueTitle('Bestand');
		const seriesId = await createDailySeriesViaApi(page, title);
		const before = await tasksOfSeries(page, seriesId);
		expect(before.length, 'Setup: POST legt sofort Instanzen an (#2404)').toBeGreaterThanOrEqual(1);

		await openSeriesTab(page);
		const item = page.getByTestId(`series-tree-item-${seriesId}`);
		await item.getByRole('button', { name: 'Serie pausieren' }).click();
		await expect(item.getByText('Ruhend', { exact: true })).toBeVisible();

		const after = await tasksOfSeries(page, seriesId);
		expect(after.length, 'AK3: Pausieren löscht keine bestehenden Instanzen').toBe(before.length);

		// … und die Instanzen bleiben in der Aufgabenansicht sichtbar. Über `task-list-item-<id>`
		// gescopet: `getByText(title)` träfe zusätzlich die (bei aktivem Aufgaben-Tab verborgene)
		// „Nächste Aufgabe“-Karte des Dashboards — KolTabs hält inaktive Panels gemountet.
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(page.getByTestId(`task-list-item-${after[0]!.id}`)).toBeVisible();
	});
});
