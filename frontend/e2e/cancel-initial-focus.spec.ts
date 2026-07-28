import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #472 — „Initialer Fokus auf ‚Abbrechen‘ beim Löschen-Dialog“.
 *
 * Sicherheits-Konvention: In Bestätigungs-Dialogen für destruktive Aktionen (Löschen) soll der
 * Initialfokus nach dem Öffnen auf dem „Abbrechen“-Button (secondary) liegen — nicht auf der
 * primären „Endgültig löschen“-Aktion (danger). So ist die irreversible Aktion nicht per Enter
 * auslösbar, bevor der Nutzer bewusst den Fokus verlagert.
 *
 * Die Tests sind **rot**, solange die Umsetzung fehlt:
 *  - AK1/AK2: In den Task-/Säulen-Lösch-Dialogen wird „Endgültig löschen“ vor „Abbrechen“ gerendert,
 *    sodass der Browser den destruktiven Button fokussiert. Der Test erwartet „Abbrechen“ fokussiert.
 *  - AK3: Die Serien-Löschung erfolgt aktuell **ohne** Bestätigungsdialog (Sofort-Löschung) — der
 *    Test erwartet einen Bestätigungsdialog mit fokussiertem „Abbrechen“-Button.
 *  - AK4: Mobile-First — der Dialog darf bei 375px kein horizontales Scrollen auslösen.
 *  - AK5: Regression — die bestehende Fokus-Rückgabe beim Schließen (#182) bleibt unberührt.
 *
 * Sie werden grün, sobald `Modal.tsx` einen Initialfokus-Mechanismus erhält und die Dialog-Komponenten
 * diesen für den „Abbrechen“-Button aktivieren (sowie für Serien ein Bestätigungsdialog ergänzt wird).
 */
test.describe('#472 — Initialer Fokus auf „Abbrechen“ beim Löschen-Dialog', () => {
	// Eindeutige Namen je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen
	// und parallele/aufeinanderfolgende Läufe sich nicht stören.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E-${label}-#${(runId += 1)}-${Date.now()}`;

	/** Löscht alle Tasks über die echte API. */
	const deleteAllTasks = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	/** Löscht alle Serien über die echte API. */
	const deleteAllSeries = async (page: Page): Promise<void> => {
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	// AK2 legt eine eigene Säule an und löscht sie im Test selbst (über den Lösch-Dialog).
	// Säulen-Stammdaten (DB_SEED=false hält sie) dürfen hier NICHT mitgelöscht werden — sonst
	// fehlen sie den nachfolgenden Tests, die sich auf die geseedeten Säulen verlassen
	// (z. B. crud.spec.ts „Säulen-Gewicht ändern" → input[type=range], dashboard-meter.spec.ts
	// „Optimal|Suboptimal"-Statustext). Die alphabetische Sortierung von Playwright läuft
	// cancel-initial-focus.spec.ts VOR crud/dashboard-meter im selben Shard.
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		await deleteAllSeries(page);
	});

	/** Wechselt auf den „Aufgaben“-Tab. */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Legt über die UI einen Task an (Default-Felder genügen der Validierung) und wartet, bis der
	 * Anlegen-Dialog geschlossen ist.
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

	/**
	 * AK1 — Task-Löschen: Der „Abbrechen“-Button hat nach dem Öffnen des Löschen-Dialogs den
	 * Initialfokus (nicht „Endgültig löschen“).
	 *
	 * Given: Ein Task existiert und der „Task löschen“-Dialog wird geöffnet.
	 * When: Der Dialog sichtbar wird (showModal() abgeschlossen).
	 * Then: Der „Abbrechen“-Button ist fokussiert (nicht „Endgültig löschen“).
	 */
	test('AK1 — Task-Löschdialog: Initialfokus liegt auf „Abbrechen“', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Task-Fokus');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		// Löschen-Dialog öffnen
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		// Kern-Assertion: „Abbrechen“ muss fokussiert sein, nicht „Endgültig löschen“.
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(cancelButton).toBeFocused();
		await expect(deleteButton).not.toBeFocused();
	});

	/**
	 * AK2 — Säulen-Löschen: Der „Abbrechen“-Button hat nach dem Öffnen des Säulen-Lösch-Dialogs den
	 * Initialfokus.
	 *
	 * Given: Eine Säule existiert und der „Säule löschen“-Dialog wird geöffnet.
	 * When: Der Dialog sichtbar wird.
	 * Then: Der „Abbrechen“-Button ist fokussiert.
	 */
	test('AK2 — Säulen-Löschdialog: Initialfokus liegt auf „Abbrechen“', async ({ page }) => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const name = uniqueTitle('Säule-Fokus');
		// Säule anlegen
		await page.getByRole('button', { name: 'Neue Säule anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neue Säule anlegen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');
		await page.locator('kol-dialog').getByRole('textbox', { name: 'Name' }).fill(name);
		await page.locator('kol-dialog').getByRole('button', { name: 'Anlegen' }).click();
		await expect(page.getByText(name, { exact: true })).toBeVisible();

		// Löschen-Dialog öffnen
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Säule löschen' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		// Kern-Assertion: „Abbrechen“ muss fokussiert sein, nicht „Endgültig löschen“.
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(cancelButton).toBeFocused();
		await expect(deleteButton).not.toBeFocused();
	});

	/**
	 * AK3 — Serien-Löschen: Beim Klick auf „Löschen“ in der Serien-Verwaltung erscheint ein
	 * Bestätigungsdialog (keine Sofort-Löschung mehr), und der „Abbrechen“-Button hat den
	 * Initialfokus.
	 *
	 * Given: Eine Serie existiert; der Nutzer klickt „Löschen“ in der Serien-Verwaltung.
	 * When: Der Bestätigungsdialog geöffnet wird.
	 * Then: Es erscheint ein Bestätigungsdialog (keine Sofort-Löschung) UND der „Abbrechen“-Button
	 *       hat den Initialfokus.
	 */
	test('AK3 — Serien-Löschen: Bestätigungsdialog mit „Abbrechen“-Initialfokus', async ({ page }) => {
		// Serie direkt über die echte API anlegen (Setup).
		const title = uniqueTitle('Serie-Fokus');
		const createResponse = await page.request.post('/api/v1/series', {
			data: {
				title,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-09-07T00:00:00.000Z',
			},
		});
		expect(createResponse.ok()).toBeTruthy();

		await page.goto('/');
		await waitForStableView(page);

		// Serien-Tab öffnen
		await page.getByRole('tab', { name: 'Serien', exact: true }).click();
		await expect(page.getByTestId('series-tree')).toBeVisible();
		await waitForStableView(page);
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

		// Vorbedingung: Serie existiert noch (keine Sofort-Löschung beim bloßen Laden).
		const beforeSeries = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(beforeSeries.some((s) => s.title === title)).toBeTruthy();

		// Klick auf „Löschen“ — darf NICHT sofort löschen, sondern muss einen Bestätigungsdialog öffnen.
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await waitForStableView(page);

		// Kern-Assertion A: Es erscheint ein Bestätigungsdialog mit „Endgültig löschen“ UND „Abbrechen“.
		// Aktuell löscht der Klick sofort → beide Buttons fehlen → Test rot.
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const confirmButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(confirmButton).toBeVisible();
		await expect(cancelButton).toBeVisible();

		// Kern-Assertion B: Die Serie wurde durch den bloßen Klick noch NICHT gelöscht (Dialog statt
		// Sofort-Löschung). Aktuell ist sie sofort weg → Test rot.
		const afterClickSeries = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(afterClickSeries.some((s) => s.title === title)).toBeTruthy();

		// Kern-Assertion C: Der „Abbrechen“-Button hat den Initialfokus.
		await expect(cancelButton).toBeFocused();
	});

	/**
	 * AK4 — Mobile-First (375px): Der geöffnete Task-Lösch-Dialog löst kein horizontales Scrollen
	 * aus; beide Buttons bleiben erreichbar.
	 *
	 * Given: Lösch-Dialog geöffnet bei 375px-Viewport.
	 * Then: Dialog bleibt innerhalb des Viewports (kein horizontales Scrollen), beide Buttons
	 *       sind erreichbar.
	 */
	test('AK4 — Mobile-First 375px: Lösch-Dialog ohne horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Task-Mobile');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		// Löschen-Dialog öffnen
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		// Beide Buttons sind im Viewport erreichbar.
		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(cancelButton).toBeVisible();
		await expect(deleteButton).toBeVisible();

		// Kein horizontales Scrollen (Muster wie login.spec.ts AK5 / pillar-crud.spec.ts AK4).
		const hasNoHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		);
		expect(hasNoHorizontalOverflow).toBe(true);
	});

	/**
	 * AK5 — Regression: Die Fokus-Rückgabe beim Schließen (#182) bleibt nach der neuen
	 * Initialfokus-Logik intakt. Schließt man den Dialog per „Abbrechen“, kehrt der Fokus zum
	 * auslösenden Element zurück.
	 *
	 * Given: Dialog per „Abbrechen“ geschlossen.
	 * Then: Der Fokus kehrt zum auslösenden Element zurück (bestehendes Verhalten aus
	 *       Modal.tsx / Issue #182 bleibt unberührt).
	 */
	test('AK5 (Regression) — Fokus-Rückgabe beim Abbrechen bleibt intakt', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Regression');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		const moreButton = page.getByRole('button', { name: 'Weitere Aktionen' }).first();
		await moreButton.click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		// Per „Abbrechen“ schließen
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// Fokus kehrt zum auslösenden Element zurück („Weitere Aktionen“, siehe focus-after-delete AC2).
		await expect(moreButton).toBeFocused();
	});
});
