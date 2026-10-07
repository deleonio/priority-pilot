import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2358 — Serien als Vorlage (AK5, AK6, AK8).
 * Vertrag: docs/spec/issue-2358.md. Läuft gegen das echte Backend (In-Memory-DB); 375 px.
 * Rot, bis TaskForm den Schalter „Automatisch anlegen" und SeriesTab das Badge „Vorlage" rendert.
 */
test.describe('Balamentum — Serie als Vorlage (#2358)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `${`E2E #2358 ${label}`.slice(0, 30 - tail.length)}${tail}`;
	};

	const deleteAll = async (page: Page): Promise<void> => {
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	const createSeries = async (page: Page, title: string, autoCreate: boolean): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: autoCreate ? 'weekly' : 'none',
				priority: 3,
				estimatedEffort: 0.5,
				autoCreate,
				...(autoCreate ? { startDate: '2026-09-07T00:00:00.000Z' } : {}),
			},
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	const openSeriesTab = async (page: Page): Promise<void> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien & Vorlagen', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
	};

	test('AK6/AK7 — Tab „Serien & Vorlagen": nur die Vorlage trägt das Badge „Vorlage"', async ({ page }) => {
		const templateId = await createSeries(page, uniqueTitle('Vorlage'), false);
		const autoId = await createSeries(page, uniqueTitle('Auto'), true);

		await openSeriesTab(page);

		await expect(
			page.getByTestId(`series-tree-item-${templateId}`).getByText('Vorlage', { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId(`series-tree-item-${autoId}`).getByText('Vorlage', { exact: true })).toHaveCount(0);
	});

	test('AK5/AK8 — Schalter beim Bearbeiten: gespeicherter Wert, Umstellen persistiert, Touch-Höhe ≥ 44 px', async ({
		page,
	}) => {
		const templateId = await createSeries(page, uniqueTitle('Edit'), false);
		await openSeriesTab(page);

		const item = page.getByTestId(`series-tree-item-${templateId}`);
		await item.getByRole('toolbar').getByRole('button', { name: 'Bearbeiten' }).click();

		const toggle = page.getByRole('switch', { name: 'Automatisch anlegen' });
		await expect(toggle).toBeVisible();
		await expect(toggle).not.toBeChecked();

		// AK8: Touch-Höhe per Bounding-Box (die App-Shell clippt, daher kein scrollWidth).
		const switchBox = await toggle.boundingBox();
		expect(switchBox?.height ?? 0, 'Schalter ≥ 44 px').toBeGreaterThanOrEqual(44);
		const rhythmBox = await page.getByLabel('Rhythmus').boundingBox();
		expect(rhythmBox?.height ?? 0, 'Rhythmus-Auswahl ≥ 44 px').toBeGreaterThanOrEqual(44);

		// AK8: per Tastatur bedienbar.
		await toggle.focus();
		await page.keyboard.press('Space');
		await expect(toggle).toBeChecked();

		await page.getByRole('button', { name: 'Bearbeiten', exact: true }).last().click();
		const confirm = page.getByRole('button', { name: 'Ja', exact: true });
		if (await confirm.isVisible().catch(() => false)) {
			await confirm.click();
		}

		await expect
			.poll(async () => {
				const all = (await (await page.request.get('/api/v1/series')).json()) as {
					id: number;
					autoCreate: boolean;
					rhythm: string;
				}[];
				const saved = all.find((entry) => entry.id === templateId);
				return saved === undefined ? null : `${saved.autoCreate}:${saved.rhythm !== 'none'}`;
			})
			.toBe('true:true');
	});
});
