import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * Spec-Tests für #1259 „Serienliste mobil responsive layouting" — die vier Akzeptanzkriterien
 * im Tab „Serien" beim Referenz-Viewport 375px (docs/mobile-ui-rules.md):
 *
 *  1. Kein horizontales Scrollen bei 375px.
 *  2. Titel, Rhythmus-Badge und beide Aktionen einer Serie gleichzeitig sichtbar (Zweizeilen-Modell
 *     analog #1258: Titel in Zeile 1, Badges links + Toolbar rechtsbündig in Zeile 2).
 *  3. „Bearbeiten" und „Löschen" mindestens 44×44px (Touch-Target-Minimum, KoliBri
 *     `--a11y-min-size`).
 *  4. Mindestens vier Serien gleichzeitig sichtbar — auch im 0-Task-Zustand: die Dashboard-
 *     Leerzustands-Karte rendert seit #1259 nur noch auf dem Dashboard-Tab, nicht mehr über der
 *     Tab-Leiste des Serien-Tabs.
 *
 * Wie `issue-1258-tasks-mobile.spec.ts` läuft diese Spec gegen das echte Backend (In-Memory-DB,
 * Vite-Proxy); Daten werden über die API angelegt, `afterEach` räumt auf.
 */
test.describe('Priority Pilot — #1259: Serien-Tab mobil (375px)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E #1259 ${label}`.slice(0, 65 - tail.length);
		return `${head} ${tail}`;
	};

	/** Legt eine Serie über die echte API an und gibt ihre `id` zurück. */
	const createSeriesViaApi = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
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

	/** Räumt alle Serien (und generierte Instanzen) über die echte API ab. */
	const deleteAllSeries = async (page: Page): Promise<void> => {
		for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		for (const entry of (await (await page.request.get('/api/v1/series')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllSeries(page);
	});

	/** Öffnet den Serien-Tab. */
	const openSeriesView = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await waitForStableView(page, 'Serien');
	};

	test('AK1: kein horizontaler Überlauf bei 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createSeriesViaApi(page, uniqueTitle('OhneScroll'));
		// Härtester legitimer Titel: 64-Zeichen-Einzelwort (Schema-Limit 65, analog #1258 AK3).
		await createSeriesViaApi(page, 'Donaudampfschifffahrtsgesellschaftskapitaen'.padEnd(64, 'x'));
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesView(page);

		const items = page.locator('.series-tree-item');
		await expect(items).toHaveCount(2);
		for (let i = 0; i < 2; i += 1) {
			const box = await items.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x + box!.width, 'Zeile bleibt in der 375px-Breite').toBeLessThanOrEqual(375 + 1);
		}
		const host = page.locator('.series-section');
		const { scroller } = await host.evaluate(measureHorizontalScroll);
		expect(scroller, 'kein horizontaler Scroll-Container in der Serien-Sektion').toBeNull();
	});

	test('AK2: Titel, Rhythmus-Badge und beide Aktionen gleichzeitig sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const longWord = 'Donaudampfschifffahrtsgesell';
		await createSeriesViaApi(page, longWord);
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesView(page);

		const row = page.locator('.series-tree-item').first();
		const parts = {
			titel: row.locator('.series-tree-title'),
			badge: row.locator('.series-tree-badge--rhythm'),
			edit: row.getByRole('button', { name: 'Bearbeiten' }),
			del: row.getByRole('button', { name: 'Löschen' }),
		};
		for (const [name, locator] of Object.entries(parts)) {
			const box = await locator.boundingBox();
			expect(box, `${name} gerendert`).not.toBeNull();
			expect(box!.x + box!.width, `${name} innerhalb 375px`).toBeLessThanOrEqual(375 + 1);
			// Vollständige Sichtbarkeit im Viewport (nicht unter die Falz gerutscht).
			expect(box!.y + box!.height, `${name} vollständig sichtbar`).toBeLessThanOrEqual(812);
		}
		// Zweizeilen-Modell (#1258-Muster): Toolbar rechtsbündig am Controls-Rechteck.
		const controls = await row.locator('.series-tree-row-controls').boundingBox();
		const actions = await row.locator('.series-tree-actions').boundingBox();
		expect(controls).not.toBeNull();
		expect(actions).not.toBeNull();
		expect(actions!.x + actions!.width, 'Toolbar rechtsbündig in der Controls-Zeile').toBeGreaterThanOrEqual(
			controls!.x + controls!.width - 1.5,
		);
		// Der vollständige Titeltext ist gerendert (ggf. umgebrochen, nicht abgeschnitten).
		await expect(row.getByText(longWord)).toBeVisible();
	});

	test('AK3: „Bearbeiten" und „Löschen" mindestens 44×44px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createSeriesViaApi(page, uniqueTitle('Target44'));
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesView(page);

		const row = page.locator('.series-tree-item').first();
		for (const name of ['Bearbeiten', 'Löschen'] as const) {
			const box = await row.getByRole('button', { name }).boundingBox();
			expect(box, `${name} vorhanden`).not.toBeNull();
			// 0,5px-Toleranz gegen Subpixel-Rundung (KoliBri erzwingt 44px über `--a11y-min-size`).
			expect(box!.width, `${name} Breite ≥44`).toBeGreaterThanOrEqual(44 - 0.5);
			expect(box!.height, `${name} Höhe ≥44`).toBeGreaterThanOrEqual(44 - 0.5);
		}
	});

	test('AK4: mindestens vier Serien gleichzeitig sichtbar — auch ohne Task (375×812)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const ids: number[] = [];
		for (let i = 0; i < 5; i += 1) {
			ids.push(await createSeriesViaApi(page, uniqueTitle(`Sichtbar${i}`)));
		}
		await page.goto('/');
		await waitForStableView(page);
		await openSeriesView(page);

		// Regressions-Anker: die Dashboard-Leerzustands-Karte darf auf dem Serien-Tab nicht rendern.
		await expect(page.getByText('Noch keine Aufgaben')).toHaveCount(0);

		// Vollständig sichtbar = Zeilen-Unterkante innerhalb des Viewports (812px) — gleichzeitig,
		// ohne zu scrollen.
		let fullyVisible = 0;
		for (const id of ids) {
			const box = await page.getByTestId(`series-tree-item-${id}`).boundingBox();
			expect(box).not.toBeNull();
			if (box!.y + box!.height <= 812) fullyVisible += 1;
		}
		expect(fullyVisible, 'vier Serien ohne Scrollen vollständig im Viewport').toBeGreaterThanOrEqual(4);
	});
});
