import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1063 „Geo-Badge in Listen" (Spec docs/spec/issue-1063.md).
 *
 * Vertrag: Einträge mit Ortsbezug (`address`) zeigen ein Globus-Badge (Font Awesome
 * `fa-solid fa-globe`, icon-only, rein informativ) — in der Serienliste (`SeriesTab`) und in der
 * Erledigt-Liste (`CompletedTasksTable`). Der TaskTree zeigt bewusst KEIN Badge (bindende
 * Entscheidung im Issue-Body). Das Badge ist icon-only und transportiert seine Bedeutung für
 * assistive Technologien über `aria-label` mit „Standort" (BITV, KI-UX-Block); Test-Anker ist
 * `data-testid="geo-badge"`.
 *
 * Wie `series-tab.spec.ts` / `completed-tasks.spec.ts` laufen diese Specs gegen das echte
 * Backend (In-Memory-DB, Vite-Proxy). Daten werden direkt über die API angelegt, `afterEach`
 * räumt auf. Rot, bis `address` an Serien (AK1) existiert und beide Listen das Badge rendern.
 */
test.describe('Priority Pilot — #1063: Geo-Badge in Serien- und Erledigt-Liste', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #1063 ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	/** Legt eine Serie mit optionaler Adresse über die echte API an; gibt die `id` zurück. */
	const createSeriesViaApi = async (page: Page, title: string, address?: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
				...(address === undefined ? {} : { address }),
			},
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	/** Legt einen Task mit optionaler Adresse an und markiert ihn optional per API als erledigt. */
	const createTaskViaApi = async (page: Page, title: string, done: boolean, address?: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, ...(address === undefined ? {} : { address }) },
		});
		expect(response.ok()).toBeTruthy();
		const id = ((await response.json()) as { id: number }).id;
		if (done) {
			const patch = await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
			expect(patch.ok()).toBeTruthy();
		}
		return id;
	};

	/** Räumt erst alle Tasks (inkl. Instanzen), dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		for (const series of (await (await page.request.get('/api/v1/series')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/series/${series.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	const openSeriesTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
	};

	const openCompletedView = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('checkbox', { name: /Erledigte Aufgaben/i }).check();
		await waitForStableView(page);
	};

	const openTasksView = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await page.getByRole('checkbox', { name: /Erledigte Aufgaben/i }).uncheck();
		await waitForStableView(page);
	};

	// AK4 — Serienliste: Globus-Badge nur bei Serien mit Adresse, mit „Standort"-aria-label.
	test('AK4 — Serie mit Adresse zeigt Globus-Badge in der Serienzeile, Serie ohne Adresse keins', async ({ page }) => {
		const withAddress = uniqueTitle('MitOrt');
		const withoutAddress = uniqueTitle('OhneOrt');
		const idWith = await createSeriesViaApi(page, withAddress, 'Musterstraße 1, 12345 Musterstadt');
		const idWithout = await createSeriesViaApi(page, withoutAddress);

		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);

		// Serie mit Adresse: Badge sichtbar, icon-only mit „Standort"-aria-label (BITV).
		const badge = page.getByTestId('series-tree-item-' + idWith).getByTestId('geo-badge');
		await expect(badge).toBeVisible();
		await expect(badge).toHaveAttribute('aria-label', /Standort/i);

		// Serie ohne Adresse: kein Badge.
		await expect(page.getByTestId('series-tree-item-' + idWithout).getByTestId('geo-badge')).toHaveCount(0);
	});

	// AK5 — Erledigt-Liste: Badge nur bei erledigten Tasks mit Adresse; TaskTree zeigt keins.
	test('AK5 — Erledigter Task mit Adresse zeigt Globus-Badge; Task ohne Adresse keins; TaskTree ohne Badge', async ({
		page,
	}) => {
		const doneWithAddress = uniqueTitle('DoneOrt');
		const doneWithoutAddress = uniqueTitle('DoneOhn');
		const openWithAddress = uniqueTitle('OffenOrt');
		await createTaskViaApi(page, doneWithAddress, true, 'Hauptplatz 3, 10115 Berlin');
		await createTaskViaApi(page, doneWithoutAddress, true);
		const openId = await createTaskViaApi(page, openWithAddress, false, 'Weg 4, 10115 Berlin');

		await page.goto('/');
		await waitForStableView(page);
		await openCompletedView(page);

		// Erledigt-Zeile mit Adresse: Badge sichtbar (Rollen-Locator pierct das KolTable-Shadow-DOM).
		const doneRow = page.getByRole('row').filter({ hasText: doneWithAddress });
		await expect(doneRow).toBeVisible();
		await expect(doneRow.getByTestId('geo-badge')).toBeVisible();

		// Erledigt-Zeile ohne Adresse: kein Badge.
		const plainRow = page.getByRole('row').filter({ hasText: doneWithoutAddress });
		await expect(plainRow).toBeVisible();
		await expect(plainRow.getByTestId('geo-badge')).toHaveCount(0);

		// TaskTree (offene Aufgaben): der offene Task mit Adresse ist sichtbar, hat aber KEIN Badge.
		await openTasksView(page);
		const treeItem = page.getByTestId(`task-list-item-${openId}`);
		await expect(treeItem).toBeVisible();
		await expect(treeItem.getByTestId('geo-badge')).toHaveCount(0);
	});

	// AK6 — Mobile 375px: das Badge verursacht in beiden Listen keinen horizontalen Überlauf.
	test('AK6 — 375px: Badge verursacht in Serienliste und Erledigt-Liste keinen Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const seriesTitle = uniqueTitle('MobilSerie');
		const doneTitle = uniqueTitle('MobilDone');
		await createSeriesViaApi(page, seriesTitle, 'Lange Musterstraße 123, 12345 Musterstadt, Brandenburg');
		await createTaskViaApi(page, doneTitle, true, 'Lange Musterstraße 123, 12345 Musterstadt, Brandenburg');

		// Serienliste: Zeile bleibt vollständig in der Viewport-Breite (Bounding-Box, nicht
		// scrollWidth — die App-Shell clippt mit overflow-x: hidden, siehe issue-1020-Spec).
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesTab(page);
		const row = page.getByTestId('series-tree').locator('li[class*="series-tree-item"]').first();
		await expect(page.getByTestId('geo-badge').first()).toBeVisible();
		const rowBox = await row.boundingBox();
		expect(rowBox).not.toBeNull();
		expect(rowBox!.x).toBeGreaterThanOrEqual(0);
		expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(375 + 1);

		// Erledigt-Liste: KolTable-Host bleibt in der Seitenbreite, Badge-Stelle erreichbar.
		await openCompletedView(page);
		const host = page.locator('.completed-tasks kol-table-stateful');
		await expect(host).toBeVisible();
		const hostRight = await host.evaluate((el) => el.getBoundingClientRect().right);
		expect(hostRight).toBeLessThanOrEqual(375 + 1);
	});
});
