import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Specs für die globale Suche (#8009e9bf-9e02-491c-8c73-6b4bac74f087, PR #1048):
 * Toolbar-Button „Suche" öffnet ein Modal mit Suchfeld (inkl. VoiceField-Mic), die Suche
 * wechselt auf den Aufgaben-Tab, filtert die Liste und schreibt den Begriff in das
 * Filterfeld des Aufgaben-Tabs, damit der aktive Filter sichtbar bleibt (Review F4).
 *
 * Wie `tasks-tab-filter.spec.ts` laufen diese Specs gegen das **echte** Backend
 * (In-Memory-DB, kein `page.route`); angelegte Tasks werden in `afterEach` aufgeräumt.
 */
test.describe('Priority Pilot — globale Suche über den Toolbar-Button', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	const searchButton = (page: Page) => page.getByRole('button', { name: 'Suche', exact: true });
	const modalSearchInput = (page: Page) => page.getByRole('searchbox', { name: /Suchbegriff eingeben/i });
	const tabFilterInput = (page: Page) => page.getByRole('searchbox', { name: /suchen|filter|titel/i });

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

	/** Legt über die Quick-Erfassung einen Task mit dem gegebenen Titel an. */
	const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);

		await page.getByRole('textbox', { name: 'Titel', exact: true }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
	};

	test('Suche öffnen → Begriff eingeben → Aufgaben-Tab zeigt gefilterte Liste', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const matchTitle = uniqueTitle('Match');
		const otherTitle = uniqueTitle('Anders');
		await createTaskViaUi(page, matchTitle);
		await createTaskViaUi(page, otherTitle);

		// Toolbar-Button öffnet das Such-Modal mit fokussiertem Suchfeld.
		await searchButton(page).click();
		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeVisible();
		await expect(modalSearchInput(page)).toBeVisible();
		await expect(modalSearchInput(page)).toBeFocused();

		// Begriff eingeben und Suche starten.
		await modalSearchInput(page).fill('Match');
		await page.getByRole('button', { name: 'Suche starten' }).click();

		// Modal schließt, Aufgaben-Tab ist aktiv, Liste ist gefiltert.
		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(page.getByRole('tab', { name: 'Aufgaben', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(otherTitle, { exact: true })).not.toBeVisible();

		// Der aktive Filter bleibt im Filterfeld des Aufgaben-Tabs sichtbar (Review F4).
		await expect(tabFilterInput(page)).toHaveValue('Match');
	});

	test('Suche per Enter-Taste im Suchfeld auslösen', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const matchTitle = uniqueTitle('Enter');
		await createTaskViaUi(page, matchTitle);

		await searchButton(page).click();
		await modalSearchInput(page).fill(matchTitle);
		await modalSearchInput(page).press('Enter');

		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
	});

	test('375px: Such-Modal und Toolbar-Button bleiben nutzbar, kein Layoutbruch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const matchTitle = uniqueTitle('Mobil');
		await createTaskViaUi(page, matchTitle);

		await searchButton(page).click();
		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeVisible();

		// Suchfeld ragt nicht über den Viewport hinaus (kein horizontaler Overflow).
		const inputBox = await modalSearchInput(page).boundingBox();
		expect(inputBox, 'Suchfeld muss eine Bounding-Box haben').not.toBeNull();
		expect(inputBox!.x + inputBox!.width, 'Suchfeld muss innerhalb des 375px-Viewports bleiben').toBeLessThanOrEqual(
			375,
		);

		await modalSearchInput(page).fill('Mobil');
		await page.getByRole('button', { name: 'Suche starten' }).click();
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
	});

	// #1067 — Nach dem Schließen des Suchdialogs liegt der Fokus im Filterfeld des Aufgaben-Tabs
	// (docs/spec/issue-1067.md, AK1–AK4), damit direkt weitergetippt werden kann.
	test('AK1: Suche per „Suche starten" → Fokus liegt im Filterfeld des Aufgaben-Tabs', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const matchTitle = uniqueTitle('Fokus');
		const otherTitle = uniqueTitle('Nebenan');
		await createTaskViaUi(page, matchTitle);
		await createTaskViaUi(page, otherTitle);

		await searchButton(page).click();
		await modalSearchInput(page).fill(matchTitle);
		await page.getByRole('button', { name: 'Suche starten' }).click();

		// Modal zu, Aufgaben-Tab aktiv, Liste gefiltert — und der Fokus im Filterfeld.
		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(page.getByRole('tab', { name: 'Aufgaben', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(otherTitle, { exact: true })).not.toBeVisible();
		await expect(
			tabFilterInput(page),
			'Nach der Suche muss der Fokus programmatisch im Filterfeld liegen',
		).toBeFocused();
	});

	test('AK1/AK2: Suche per Enter → Fokus im Filterfeld, Weitertippen verengt den Filter', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const alphaTitle = uniqueTitle('Alpha');
		const betaTitle = uniqueTitle('Beta');
		await createTaskViaUi(page, alphaTitle);
		await createTaskViaUi(page, betaTitle);

		await searchButton(page).click();
		// „E2E" matcht beide Tasks; der Rest wird nach dem Tab-Wechsel getippt.
		await modalSearchInput(page).fill('E2E');
		await modalSearchInput(page).press('Enter');

		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(page.getByText(alphaTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(betaTitle, { exact: true })).toBeVisible();
		await expect(tabFilterInput(page)).toBeFocused();

		// Weitertippen OHNE Klick: Zeichen landen im Filterfeld (AK2)…
		await page.keyboard.type(' Alpha');
		await expect(tabFilterInput(page)).toHaveValue('E2E Alpha');

		// …und der ergänzte Begriff verengt die Liste (deferred Filter per Enter, App.tsx:552-558).
		await page.keyboard.press('Enter');
		await expect(page.getByText(alphaTitle, { exact: true })).toBeVisible();
		await expect(page.getByText(betaTitle, { exact: true })).not.toBeVisible();
	});

	test('AK3: 375px — nach der Suche liegt der Fokus im Filterfeld', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		const matchTitle = uniqueTitle('MobilFokus');
		await createTaskViaUi(page, matchTitle);

		await searchButton(page).click();
		await modalSearchInput(page).fill(matchTitle);
		await page.getByRole('button', { name: 'Suche starten' }).click();

		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(page.getByText(matchTitle, { exact: true })).toBeVisible();
		await expect(tabFilterInput(page), 'Auch mobil muss der Fokus im Filterfeld landen').toBeFocused();
	});

	test('AK4: Schließen OHNE Suche (Escape, „Abbrechen") — Fokus bleibt beim Auslöser', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Escape: Fokus kehrt zum Toolbar-Button zurück, nicht ins Filterfeld.
		await searchButton(page).click();
		await expect(modalSearchInput(page)).toBeFocused();
		await modalSearchInput(page).press('Escape');
		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(searchButton(page), 'Fokus muss beim Auslöser bleiben').toBeFocused();

		// „Abbrechen": gleiches Verhalten.
		await searchButton(page).click();
		await expect(modalSearchInput(page)).toBeFocused();
		await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Suche', exact: true })).toBeHidden();
		await expect(searchButton(page)).toBeFocused();

		// Der Fokus darf zu keinem Zeitpunkt automatisch im Filterfeld gelandet sein.
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		await expect(tabFilterInput(page)).toBeVisible();
		await expect(tabFilterInput(page)).not.toBeFocused();
	});
});
