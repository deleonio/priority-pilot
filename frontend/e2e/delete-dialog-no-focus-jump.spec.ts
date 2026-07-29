import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #479 — „Kein sichtbarer Fokus-Sprung auf destruktiven Button in
 * Löschen-Dialogen".
 *
 * Abgrenzung zu #472 (cancel-initial-focus.spec.ts): #472 sichert den **Endzustand** — nach dem
 * Öffnen liegt der Fokus auf „Abbrechen". #479 sichert zusätzlich den **Weg dorthin**: Der
 * destruktive „Endgültig löschen"-Button darf zu *keinem* sichtbaren Zeitpunkt fokussiert werden.
 * Ursache des Sprungs ist der 200 ms-`setTimeout`-Workaround in `Modal.tsx`: KoliBris `showModal()`
 * setzt asynchron den Browser-Default-Fokus (erstes fokussierbares Element = „Endgültig löschen"),
 * ehe der Timer den Fokus auf „Abbrechen" umsetzt. Der Nutzer sieht in dieser Zeitspanne den Fokus
 * auf dem destruktiven Button — das soll beseitigt werden.
 *
 * Die Tests sind **rot**, solange die Umsetzung fehlt: Mit dem aktuellen 200 ms-Timer wird der
 * destruktive Button beim Öffnen kurzzeitig fokussiert — der `__deleteButtonEverFocused`-Beobachter
 * registriert das und der Test schlägt fehl. Erst wenn die Umsetzung den Fokus synchron/sichtfrei
 * setzt (z. B. DOM-Reihenfolge, KoliBri-Hook oder robusterer Timing-Hook), wird der destruktive
 * Button nie fokussiert und die Tests werden grün.
 *
 * Technik: Vor dem Öffnen des Dialogs wird ein `focusin`-Beobachter (Capture-Phase) injiziert, der
 * für jedes fokussierte Element prüft, ob dessen zugänglicher Name „Endgültig löschen" lautet, und
 * in diesem Fall das Flag `window.__deleteButtonEverFocused = true` setzt. Da der Beobachter auf der
 * Seite läuft, erfasst er auch das kurze, durch den Timer verursachte Zwischen-Fokussieren. Shadow-
 * DOM wird über `event.composedPath()` aufgelöst.
 */
declare global {
	interface Window {
		/** Wird vom installierten `focusin`-Beobachter auf `true` gesetzt, sobald der destruktive
		 * „Endgültig löschen"-Button auch nur einmal fokussiert wurde (sichtbarer Fokus-Sprung). */
		__deleteButtonEverFocused?: boolean;
	}
}

test.describe('#479 — Kein sichtbarer Fokus-Sprung auf „Endgültig löschen"', () => {
	// Eindeutige Namen je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen.
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E479-${label}-#${(runId += 1)}-${Date.now()}`;

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

	// AK2 legt eine eigene Säule an und löscht sie im Test selbst. Die geseedeten Säulen-Stammdaten
	// (DB_SEED=false) dürfen hier NICHT mitgelöscht werden (siehe Begründung in
	// cancel-initial-focus.spec.ts).
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		await deleteAllSeries(page);
	});

	/** Wechselt auf den „Aufgaben"-Tab. */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Legt über die UI einen Task an und wartet, bis der Anlegen-Dialog geschlossen ist.
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
	 * Installiert einen Beobachter auf der Seite, der jeden Fokuswechsel protokolliert und prüft, ob
	 * jemals der destruktive „Endgültig löschen"-Button fokussiert wurde. Muss VOR dem Öffnen des
	 * Dialogs aufgerufen werden, damit auch der initiale (ggf. fehlerhafte) Fokus erfasst wird.
	 *
	 * Setzt `window.__deleteButtonEverFocused` initial auf `false`. Der `focusin`-Listener läuft in
	 * der Capture-Phase und löst Shadow-DOM über `event.composedPath()` auf — KoliBri-Buttons liegen
	 * im Shadow-DOM, ihr zugänglicher Name steht am `<button>` bzw. am Host (`kol-button`). Wir
	 * werten den Text des tatsächlichen Ziel-Elements aus.
	 */
	const installDeleteFocusWatcher = async (page: Page): Promise<void> => {
		await page.addInitScript(() => {
			window.__deleteButtonEverFocused = false;
			window.addEventListener(
				'focusin',
				(event) => {
					// composedPath() liefert die Kette vom Ziel bis hinauf zum Window, Shadow-Grenzen
					// inklusive. Wir suchen darin das fokussierte Element und prüfen seinen Text.
					const path = event.composedPath();
					for (const node of path) {
						if (!(node instanceof Element)) {
							continue;
						}
						// KoliBri-Buttons (kol-button) nuten delegatesFocus; das eigentliche <button> liegt
						// im Shadow-DOM. composedPath() enthält beide. Wir prüfen den normalisierten Text.
						const text = (node.textContent ?? '').trim().replace(/\s+/g, ' ');
						if (text === 'Endgültig löschen') {
							window.__deleteButtonEverFocused = true;
							break;
						}
					}
				},
				true,
			);
		});
	};

	/**
	 * Gemeinsame Assertion: Nachdem der Lösch-Dialog geöffnet und der Endzustand erreicht ist, muss
	 * „Abbrechen" fokussiert sein UND der destruktive „Endgültig löschen"-Button darf zu keinem
	 * Zeitpunkt fokussiert gewesen sein (kein Sprung/Flackern).
	 */
	const assertNoFocusJump = async (page: Page): Promise<void> => {
		await waitForStableView(page, 'Priority Pilot');

		const cancelButton = page.getByRole('button', { name: 'Abbrechen' });
		const deleteButton = page.getByRole('button', { name: 'Endgültig löschen' });

		// Endzustand: „Abbrechen" fokussiert, „Endgültig löschen" nicht.
		await expect(cancelButton).toBeFocused();
		await expect(deleteButton).not.toBeFocused();

		// Kern des Issues #479: Der destruktive Button darf zu KEINEM Zeitpunkt fokussiert gewesen
		// sein. Mit dem aktuellen 200 ms-Timer-Workaround wird er kurz fokussiert → Flag true → rot.
		const everFocused = await page.evaluate(() => window.__deleteButtonEverFocused);
		expect(everFocused).toBe(false);
	};

	/**
	 * AK1 — Task-Löschdialog: Der „Abbrechen"-Button hat nach dem Öffnen den Initialfokus, und der
	 * destruktive „Endgültig löschen"-Button war zu *keinem* sichtbaren Zeitpunkt fokussiert (kein
	 * Fokus-Sprung/Flackern).
	 *
	 * Given: Ein Task existiert; der „Task löschen"-Dialog wird geöffnet.
	 * When: Der Dialog sichtbar wird (showModal() abgeschlossen).
	 * Then: „Abbrechen" ist fokussiert; „Endgültig löschen" war nie fokussiert.
	 */
	test('AK1 — Task-Löschdialog: „Endgültig löschen" war nie fokussiert', async ({ page }) => {
		// Beobachter VOR der Navigation installieren, damit er ab dem ersten Render aktiv ist.
		await installDeleteFocusWatcher(page);
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Task-NoJump');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		// Löschen-Dialog öffnen
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();

		await assertNoFocusJump(page);
	});

	/**
	 * AK2 — Säulen-Löschdialog: Der „Abbrechen"-Button hat den Initialfokus, und der destruktive
	 * „Endgültig löschen"-Button war zu keinem sichtbaren Zeitpunkt fokussiert.
	 *
	 * Given: Eine Säule existiert; der „Säule löschen"-Dialog wird geöffnet.
	 * When: Der Dialog sichtbar wird.
	 * Then: „Abbrechen" ist fokussiert; „Endgültig löschen" war nie fokussiert.
	 */
	test('AK2 — Säulen-Löschdialog: „Endgültig löschen" war nie fokussiert', async ({ page }) => {
		await installDeleteFocusWatcher(page);
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const name = uniqueTitle('Säule-NoJump');
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

		await assertNoFocusJump(page);
	});

	/**
	 * AK3 — Serien-Löschdialog: Beim Klick auf „Löschen" in der Serien-Verwaltung erscheint ein
	 * Bestätigungsdialog (keine Sofort-Löschung), der „Abbrechen"-Button hat den Initialfokus, und
	 * der destruktive „Endgültig löschen"-Button war zu keinem sichtbaren Zeitpunkt fokussiert.
	 *
	 * Voraussetzung: Der Bestätigungsdialog für Serien existiert bereits aus #472 (AK3). Dieser Test
	 * sichert ergänzend, dass auch beim Serien-Dialog der destruktive Button nie fokussiert wird.
	 *
	 * Given: Eine Serie existiert; der Nutzer klickt „Löschen" in der Serien-Verwaltung.
	 * When: Der Bestätigungsdialog geöffnet wird.
	 * Then: Es erscheint ein Bestätigungsdialog, „Abbrechen" ist fokussiert, „Endgültig löschen"
	 *       war nie fokussiert.
	 */
	test('AK3 — Serien-Löschdialog: „Endgültig löschen" war nie fokussiert', async ({ page }) => {
		// Serie direkt über die echte API anlegen (Setup).
		const title = uniqueTitle('Serie-NoJump');
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

		// Beobachter VOR der Navigation installieren.
		await installDeleteFocusWatcher(page);
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

		// Klick auf „Löschen" — darf NICHT sofort löschen, sondern muss einen Bestätigungsdialog
		// öffnen (Voraussetzung aus #472).
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		const confirmButton = page.getByRole('button', { name: 'Endgültig löschen' });
		await expect(confirmButton).toBeVisible();

		// Die Serie wurde durch den bloßen Klick noch NICHT gelöscht (Dialog statt Sofort-Löschung).
		const afterClickSeries = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(afterClickSeries.some((s) => s.title === title)).toBeTruthy();

		// Kern des Issues #479: kein sichtbarer Fokus-Sprung auf den destruktiven Button.
		await assertNoFocusJump(page);
	});

	/**
	 * AK4 — Mobile-First (375 px): Der geöffnete Task-Lösch-Dialog löst kein horizontales Scrollen
	 * aus; beide Buttons bleiben erreichbar.
	 *
	 * Given: Lösch-Dialog geöffnet bei 375 px-Viewport.
	 * Then: Dialog bleibt innerhalb des Viewports (kein horizontales Scrollen), beide Buttons sind
	 *       erreichbar.
	 */
	test('AK4 — Mobile-First 375px: Lösch-Dialog ohne horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Task-Mobile-NoJump');
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
	 * AK5 (Regression) — Die Fokus-Rückgabe beim Schließen (#182) bleibt nach der neuen
	 * Initialfokus-Logik (kein Sprung) intakt. Schließt man den Dialog per „Abbrechen", kehrt der
	 * Fokus zum auslösenden Element zurück.
	 *
	 * Given: Dialog per „Abbrechen" geschlossen.
	 * Then: Der Fokus kehrt zum auslösenden Element zurück (bestehendes Verhalten aus
	 *       Modal.tsx / Issue #182 bleibt unberührt — keine Änderung am Cleanup-Rückgabeweg).
	 */
	test('AK5 (Regression) — Fokus-Rückgabe beim Abbrechen bleibt intakt', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Regression-NoJump');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		const moreButton = page.getByRole('button', { name: 'Weitere Aktionen' }).first();
		await moreButton.click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);

		// Per „Abbrechen" schließen
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// Fokus kehrt zum auslösenden Element zurück („Weitere Aktionen", siehe focus-after-delete AC2).
		await expect(moreButton).toBeFocused();
	});
});
