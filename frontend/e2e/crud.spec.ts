import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Funktionale End-to-End-CRUD-Specs (#92) gegen das **echte** Backend (#91). Anders als die früheren,
 * gemockten Klicktests wird hier **nichts** via `page.route` abgefangen: Playwright startet ein echtes
 * Express-Backend mit temporärer In-Memory-DB (`:memory:`, `DB_RESET=true`, `DB_SEED=false`, siehe
 * `playwright.config.ts`); der Vite-Proxy reicht die API-Requests durch. Die Tests legen über die UI
 * **selbst** Daten an, ändern und löschen sie und prüfen, dass die Mutation tatsächlich „durchsickert"
 * — also in der echten Liste bzw. nach einem Reload aus der DB sichtbar bleibt.
 *
 * **Isolation:** Da die In-Memory-DB für die gesamte Lebensdauer des Backend-Prozesses bestehen bleibt
 * (ein Worker, kein Neustart zwischen Tests), räumt `afterEach` die angelegten Tasks über die echte API
 * wieder ab. So startet jeder Test von einem definierten, leeren Task-Zustand — unabhängig von der
 * Ausführungsreihenfolge — und auch der `smoke.spec.ts`-Test findet danach wieder den leeren Anfang.
 */
test.describe('Priority Pilot — funktionale CRUD-Specs gegen das echte Backend', () => {
	// Eindeutige Titel je Test, damit Assertions ausschließlich auf selbst angelegte Daten zielen
	// (kein Verlass auf Demo-Seed) und parallele/aufeinanderfolgende Läufe sich nicht stören.
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

	/** Wechselt auf den „Aufgaben"-Tab (die Task-Tabelle liegt dort). */
	const openTasksTab = async (page: Page): Promise<void> => {
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	};

	/**
	 * Legt über die UI einen Task mit dem gegebenen Titel an (Default-Felder genügen der Validierung:
	 * Priorität 3, Aufwand 0,5, Status „Offen") und wartet, bis der Dialog geschlossen ist.
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

	test('Task anlegen: erscheint in der Liste', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		// Frischer Start ohne Demo-Seed: die Onboarding-Ansicht ist sichtbar.
		await expect(page.getByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible();

		const title = uniqueTitle('Anlegen');
		await createTaskViaUi(page, title);

		// Sobald ein Task existiert, erscheint die Tab-Leiste; in der Task-Liste ist der Titel direkt
		// als Textinhalt des span.task-tree-title sichtbar.
		await openTasksTab(page);
		await expect(page.getByText(title, { exact: true })).toBeVisible();
	});

	test('Task bearbeiten: geänderte Priorität bleibt sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Bearbeiten');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await waitForStableView(page);

		// Priorität auf Minimum (1) setzen. `KolInputRange` → natives `<input type="range">` im
		// Shadow-DOM; `Home` setzt zuverlässig auf das Minimum.
		await page.locator('input[type="range"][min="1"][max="5"][step="1"]').press('Home');
		await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();

		await openTasksTab(page);

		// Persistenz prüfen: Dialog erneut öffnen — Werte kommen frisch aus dem Backend.
		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
		await waitForStableView(page);
		await expect(page.locator('input[type="range"][min="1"][max="5"][step="1"]')).toHaveValue('1');
	});

	test('Task löschen: verschwindet aus der Liste', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const title = uniqueTitle('Löschen');
		await createTaskViaUi(page, title);

		await openTasksTab(page);
		// In der Task-Liste ist der Titel direkt als Textinhalt sichtbar.
		await expect(page.getByText(title, { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
		await page.getByRole('button', { name: 'Löschen' }).first().click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Endgültig löschen' }).click();
		await expect(page.getByRole('heading', { name: 'Task löschen' })).toBeHidden();

		// War es der einzige Task, kehrt die App in den leeren Anfangszustand zurück; der Titel ist weg.
		await expect(page.getByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible();
		await expect(page.getByText(title, { exact: true })).toHaveCount(0);
	});

	test('Säulen-Gewicht ändern: Wert persistiert über einen Reload', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		/** Öffnet die Säulen-Gewichtungs-Seite über die Settings-Route. */
		const openPillarWeights = async (): Promise<void> => {
			await page.goto('/settings/pillars');
			await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
			await waitForStableView(page);
		};

		await openPillarWeights();

		// Erste Säule auf das Maximum (Rohwert 1,0), alle übrigen auf 0 setzen. Die Rohwerte werden beim
		// Speichern auf 100 % normiert → erste Säule 100 %, Rest 0 %. Beim erneuten Laden rechnet die UI
		// 100 % zurück auf den Rohwert 1,0 (bzw. 0 % → 0), sodass die Werte deterministisch round-trippen.
		// `End`/`Home` setzen den nativen Range-Input zuverlässig auf Max bzw. Min (kein `fill` auf Range).
		//
		// KoliBris `KolInputRange` exponiert KEIN `role="slider"` und kein `aria-label` aus seinem
		// `_label`; im (offenen) Shadow-DOM steckt jedoch ein natives `<input type="range">`. Playwrights
		// CSS durchdringt offene Shadow-Roots, daher zielen wir direkt auf diese Range-Inputs.
		const sliders = page.locator('input[type="range"]');
		const sliderCount = await sliders.count();
		expect(sliderCount).toBeGreaterThan(1);
		await sliders.first().press('End');
		for (let index = 1; index < sliderCount; index += 1) {
			await sliders.nth(index).press('Home');
		}

		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden();

		// Harter Reload: lädt die Säulen frisch aus dem Backend — beweist die Persistenz in der DB.
		await page.reload();
		await waitForStableView(page);
		await openPillarWeights();

		const reloadedSliders = page.locator('input[type="range"]');
		await expect(reloadedSliders.first()).toHaveValue('1');
		await expect(reloadedSliders.nth(1)).toHaveValue('0');
	});
});
