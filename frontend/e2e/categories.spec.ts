import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * E2E-Spec für die Kategorien (thematische Ordnungsebene neben den Säulen): anlegen, einer Aufgabe
 * zuordnen, Kennzeichen in der Liste sehen und danach filtern. Läuft gegen das echte Backend
 * (kein API-Mock); `/auth/me` liefert die Fixture.
 *
 * Der ganze Durchlauf läuft bei **375×812** (Mobile-First-Pflicht, `.ai-knowledge/project.md`):
 * Wenn die Kette hier ohne horizontalen Überlauf funktioniert, funktioniert sie auf jedem
 * breiteren Viewport erst recht.
 */
test.describe('Kategorien — anlegen, zuordnen, filtern (375px)', () => {
	let runId = 0;
	const uniqueName = (label: string): string => `E2E-Kat-${label}-${(runId += 1)}`;

	/** Räumt die per Test angelegten Kategorien und Aufgaben über die echte API ab. */
	const cleanup = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number; title: string }[];
		for (const task of tasks.filter((entry) => entry.title.startsWith('E2E-Kat-'))) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const categories = (await (await page.request.get('/api/v1/categories')).json()) as { id: number; name: string }[];
		for (const category of categories.filter((entry) => entry.name.startsWith('E2E-Kat-'))) {
			await page.request.delete(`/api/v1/categories/${category.id}`);
		}
	};

	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
	});

	test.afterEach(async ({ page }) => {
		await cleanup(page);
	});

	/** Legt eine Kategorie über die Einstellungen an und wartet, bis ihr Badge in der Liste steht. */
	const createCategoryViaUi = async (page: Page, name: string): Promise<void> => {
		await page.goto('/settings/kategorien');
		await waitForStableView(page, 'Priority Pilot');

		await page.getByRole('button', { name: 'Neue Kategorie anlegen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Neue Kategorie anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const dialog = page.locator('kol-dialog');
		await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
		await dialog.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByText(name, { exact: true })).toBeVisible();
	};

	/** Legt eine Aufgabe mit der genannten Kategorie über das reguläre Formular an. */
	const createTaskWithCategory = async (page: Page, title: string, category: string): Promise<void> => {
		await page.goto('/aufgaben');
		await waitForStableView(page);

		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel', exact: true }).fill(title);
		// Die Kategorie steht — wie die Säulen — in der Sektion „Optional" (#1285: zugeklappt beim
		// Öffnen des Formulars).
		await openAccordionSection(page, 'Optional');
		// KoliBris SingleSelect ist eine Combobox: öffnen, dann die Option klicken (Muster
		// series-rhythm.spec.ts) — `selectOption` greift nur an nativen `<select>`-Elementen.
		await page.getByLabel('Kategorie (optional)').click();
		await page.getByRole('option', { name: category }).click();
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	test('Kategorie anlegen, zuordnen, als Kennzeichen sehen und danach filtern', async ({ page }) => {
		const category = uniqueName('Hausbau');
		const matching = `E2E-Kat-Fliesen-${runId}`;
		const other = `E2E-Kat-Ohne-${runId}`;

		await createCategoryViaUi(page, category);
		await createTaskWithCategory(page, matching, category);

		// Zweite Aufgabe ohne Kategorie — sie muss der Filter später ausblenden.
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByRole('textbox', { name: 'Titel', exact: true }).fill(other);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		// Kennzeichen in der Aufgabenliste.
		await page.goto('/aufgaben');
		await waitForStableView(page);
		const matchingRow = page.locator('.task-list-item').filter({ hasText: matching });
		await expect(matchingRow.getByText(category, { exact: true })).toBeVisible();

		// Filter über die URL (derselbe Zustand, den die Suche setzt): nur die passende Aufgabe bleibt.
		const categoryId = await page.evaluate(async (name: string) => {
			const response = await fetch('/api/v1/categories');
			const list = (await response.json()) as { id: number; name: string }[];
			return list.find((entry) => entry.name === name)?.id ?? 0;
		}, category);
		await page.goto(`/aufgaben?cat=${categoryId}`);
		await waitForStableView(page);

		await expect(page.locator('.task-list-item').filter({ hasText: matching })).toBeVisible();
		await expect(page.locator('.task-list-item').filter({ hasText: other })).toHaveCount(0);

		// Mobile-First: Der Kerninhalt bleibt in 375px lesbar, ohne horizontal zu überlaufen.
		const listRight = await page.locator('.task-list').evaluate((el) => el.getBoundingClientRect().right);
		expect(listRight).toBeLessThanOrEqual(375 + 1);
	});

	test('Kategorie löschen lässt die Aufgabe bestehen und nimmt ihr nur das Kennzeichen', async ({ page }) => {
		const category = uniqueName('Steuer');
		const title = `E2E-Kat-Erklaerung-${runId}`;

		await createCategoryViaUi(page, category);
		await createTaskWithCategory(page, title, category);

		await page.goto('/settings/kategorien');
		await waitForStableView(page, 'Priority Pilot');
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await page.locator('kol-dialog').getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByText(category, { exact: true })).toBeHidden();

		await page.goto('/aufgaben');
		await waitForStableView(page);
		const row = page.locator('.task-list-item').filter({ hasText: title });
		await expect(row).toBeVisible();
		await expect(row.getByText(category, { exact: true })).toHaveCount(0);
	});
});
