import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * E2E-Spec für die Kategorien (thematische Ordnungsebene neben den Säulen): anlegen, einer Aufgabe
 * zuordnen, Kennzeichen in der Liste sehen und danach filtern. Läuft gegen das echte Backend
 * (kein API-Mock); `/auth/me` liefert die Fixture.
 *
 * Der Durchlauf liegt bei **375×812** (Mobile-First-Pflicht, `.ai-knowledge/project.md`): Was hier
 * ohne horizontalen Überlauf bedienbar ist, ist es auf breiteren Viewports erst recht.
 *
 * **Aufbau-Regel:** Stammdaten und Nebendarsteller entstehen über die API (`page.request`), nur der
 * jeweils geprüfte Schritt läuft durch die UI. Die e2e-Suite teilt sich EINE In-Memory-DB über alle
 * Specs eines Shards; ein Test, der alles durchklickt, läuft mit wachsendem Bestand ins 30s-Budget
 * (belegt in CI-Lauf 34425244123: `/forest` und `/suggestions` verzögern den App-Load, das
 * Kategorie-Feld erschien nicht rechtzeitig). Das `beforeEach` räumt zusätzlich Alt-Bestände ab,
 * damit die Listen-Assertions deterministisch bleiben (Muster `issue-1258-tasks-mobile.spec.ts`).
 */
