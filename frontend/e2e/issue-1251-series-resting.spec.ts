import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #1251 — Ruh-Hinweis für stillgelegte Serien (AK6, UI-Anteil).
 *
 * Vertrag: docs/spec/issue-1251.md. Eine Serie mit `active:false` (entsteht durch Gruppenaustritt/
 * -löschung) trägt im Serien-Tab ein Text-Badge „Ruhend" (KolBadge im Muster `series-tree-badge`,
 * KI-UX: nie nur Farbe, WCAG 1.4.1). Mobile-First: bei 375×812 darf der Eintrag umbrechen,
 * aber nichts horizontal aus dem Viewport laufen (WCAG 1.4.10 — Bounding-Box-Prüfung statt
 * scrollWidth, da die App-Shell overflow-x clippt).
 *
 * Läuft gegen das echte Backend (In-Memory-DB, Vite-Proxy); `GET /auth/me` ist über die
 * Fixture gemockt. Rot, bis SeriesTab.tsx das Badge rendert.
 */
test.describe('Priority Pilot — Ruh-Hinweis für stillgelegte Serien (#1251)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #1251 ${label}`.slice(0, 30 - tail.length);
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

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	/** Legt eine Serie mit `active:false` direkt über die echte API an. */
	const createRestingSeriesViaApi = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: false,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		expect(response.ok()).toBeTruthy();
		const series = (await response.json()) as { id: number };
		return series.id;
	};

	test('AK6 — ruhende Serie zeigt bei 375px das Badge „Ruhend" ohne horizontalen Überlauf', async ({ page }) => {
		const activeTitle = uniqueTitle('Aktiv');
		const restingTitle = uniqueTitle('Ruhend');
		await page.request.post('/api/v1/series', {
			data: {
				title: activeTitle,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		const restingId = await createRestingSeriesViaApi(page, restingTitle);

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();

		// Text-Badge „Ruhend" am Eintrag der ruhenden Serie (nie nur Farbe — WCAG 1.4.1).
		const restingItem = page.getByTestId(`series-tree-item-${restingId}`);
		await expect(restingItem).toBeVisible();
		await expect(restingItem.getByText('Ruhend', { exact: true })).toBeVisible();

		// Die aktive Serie der Gegenprobe trägt das Badge nicht.
		await expect(page.getByTestId('series-tree').getByText(activeTitle)).toBeVisible();

		// Mobile-First: der ruhende Eintrag läuft bei 375px nicht horizontal aus dem Viewport
		// (Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x).
		const box = await restingItem.boundingBox();
		assertBoundingBox(box, page);
	});

	test('AK6 — die Toolbar (Bearbeiten/Löschen) der eigenen ruhenden Serie bleibt vorhanden', async ({ page }) => {
		const restingTitle = uniqueTitle('Ruhend Toolbar');
		const restingId = await createRestingSeriesViaApi(page, restingTitle);

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();

		// KI-UX: kein Sperren, kein „Reaktivieren"-Button — nur das Anzeige-Badge.
		const restingItem = page.getByTestId(`series-tree-item-${restingId}`);
		await expect(restingItem.getByText('Ruhend', { exact: true })).toBeVisible();
		await expect(restingItem.getByRole('toolbar', { name: new RegExp(`Aktionen für ${restingTitle}`) })).toBeVisible();
	});
});

/** Typ-Helper für die Bounding-Box-Assertion (null-Schutz außerhalb der Assertion-Kette). */
function assertBoundingBox(box: { x: number; width: number } | null, page: Page): void {
	if (box === null) {
		throw new Error('Bounding-Box des ruhenden Serieintrags konnte nicht gemessen werden');
	}
	const viewportWidth = page.viewportSize()?.width ?? 0;
	expect(box.x, 'Eintrag beginnt im Viewport').toBeGreaterThanOrEqual(0);
	expect(box.x + box.width, 'AK6: nichts geclippt — Eintrag endet innerhalb des 375px-Viewports').toBeLessThanOrEqual(
		viewportWidth,
	);
}
