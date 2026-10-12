import { expect, test, type Page } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2501 — Checkpunkte an der Serie/Vorlage (AK1).
 * Vertrag: docs/spec/issue-2501.md. Läuft gegen das echte Backend (In-Memory-DB); 375 px.
 * Rot, bis TaskForm den #531-Checklisten-Editor im Serie-Modus rendert (mit Umbenennen und
 * Umsortieren per Auf/ab-Buttons — KI-UX-Beratung).
 */
test.describe('Balamentum — Checkpunkte an der Serie (#2501)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `${`E2E #2501 ${label}`.slice(0, 30 - tail.length)}${tail}`;
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

	const createSeries = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'none',
				priority: 3,
				estimatedEffort: 0.5,
				autoCreate: false,
				active: true,
			},
		});
		expect(response.ok()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	const openSeriesEdit = async (page: Page, seriesId: number): Promise<void> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Serien & Vorlagen', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await page
			.getByTestId(`series-tree-item-${seriesId}`)
			.getByRole('toolbar')
			.getByRole('button', { name: 'Bearbeiten' })
			.click();
		// Die Checkliste liegt in der „Optional"-Accordion-Sektion (#1159/#1260).
		await openAccordionSection(page, 'Optional');
	};

	test('AK1 — Checkpunkte anlegen, umbenennen, umsortieren und entfernen; kein Erledigt-Schalter', async ({ page }) => {
		await registerOwnSession(page, 'series-checklist');
		const seriesId = await createSeries(page, uniqueTitle('CRUD'));
		await openSeriesEdit(page, seriesId);

		const section = page.getByTestId('checklist-section');
		await expect(section).toBeVisible();

		// Anlegen
		await section.getByRole('searchbox', { name: 'Checklisten-Eintrag' }).fill('Einräumen');
		await section.getByRole('button', { name: 'Hinzufügen' }).click();
		await section.getByRole('searchbox', { name: 'Checklisten-Eintrag' }).fill('Abwischen');
		await section.getByRole('button', { name: 'Hinzufügen' }).click();
		await expect(section.getByTestId('checklist-item')).toHaveCount(2);

		// Kein Erledigt-Schalter im Serie-Modus (das Abhaken bleibt an der Instanz)
		for (const item of await section.getByTestId('checklist-item').all()) {
			await expect(item.locator('kol-input-checkbox')).toHaveCount(0);
		}

		// Umbenennen (inline)
		const firstItem = section.getByTestId('checklist-item').first();
		await firstItem.getByRole('textbox').fill('Staubwischen');
		await expect(firstItem.getByRole('textbox')).toHaveValue('Staubwischen');

		// Umsortieren: „Abwischen" nach oben — Reihenfolge tauscht
		await section.getByTestId('checklist-item').nth(1).getByRole('button', { name: 'Nach oben verschieben' }).click();
		await expect(section.getByTestId('checklist-item').first().getByRole('textbox')).toHaveValue('Abwischen');

		// Entfernen
		await section.getByTestId('checklist-item').first().getByRole('button', { name: 'Entfernen' }).click();
		await expect(section.getByTestId('checklist-item')).toHaveCount(1);
		await expect(section.getByTestId('checklist-item').first().getByRole('textbox')).toHaveValue('Staubwischen');
	});

	test('AK1 — Speichern persistiert die Checkpunkte (Reload), Einträge ohne completed', async ({ page }) => {
		await registerOwnSession(page, 'series-checklist');
		const seriesId = await createSeries(page, uniqueTitle('Persistenz'));
		await openSeriesEdit(page, seriesId);

		const section = page.getByTestId('checklist-section');
		await section.getByRole('searchbox', { name: 'Checklisten-Eintrag' }).fill('Erster Schritt');
		await section.getByRole('button', { name: 'Hinzufügen' }).click();
		await section.getByRole('searchbox', { name: 'Checklisten-Eintrag' }).fill('Zweiter Schritt');
		await section.getByRole('button', { name: 'Hinzufügen' }).click();

		await page.getByRole('button', { name: 'Bearbeiten', exact: true }).last().click();
		const confirm = page.getByRole('button', { name: 'Ja', exact: true });
		// Test-Pflege: Kaskade-Modal (#553) rendert asynchron — erst abwarten, dann bestätigen.
		if (
			await confirm.waitFor({ state: 'visible', timeout: 3000 }).then(
				() => true,
				() => false,
			)
		) {
			await confirm.click();
		}

		await expect
			.poll(async () => {
				const all = (await (await page.request.get('/api/v1/series')).json()) as {
					id: number;
					checklist?: { id: string; title: string; completed?: unknown }[];
				}[];
				const saved = all.find((entry) => entry.id === seriesId);
				return saved?.checklist?.map((item) => item.title).join('|') ?? '';
			})
			.toBe('Erster Schritt|Zweiter Schritt');

		// Nach dem Neuladen sind die Checkpunkte unverändert vorhanden (AK1).
		await page.reload();
		await waitForStableView(page);
		await openSeriesEdit(page, seriesId);
		await expect(page.getByTestId('checklist-section').getByTestId('checklist-item')).toHaveCount(2);
		await expect(page.getByTestId('checklist-item').first().getByRole('textbox')).toHaveValue('Erster Schritt');

		// Serien-Einträge tragen keinen Erledigt-Stand (AK3-Spiegel aus Nutzersicht).
		const stored = (
			(await (await page.request.get('/api/v1/series')).json()) as {
				id: number;
				checklist?: Record<string, unknown>[];
			}[]
		).find((entry) => entry.id === seriesId);
		for (const entry of stored?.checklist ?? []) {
			expect(entry).not.toHaveProperty('completed');
		}
	});
});