test.describe('Kategorien — anlegen, zuordnen, filtern (375px)', () => {
	let runId = 0;
	const uniqueName = (label: string): string => `E2E-Kat-${label}-${(runId += 1)}`;

	/** Legt eine Kategorie über die echte API an und liefert ihre ID. */
	const createCategoryViaApi = async (page: Page, name: string, color = '#b42318'): Promise<number> => {
		const response = await page.request.post('/api/v1/categories', { data: { name, color } });
		expect(response.ok(), `Kategorie ${name} konnte nicht angelegt werden`).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	/** Legt eine Aufgabe über die echte API an (optional mit Kategorie). */
	const createTaskViaApi = async (page: Page, title: string, categoryId?: number): Promise<void> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: { title, priority: 3, ...(categoryId === undefined ? {} : { categoryId }) },
		});
		expect(response.ok(), `Aufgabe ${title} konnte nicht angelegt werden`).toBeTruthy();
	};

	/**
	 * Räumt vor und nach jedem Test auf. Aufgaben werden vollständig gelöscht — die Listen-Assertions
	 * brauchen einen bekannten Stand, und ein voller Bestand aus den übrigen Specs des Shards bremst
	 * den App-Load über das Test-Budget hinaus (Muster `issue-1258-tasks-mobile.spec.ts`). Kategorien
	 * werden auf das eigene `E2E-Kat-`-Präfix eingegrenzt: fremde Stammdaten gehen diese Spec nichts an.
	 */
	const resetData = async (page: Page): Promise<void> => {
		for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const categories = (await (await page.request.get('/api/v1/categories')).json()) as {
			id: number;
			name: string;
		}[];
		for (const category of categories.filter((entry) => entry.name.startsWith('E2E-Kat-'))) {
			await page.request.delete(`/api/v1/categories/${category.id}`);
		}
	};

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await resetData(page);
	});

	test.afterEach(async ({ page }) => {
		await resetData(page);
	});

	test('AK1: Kategorie in den Einstellungen anlegen — erscheint sofort in der Liste', async ({ page }) => {
		const name = uniqueName('Hausbau');

		await page.goto('/settings/kategorien');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('button', { name: 'Neue Kategorie anlegen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Neue Kategorie anlegen' })).toBeVisible();
		// Hydration des Dialogs abwarten: Ein `fill()` vor dem KoliBri-Upgrade landet im nativen
		// Input, nicht im Komponenten-State — der Dialog speicherte dann einen leeren Namen.
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
		await dialog.getByRole('button', { name: 'Anlegen', exact: true }).click();

		// Bewusst auf die LISTE geprüft, nicht auf beliebigen Text: Der Anlege-Dialog zeigt den Namen
		// auch in seiner Vorschau — ein `getByText(name)` wäre schon grün, wenn das Speichern scheitert
		// und der Dialog offen stehen bleibt.
		await expect(page.locator('li[data-category-id]').filter({ hasText: name })).toBeVisible();

		// Gegenprobe am Backend: Die Kategorie ist wirklich gespeichert, nicht nur gerendert.
		const stored = (await (await page.request.get('/api/v1/categories')).json()) as { name: string }[];
		expect(stored.map((entry) => entry.name)).toContain(name);
	});

	test('AK2: Kategorie zuordnen — Kennzeichen unter dem Feld, abwählbar, landet am Task', async ({ page }) => {
		const name = uniqueName('Steuer');
		const title = `E2E-Kat-Erklaerung-${runId}`;
		const categoryId = await createCategoryViaApi(page, name);

		await page.goto('/aufgaben');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		// Beide Schritte des Anlege-Dialogs erst nach dem KoliBri-Upgrade bedienen — sonst laufen
		// `fill()`/`click()` gegen noch nicht hydrierte Web-Components und der Wert fällt still weg.
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		const titleField = page.getByRole('textbox', { name: 'Titel', exact: true });
		await titleField.fill(title);
		await expect(titleField).toHaveValue(title);
		// Die Kategorie steht — wie die Säulen — in der Sektion „Optional" (#1285: zugeklappt beim
		// Öffnen des Formulars). KoliBris SingleSelect ist eine Combobox: öffnen, dann die Option
		// klicken (Muster series-rhythm.spec.ts) — `selectOption` greift nur an nativen `<select>`.
		await openAccordionSection(page, 'Optional');
		const categoryField = page.getByLabel('Kategorie (optional)');
		await categoryField.click();
		await page.getByRole('option', { name }).click();
		// Übernahme belegen, bevor gespeichert wird: Ein Klick, den die Combobox verwirft, liefe sonst
		// stumm in einen Task ohne Kategorie.
		await expect(categoryField).toHaveValue(name);

		// Die Wahl steht als Kennzeichen UNTER dem Feld — so, wie sie später in der Liste aussieht.
		// „Darunter" wird an den echten Kästen geprüft, nicht an der DOM-Reihenfolge: Nur die Geometrie
		// belegt, dass das Kennzeichen nicht doch neben dem Feld sitzt (der Zustand vor #1325-Nachtrag).
		const selection = page.locator('.category-field__selection');
		await expect(selection.locator('kol-badge')).toHaveText(name);
		const fieldBox = await page.locator('.category-field kol-single-select').boundingBox();
		const badgeBox = await selection.locator('kol-badge').boundingBox();
		expect(badgeBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height - 1);

		// … und das „×" steht INLINE daneben, nicht als dritte Zeile darunter: Die beiden Kästen
		// überlappen vertikal. Der Knopf trägt keinen sichtbaren Text (Muster `.checklist-item`), ist
		// aber über seinen zugänglichen Namen bedienbar — genau das prüft der Klick unten (#368).
		const removeButton = page.getByRole('button', { name: 'Kategorie entfernen' });
		const removeBox = await removeButton.boundingBox();
		expect(removeBox!.y).toBeLessThan(badgeBox!.y + badgeBox!.height);
		expect(badgeBox!.y).toBeLessThan(removeBox!.y + removeBox!.height);

		// Abwählen und wieder wählen: Die Zuordnung ist keine Einbahnstraße.
		await removeButton.click();
		await expect(selection).toHaveCount(0);
		await expect(categoryField).not.toHaveValue(name);
		await categoryField.click();
		await page.getByRole('option', { name }).click();
		await expect(selection.locator('kol-badge')).toHaveText(name);

		// Auf die Anlege-Antwort warten und sie auswerten: Ein stiller 4xx würde sonst als „Dialog zu,
		// alles gut" durchgehen — die Aufgabe fehlte, ohne dass der Test es merkt.
		const created = page.waitForResponse(
			(response) => response.url().includes('/api/v1/tasks') && response.request().method() === 'POST',
		);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		const response = await created;
		expect(response.status(), await response.text()).toBe(201);
		expect(((await response.json()) as { categoryId: number | null }).categoryId).toBe(categoryId);
	});

	test('AK3: Kennzeichen in der Liste und Filter über `?cat=`', async ({ page }) => {
		const name = uniqueName('Verein');
		const categoryId = await createCategoryViaApi(page, name);
		const matching = `E2E-Kat-Mitglieder-${runId}`;
		const other = `E2E-Kat-Ohne-${runId}`;
		await createTaskViaApi(page, matching, categoryId);
		await createTaskViaApi(page, other);

		await page.goto('/aufgaben');
		await waitForStableView(page);

		const matchingRow = page.locator('.task-list-item').filter({ hasText: matching });
		await expect(matchingRow.getByText(name, { exact: true })).toBeVisible();
		await expect(page.locator('.task-list-item').filter({ hasText: other }).getByText(name)).toHaveCount(0);

		await page.goto(`/aufgaben?cat=${categoryId}`);
		await waitForStableView(page);

		await expect(page.locator('.task-list-item').filter({ hasText: matching })).toBeVisible();
		await expect(page.locator('.task-list-item').filter({ hasText: other })).toHaveCount(0);

		// Mobile-First: Der Kerninhalt bleibt in 375px lesbar, ohne horizontal zu überlaufen.
		const listRight = await page.locator('.task-list').evaluate((el) => el.getBoundingClientRect().right);
		expect(listRight).toBeLessThanOrEqual(375 + 1);
	});

	test('AK4: Kategorie löschen lässt die Aufgabe bestehen und nimmt ihr nur das Kennzeichen', async ({ page }) => {
		const name = uniqueName('Umbau');
		const categoryId = await createCategoryViaApi(page, name);
		const title = `E2E-Kat-Fliesen-${runId}`;
		await createTaskViaApi(page, title, categoryId);

		await page.goto('/settings/kategorien');
		await waitForStableView(page, 'Priority Pilot');
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await page.locator('kol-dialog').getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByText(name, { exact: true })).toBeHidden();

		await page.goto('/aufgaben');
		await waitForStableView(page);
		const row = page.locator('.task-list-item').filter({ hasText: title });
		await expect(row).toBeVisible();
		await expect(row.getByText(name, { exact: true })).toHaveCount(0);
	});
});
