import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests (#399): Aufgaben und erledigte Aufgaben zusammenführen — ein Aufgaben-Tab mit
 * Such-Filter nach Titel und Switch zwischen offenen und erledigten Aufgaben.
 *
 * Wie `crud.spec.ts` laufen diese Specs gegen das **echte** Backend (In-Memory-DB, kein `page.route`).
 * Die Tests legen ihre Daten über die UI/echte API selbst an und räumen in `afterEach` wieder auf.
 *
 * Der Aufgaben-Tab, der Suchfilter und der Offen/Erledigt-Switch existieren noch NICHT — die Tests
 * sind rot, bis die Umsetzung sie bereitstellt.
 */
test.describe('Priority Pilot — Aufgaben-Tab mit Filter und Switch (#399) gegen das echte Backend', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E ${label} #${(runId += 1)}-${Date.now()}`;

	/** Löscht alle aktuell vorhandenen Tasks über die echte API (Vite-Proxy → Backend). */
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/**
	 * Legt über die UI einen Task mit dem gegebenen Titel an (Default-Felder genügen der Validierung)
	 * und wartet, bis der Dialog geschlossen ist.
	 */
	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	/** Öffnet das Aktionen-Popover des ersten Tasks und klickt den „Erledigt"-Toggle. */
	const markTaskDoneViaUi = async (page: Page): Promise<void> => {
		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		const isTasksTabVisible = await tasksTab.isVisible();

		if (isTasksTabVisible) {
			await tasksTab.click();
		}

		await page
			.getByRole('button', { name: /Weitere Aktionen/i })
			.first()
			.click();
		const doneButton = page.getByRole('button', { name: 'Erledigt' }).first();
		await expect(doneButton).toBeVisible();
		await doneButton.click();
		await waitForStableView(page);
	};

	test('AK1: Ein Aufgaben-Tab — kein separater „Erledigte Aufgaben"-Tab', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const openTitle = uniqueTitle('Offen');
		await createTaskViaUi(page, openTitle);

		// Genau ein Aufgaben-Tab existiert (kein separater „Erledigte Aufgaben"-Tab).
		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await expect(tasksTab).toBeVisible();

		const completedTab = page.getByRole('tab', { name: 'Erledigte Aufgaben', exact: true });
		await expect(completedTab).not.toBeVisible();

		// Im Aufgaben-Tab sind Suchfeld und Switch vorhanden.
		await tasksTab.click();

		const searchInput = page.getByRole('textbox', { name: /suchen|filter|titel/i });
		await expect(searchInput).toBeVisible();

		const switchOpen = page.getByRole('radio', { name: 'Offen' });
		const switchDone = page.getByRole('radio', { name: 'Erledigt' });
		await expect(switchOpen).toBeVisible();
		await expect(switchDone).toBeVisible();

		// Default zeigt den Baum offener Aufgaben.
		await expect(switchOpen).toBeChecked();
		await expect(page.getByText(openTitle, { exact: true })).toBeVisible();
	});

	test('AK2: Switch wechselt zwischen offenem Baum und erledigter Tabelle', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const openTitle = uniqueTitle('Offen');
		const doneTitle = uniqueTitle('Erledigt');

		await createTaskViaUi(page, openTitle);
		await createTaskViaUi(page, doneTitle);
		await markTaskDoneViaUi(page);

		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await tasksTab.click();

		const switchOpen = page.getByRole('radio', { name: 'Offen' });
		const switchDone = page.getByRole('radio', { name: 'Erledigt' });

		// Default: Offen ist ausgewählt, offener Task sichtbar.
		await expect(switchOpen).toBeChecked();
		await expect(page.getByText(openTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneTitle, { exact: true })).not.toBeVisible();

		// Auf „Erledigt" schalten → Tabelle erscheint.
		await switchDone.click();
		await waitForStableView(page);

		await expect(switchDone).toBeChecked();
		await expect(page.getByText(doneTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(openTitle, { exact: true })).not.toBeVisible();

		// Zurück auf „Offen" → Baum erscheint wieder.
		await switchOpen.click();
		await waitForStableView(page);

		await expect(switchOpen).toBeChecked();
		await expect(page.getByText(openTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneTitle, { exact: true })).not.toBeVisible();
	});

	test('AK3: Titel-Filter im offenen Baum (inkl. Kontext)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const matchTitle = uniqueTitle('Matching Parent');
		const nonMatchTitle = uniqueTitle('Non-Matching');
		const childMatchTitle = uniqueTitle('Child Matching');

		// Struktur: Matching Parent → Child Matching + Non-Matching Child
		await createTaskViaUi(page, matchTitle);
		await createTaskViaUi(page, nonMatchTitle);

		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await tasksTab.click();

		const searchInput = page.getByRole('textbox', { name: /suchen|filter|titel/i });

		// Ohne Filter: beide Tasks sichtbar.
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(nonMatchTitle, { exact: true })).toBeVisible();

		// Mit Filter „Matching": Matching Parent bleibt sichtbar, Non-Matching verschwindet.
		await searchInput.fill('Matching');
		await waitForStableView(page);

		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(nonMatchTitle, { exact: true })).not.toBeVisible();

		// Filter leeren → wieder beide sichtbar.
		await searchInput.fill('');
		await waitForStableView(page);

		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(nonMatchTitle, { exact: true })).toBeVisible();
	});

	test('AK4: Titel-Filter in der erledigten Tabelle', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const doneMatchTitle = uniqueTitle('Done Matching');
		const doneNonMatchTitle = uniqueTitle('Done Non-Matching');
		const openTitle = uniqueTitle('Open Task');

		await createTaskViaUi(page, doneMatchTitle);
		await createTaskViaUi(page, doneNonMatchTitle);
		await createTaskViaUi(page, openTitle);

		await markTaskDoneViaUi(page);
		await markTaskDoneViaUi(page);

		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await tasksTab.click();

		const switchDone = page.getByRole('radio', { name: 'Erledigt' });
		await switchDone.click();
		await waitForStableView(page);

		const searchInput = page.getByRole('textbox', { name: /suchen|filter|titel/i });

		// Ohne Filter: beide erledigten Tasks sichtbar.
		await expect(page.getByText(doneMatchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneNonMatchTitle, { exact: true })).toBeVisible();

		// Mit Filter „Matching": nur Done Matching sichtbar.
		await searchInput.fill('Matching');
		await waitForStableView(page);

		await expect(page.getByText(doneMatchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneNonMatchTitle, { exact: true })).not.toBeVisible();

		// Filter leeren → wieder beide sichtbar.
		await searchInput.fill('');
		await waitForStableView(page);

		await expect(page.getByText(doneMatchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneNonMatchTitle, { exact: true })).toBeVisible();
	});

	test('AK5: Keine Treffer → klare Leerhinweis-Meldung', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const openTitle = uniqueTitle('Offen');
		await createTaskViaUi(page, openTitle);

		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await tasksTab.click();

		const searchInput = page.getByRole('textbox', { name: /suchen|filter|titel/i });

		// Filter ohne Treffer im offenen Baum.
		await searchInput.fill('NonExistentTask123');
		await waitForStableView(page);

		await expect(
			page.getByText('Keine Aufgaben gefunden. Passen Sie ggf. die Filter an.', { exact: true }),
		).toBeVisible();

		// Gleicher Test in erledigter Tabelle.
		const doneTitle = uniqueTitle('Erledigt');
		await createTaskViaUi(page, doneTitle);
		await markTaskDoneViaUi(page);

		const switchDone = page.getByRole('radio', { name: 'Erledigt' });
		await switchDone.click();
		await waitForStableView(page);

		await expect(
			page.getByText('Keine Aufgaben gefunden. Passen Sie ggf. die Filter an.', { exact: true }),
		).toBeVisible();
	});

	test('AK6: Suchtext wird beim Umschalten erhalten', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const openTitle = uniqueTitle('Open Test');
		const doneTitle = uniqueTitle('Done Test');

		await createTaskViaUi(page, openTitle);
		await createTaskViaUi(page, doneTitle);
		await markTaskDoneViaUi(page);

		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await tasksTab.click();

		const searchInput = page.getByRole('textbox', { name: /suchen|filter|titel/i });
		const switchOpen = page.getByRole('radio', { name: 'Offen' });
		const switchDone = page.getByRole('radio', { name: 'Erledigt' });

		// Suchtext im offenen Baum eingeben.
		await searchInput.fill('Test');
		await waitForStableView(page);

		const searchValueBefore = await searchInput.inputValue();
		expect(searchValueBefore).toBe('Test');

		// Auf „Erledigt" schalten → Suchtext bleibt erhalten.
		await switchDone.click();
		await waitForStableView(page);

		const searchValueAfter = await searchInput.inputValue();
		expect(searchValueAfter).toBe('Test');

		// Zurück auf „Offen" → Suchtext immer noch erhalten.
		await switchOpen.click();
		await waitForStableView(page);

		const searchValueBack = await searchInput.inputValue();
		expect(searchValueBack).toBe('Test');
	});

	test('AK7: Mobile-First (375px) — kein horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		const mobileTitle = uniqueTitle('Mobil');
		await createTaskViaUi(page, mobileTitle);

		const tasksTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await tasksTab.click();

		const searchInput = page.getByRole('textbox', { name: /suchen|filter|titel/i });
		const switchOpen = page.getByRole('radio', { name: 'Offen' });
		const switchDone = page.getByRole('radio', { name: 'Erledigt' });

		// Suchfeld und Switch sind nutzbar bei 375px.
		await expect(searchInput).toBeVisible();
		await expect(switchOpen).toBeVisible();
		await expect(switchDone).toBeVisible();

		// Kein horizontales Scrollen.
		const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375);

		// Auch Filtereingabe funktioniert mobil.
		await searchInput.fill('Mobil');
		await waitForStableView(page);

		const scrollWidthAfterFilter = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidthAfterFilter).toBeLessThanOrEqual(375);

		// Switch funktioniert mobil.
		await switchDone.click();
		await waitForStableView(page);

		const scrollWidthAfterSwitch = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidthAfterSwitch).toBeLessThanOrEqual(375);
	});
});
