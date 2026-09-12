import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests (#399): Aufgaben und erledigte Aufgaben zusammenführen — ein Aufgaben-Tab mit
 * Such-Filter nach Titel und Offen/Erledigt-Umschalter.
 *
 * UI-Kontrakt (Vorgabe): Der Umschalter ist eine `KolInputCheckbox` in der Variante „switch"
 * (Rolle `checkbox`, Label „Erledigte Aufgaben anzeigen"; ungeprüft = offener Baum, geprüft =
 * erledigte Tabelle). Das Suchfeld ist eine `KolInputText` vom Typ `search` (Rolle `searchbox`).
 * Der Filter wird NICHT live angewandt, sondern erst über den `KolButton` „Filtern" ODER die
 * Enter-Taste im Suchfeld ausgeführt (deferred filter).
 *
 * Wie `crud.spec.ts` laufen diese Specs gegen das **echte** Backend (In-Memory-DB, kein `page.route`).
 * Die Tests legen ihre Daten über die UI/echte API selbst an und räumen in `afterEach` wieder auf.
 */
test.describe('Priority Pilot — Aufgaben-Tab mit Filter und Switch (#399) gegen das echte Backend', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	// #582: Titel ≤65 Zeichen — Guard sichert das harter STRING(65)-Validator, Label bleibt voll
	// erhalten (nur bei >65 abgeschnitten), sodass Substring-Filter wie "Matching" weiterhin greifen.
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E ${label}`.slice(0, 65 - tail.length);
		return `${head}${tail}`;
	};

	// Der Offen/Erledigt-Umschalter (KolInputCheckbox variant="switch" → Rolle checkbox).
	const viewSwitch = (page: Page) => page.getByRole('checkbox', { name: /Erledigte Aufgaben/i });
	// Das Titel-Suchfeld (KolInputText type="search" → Rolle searchbox).
	const searchInput = (page: Page) => page.getByRole('searchbox', { name: /suchen|filter|titel/i });
	// Der „Filtern"-Button (KolButton), der den Filter-Entwurf anwendet.
	const filterButton = (page: Page) => page.getByRole('button', { name: 'Filtern' });

	/** Wendet den Filterbegriff über die Enter-Taste im Suchfeld an. */
	const applyFilterViaEnter = async (page: Page, term: string): Promise<void> => {
		await searchInput(page).fill(term);
		await searchInput(page).press('Enter');
		await waitForStableView(page);
	};

	/** Wendet den Filterbegriff über den „Filtern"-Button an. */
	const applyFilterViaButton = async (page: Page, term: string): Promise<void> => {
		await searchInput(page).fill(term);
		await filterButton(page).click();
		await waitForStableView(page);
	};

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

		await page.getByRole('searchbox', { name: 'Titel', exact: true }).fill(title);
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
		// Auf das PATCH warten, bevor der Seiten-Reload den Request abwürgen kann
		// (Muster dashboard-meter.spec.ts).
		const patchDone = page.waitForResponse(
			(response) => response.url().includes('/api/v1/tasks/') && response.request().method() === 'PATCH',
		);
		await doneButton.click();
		await patchDone;
		await waitForStableView(page);
		// Sticky-Zeile (#315) deterministisch auflösen — sonst träfe ein erneuter markTaskDoneViaUi
		// denselben (nun erledigten) Task und schaltete ihn zurück. Voller Seiten-Reload statt
		// Tab-Wechsel-Reload.
		await page.reload();
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

		// Im Aufgaben-Tab sind Suchfeld, „Filtern"-Button und Umschalter vorhanden.
		await tasksTab.click();

		await expect(searchInput(page)).toBeVisible();
		await expect(filterButton(page)).toBeVisible();
		await expect(viewSwitch(page)).toBeVisible();

		// Default (Umschalter ungeprüft) zeigt den Baum offener Aufgaben.
		await expect(viewSwitch(page)).not.toBeChecked();
		await expect(page.getByText(openTitle, { exact: true })).toBeVisible();
	});

	test('AK2: Umschalter wechselt zwischen offenem Baum und erledigter Tabelle', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// markTaskDoneViaUi erledigt den ZUERST angelegten Task (ältester/oberster im Baum → `.first()`).
		// Daher den zu erledigenden Task zuerst anlegen, den offen bleibenden danach.
		const doneTitle = uniqueTitle('Erledigt');
		const openTitle = uniqueTitle('Offen');

		await createTaskViaUi(page, doneTitle);
		await createTaskViaUi(page, openTitle);
		await markTaskDoneViaUi(page);

		// Frisch erledigte Aufgaben bleiben per #315 noch DONE_REMOVAL_DELAY_MS (5s) „sticky" im
		// offenen Baum (Sofort-Undo) und werden erst mit dem nächsten Reload aufgelöst. Deterministisch
		// den gesetzten Server-Stand herstellen, statt gegen das 5s-Fenster (== Assertion-Timeout) zu rennen.
		await page.reload();
		await waitForStableView(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		// Default: Umschalter ungeprüft (offen), offener Task sichtbar, erledigter nicht.
		await expect(viewSwitch(page)).not.toBeChecked();
		await expect(page.getByText(openTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneTitle, { exact: true })).not.toBeVisible();

		// Umschalten auf „Erledigt" → Tabelle erscheint.
		await viewSwitch(page).click();
		await waitForStableView(page);

		await expect(viewSwitch(page)).toBeChecked();
		await expect(page.getByText(doneTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(openTitle, { exact: true })).not.toBeVisible();

		// Zurück auf „Offen" → Baum erscheint wieder.
		await viewSwitch(page).click();
		await waitForStableView(page);

		await expect(viewSwitch(page)).not.toBeChecked();
		await expect(page.getByText(openTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneTitle, { exact: true })).not.toBeVisible();
	});

	test('AK3: Titel-Filter im offenen Baum (per Enter angewandt)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Titel bewusst disjunkt zum Filterbegriff: „Abweichung" enthält NICHT den Substring „Matching",
		// sonst behielte der case-insensitive Substring-Filter beide Tasks.
		const matchTitle = uniqueTitle('Matching');
		const nonMatchTitle = uniqueTitle('Abweichung');

		await createTaskViaUi(page, matchTitle);
		await createTaskViaUi(page, nonMatchTitle);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		// Ohne Filter: beide Tasks sichtbar.
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(nonMatchTitle, { exact: true })).toBeVisible();

		// Filter „Matching" via Enter → Matching bleibt sichtbar, Abweichung verschwindet.
		await applyFilterViaEnter(page, 'Matching');

		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(nonMatchTitle, { exact: true })).not.toBeVisible();

		// Filter leeren (Enter auf leerem Feld) → wieder beide sichtbar.
		await applyFilterViaEnter(page, '');

		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(nonMatchTitle, { exact: true })).toBeVisible();
	});

	test('AK4: Titel-Filter in der erledigten Tabelle (per „Filtern"-Button angewandt)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// „Abweichung" enthält NICHT den Filter-Substring „Matching" (sonst behielte der Filter beide).
		const doneMatchTitle = uniqueTitle('Done Matching');
		const doneNonMatchTitle = uniqueTitle('Done Abweichung');
		const openTitle = uniqueTitle('Open Task');

		await createTaskViaUi(page, doneMatchTitle);
		await createTaskViaUi(page, doneNonMatchTitle);
		await createTaskViaUi(page, openTitle);

		await markTaskDoneViaUi(page);
		await markTaskDoneViaUi(page);

		// Sticky-Zeilen (#315) deterministisch auflösen, damit die erledigten Tasks in der Tabelle liegen.
		await page.reload();
		await waitForStableView(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await viewSwitch(page).click();
		await waitForStableView(page);

		// Ohne Filter: beide erledigten Tasks sichtbar.
		await expect(page.getByText(doneMatchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneNonMatchTitle, { exact: true })).toBeVisible();

		// Filter „Matching" via „Filtern"-Button → nur Done Matching sichtbar.
		await applyFilterViaButton(page, 'Matching');

		await expect(page.getByText(doneMatchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneNonMatchTitle, { exact: true })).not.toBeVisible();

		// Filter leeren (leeres Feld + Button) → wieder beide sichtbar.
		await applyFilterViaButton(page, '');

		await expect(page.getByText(doneMatchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(doneNonMatchTitle, { exact: true })).toBeVisible();
	});

	test('AK5: Keine Treffer → klare Leerhinweis-Meldung', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Beide Tasks anlegen und einen erledigen, BEVOR gefiltert wird: Ein aktiver Filter ohne Treffer
		// blendet sonst den zu erledigenden Task im Baum aus, sodass markTaskDoneViaUi ihn nicht fände.
		const openTitle = uniqueTitle('Offen');
		const doneTitle = uniqueTitle('Erledigt');
		await createTaskViaUi(page, openTitle);
		await createTaskViaUi(page, doneTitle);
		await markTaskDoneViaUi(page);

		// Sticky-Zeile (#315) deterministisch auflösen, damit der erledigte Task in der Tabelle liegt.
		await page.reload();
		await waitForStableView(page);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		// Filter ohne Treffer im offenen Baum → Leerhinweis.
		await applyFilterViaEnter(page, 'NonExistentTask123');

		await expect(
			page.getByText('Keine Aufgaben gefunden. Passen Sie ggf. die Filter an.', { exact: true }),
		).toBeVisible();

		// Gleicher (weiterhin aktiver) Filter in der erledigten Tabelle → Leerhinweis.
		await viewSwitch(page).click();
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

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		// Suchtext im Suchfeld eingeben (Entwurf, noch nicht zwingend angewandt).
		await searchInput(page).fill('Test');
		await waitForStableView(page);

		expect(await searchInput(page).inputValue()).toBe('Test');

		// Auf „Erledigt" schalten → Suchtext bleibt erhalten.
		await viewSwitch(page).click();
		await waitForStableView(page);

		expect(await searchInput(page).inputValue()).toBe('Test');

		// Zurück auf „Offen" → Suchtext immer noch erhalten.
		await viewSwitch(page).click();
		await waitForStableView(page);

		expect(await searchInput(page).inputValue()).toBe('Test');
	});

	test('AK7: Mobile-First (375px) — kein horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		const mobileTitle = uniqueTitle('Mobil');
		await createTaskViaUi(page, mobileTitle);

		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();

		// Suchfeld, „Filtern"-Button und Umschalter sind nutzbar bei 375px.
		await expect(searchInput(page)).toBeVisible();
		await expect(filterButton(page)).toBeVisible();
		await expect(viewSwitch(page)).toBeVisible();

		// Kein horizontales Scrollen.
		const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375);

		// Auch Filtereingabe (per Enter) funktioniert mobil ohne Überlauf.
		await applyFilterViaEnter(page, 'Mobil');

		const scrollWidthAfterFilter = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidthAfterFilter).toBeLessThanOrEqual(375);

		// Umschalter funktioniert mobil.
		await viewSwitch(page).click();
		await waitForStableView(page);

		const scrollWidthAfterSwitch = await page.evaluate(() => document.body.scrollWidth);
		expect(scrollWidthAfterSwitch).toBeLessThanOrEqual(375);
	});

	/**
	 * Layout der Filterzeile. Geprüft wird an den echten Kästen, nicht an Klassen: Nur die Geometrie
	 * belegt, dass die drei Bedienelemente auf dem Desktop wirklich nebeneinander liegen (die Leiste
	 * war vorher auf jedem Viewport gestapelt, weil die Suchzeile `flex: 1 1 100%` trug).
	 *
	 * Der Kategorie-Filter erscheint nur, wenn Kategorien angelegt sind — die Spec legt sich deshalb
	 * eine eigene an und räumt sie hinterher wieder ab (Muster `categories.spec.ts`).
	 */
	test.describe('Filterzeile: Suchfeld 50 %, Kategorie 30 %, „Filtern" der Rest', () => {
		const categoryName = 'E2E-Filterzeile';
		const categoryFilter = (page: Page) => page.locator('.task-filter-category');

		test.beforeEach(async ({ page }) => {
			const response = await page.request.post('/api/v1/categories', {
				data: { name: categoryName, color: '#b42318' },
			});
			expect(response.ok(), `Kategorie ${categoryName} konnte nicht angelegt werden`).toBeTruthy();
		});

		test.afterEach(async ({ page }) => {
			const categories = (await (await page.request.get('/api/v1/categories')).json()) as {
				id: number;
				name: string;
			}[];
			for (const category of categories.filter((entry) => entry.name === categoryName)) {
				await page.request.delete(`/api/v1/categories/${category.id}`);
			}
		});

		/** Öffnet den Aufgaben-Tab im gewünschten Viewport und liefert die drei Kästen der Filterzeile. */
		const filterRowBoxes = async (page: Page, width: number, height: number) => {
			await page.setViewportSize({ width, height });
			await page.goto('/');
			await waitForStableView(page);
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await waitForStableView(page);

			const [search, category, submit] = await Promise.all([
				searchInput(page).boundingBox(),
				categoryFilter(page).boundingBox(),
				filterButton(page).boundingBox(),
			]);
			expect(search, 'Suchfeld nicht sichtbar').not.toBeNull();
			expect(category, 'Kategorie-Filter nicht sichtbar').not.toBeNull();
			expect(submit, '„Filtern"-Knopf nicht sichtbar').not.toBeNull();
			return { search: search!, category: category!, submit: submit! };
		};

		test('Desktop (1280px): eine Zeile im Verhältnis 50 / 30 / 20', async ({ page }) => {
			const { search, category, submit } = await filterRowBoxes(page, 1280, 900);

			// Eine Zeile: Jedes Paar überlappt vertikal. Wären die Elemente gestapelt, läge der obere
			// Rand des jeweils nächsten unterhalb der Unterkante des vorigen.
			for (const [name, box] of [
				['Kategorie', category],
				['Filtern', submit],
			] as const) {
				expect(box.y, `${name} liegt nicht auf der Zeile des Suchfelds`).toBeLessThan(search.y + search.height);
				expect(search.y, `${name} liegt nicht auf der Zeile des Suchfelds`).toBeLessThan(box.y + box.height);
			}

			// Und die zugesagten Anteile. Die Zeilenbreite ist die Summe der drei Kästen plus zwei Gaps;
			// gemessen wird gegen die Summe der Kästen, damit der Gap-Wert hier nicht mitgepflegt werden
			// muss. Toleranz ±3 Prozentpunkte deckt Rundung und Rahmen ab.
			const total = search.width + category.width + submit.width;
			expect(Math.round((search.width / total) * 100)).toBeGreaterThanOrEqual(47);
			expect(Math.round((search.width / total) * 100)).toBeLessThanOrEqual(53);
			expect(Math.round((category.width / total) * 100)).toBeGreaterThanOrEqual(27);
			expect(Math.round((category.width / total) * 100)).toBeLessThanOrEqual(33);
			expect(Math.round((submit.width / total) * 100)).toBeGreaterThanOrEqual(17);
			expect(Math.round((submit.width / total) * 100)).toBeLessThanOrEqual(23);
		});

		test('Mobil (375px): gestapelt statt nebeneinander', async ({ page }) => {
			const { search, category, submit } = await filterRowBoxes(page, 375, 812);

			// Jedes Element beginnt unterhalb des vorigen — das Gegenteil der Desktop-Zusage.
			expect(category.y).toBeGreaterThanOrEqual(search.y + search.height);
			expect(submit.y).toBeGreaterThanOrEqual(category.y + category.height);

			const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
			expect(scrollWidth).toBeLessThanOrEqual(375);
		});
	});
});
