import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec (#316, Sub-C2 von #296) für den **Task/Serie-Umschalter im Anlege-Formular**
 * (`TaskForm`). Anders als `series.spec.ts` (Serien-Verwaltung über die Kopf-Toolbar) prüft diese Spec
 * den **Create-Pfad direkt aus dem „Neuen Task anlegen"-Dialog**: der Nutzer schaltet dort zwischen
 * „Aufgabe" und „Serie" um; im Serie-Modus erscheinen die Serienfelder (`startDate`, `rhythm`) statt der
 * `deadline`, und das Speichern verzweigt zu `POST /series` statt `POST /tasks`.
 *
 * Sie läuft — wie `crud.spec.ts`/`series.spec.ts` — gegen das **echte** Backend (In-Memory-DB); nur
 * `GET /auth/me` ist über die Fixture gemockt. `afterEach` räumt selbst angelegte Tasks und Serien über
 * die echte API wieder ab, damit die In-Memory-DB zwischen den Tests sauber bleibt.
 *
 * **Erwartete (noch nicht existierende) UI**, gegen die diese Tests fahren:
 *  - Im Anlege-Dialog gibt es einen Umschalter mit `data-testid="mode-toggle"` und den Optionen
 *    „Aufgabe"/„Serie".
 *  - Nach Umschalten auf „Serie" sind die Felder „Startdatum" und „Rhythmus" sichtbar, „Deadline
 *    (optional)" ist ausgeblendet.
 *  - „Speichern" im Serie-Modus schickt einen `POST /series`; im Task-Modus einen `POST /tasks`.
 */
test.describe('Priority Pilot — Task/Serie-Umschalter im Anlege-Formular (#316)', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => `E2E TaskForm-Serie ${label} #${(runId += 1)}-${Date.now()}`;

	/** Räumt erst alle Tasks (inkl. generierter Instanzen), dann alle Serien über die echte API ab. */
	const deleteAll = async (page: Page): Promise<void> => {
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAll(page);
	});

	/**
	 * Öffnet den „Neuen Task anlegen"-Dialog und überspringt die Schnellerfassung, sodass das reguläre
	 * `TaskForm` (mit dem Umschalter) sichtbar ist.
	 */
	const openCreateForm = async (page: Page): Promise<void> => {
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
	};

	/** Liefert den Switch-Wrapper (data-testid="mode-switch", #334). */
	const modeSwitch = (page: Page) => page.getByTestId('mode-switch');

	// AK1 (e2e, #334): Der Switch ist im Anlege-Dialog sichtbar und bedienbar (kein Button-Paar mehr).
	test('AK1 (#334) — Switch „Aufgabe/Serie" ist im Anlege-Dialog sichtbar und bedienbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		const wrapper = modeSwitch(page);
		await expect(wrapper).toBeVisible();
		await expect(wrapper.getByRole('switch')).toBeVisible();
		await expect(wrapper.getByRole('switch')).toBeEnabled();
	});

	// AK4 (e2e): Nach Umschalten auf „Serie" erscheinen `startDate` + `rhythm`, `deadline` verschwindet.
	test('AK4 — Serie-Modus zeigt Startdatum + Rhythmus, blendet Deadline aus', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		// Im Task-Modus (Standard) ist die Deadline sichtbar.
		await expect(page.getByLabel('Deadline (optional)')).toBeVisible();

		await modeSwitch(page).getByRole('switch').click();

		// Serienfelder erscheinen …
		await expect(page.getByLabel('Startdatum')).toBeVisible();
		await expect(page.getByLabel('Rhythmus')).toBeVisible();
		// … und die Deadline ist ausgeblendet.
		await expect(page.getByLabel('Deadline (optional)')).toBeHidden();
	});

	// AK5 (e2e): Serie anlegen → das Speichern schickt einen `POST /series` (nicht `/tasks`).
	test('AK5 — Serie anlegen verzweigt zu POST /series', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		await modeSwitch(page).getByRole('switch').click();

		const title = uniqueTitle('Serie-Anlegen');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		// `startDate` ist im Vertrag (`SeriesCreate`) Pflicht — als Anker der Serie setzen.
		await page.getByLabel('Startdatum').fill('2026-09-07');

		// Den ausgehenden Serien-POST erwarten (Beweis für die korrekte Verzweigung).
		const seriesRequestPromise = page.waitForRequest(
			(req) => req.method() === 'POST' && /\/api\/v1\/series(\?|$)/.test(req.url()),
		);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		const seriesRequest = await seriesRequestPromise;
		expect(seriesRequest.url()).toContain('/series');

		// Persistenz gegenprüfen: die Serie liegt tatsächlich im Backend, kein gleichnamiger Task.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		const series = (await (await page.request.get('/api/v1/series')).json()) as { title: string }[];
		expect(series.some((entry) => entry.title === title)).toBeTruthy();
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { title: string }[];
		expect(tasks.some((entry) => entry.title === title)).toBeFalsy();
	});

	// AK5 (e2e, Kontroll-Test): Task anlegen (Task-Modus) → das Speichern schickt einen `POST /tasks`.
	test('AK5 — Task anlegen (Task-Modus) verzweigt zu POST /tasks', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		const title = uniqueTitle('Task-Anlegen');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		const taskRequestPromise = page.waitForRequest(
			(req) => req.method() === 'POST' && /\/api\/v1\/tasks(\?|$)/.test(req.url()),
		);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		const taskRequest = await taskRequestPromise;
		expect(taskRequest.url()).toContain('/tasks');

		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { title: string }[];
		expect(tasks.some((entry) => entry.title === title)).toBeTruthy();
	});

	// AK2 (e2e, #334): Der Anlege-Titel wechselt live beim Umschalten des Switch.
	test('AK2 (#334) — Anlege-Titel wechselt live beim Umschalten des Switch', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		// Nach dem Überspringen: TaskForm im Task-Modus — Titel „Aufgabe anlegen".
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();

		// Switch auf Serie umschalten → Titel „Serie anlegen".
		await modeSwitch(page).getByRole('switch').click();
		await expect(page.getByRole('heading', { name: 'Serie anlegen' })).toBeVisible();

		// Zurück auf Aufgabe → Titel „Aufgabe anlegen".
		await modeSwitch(page).getByRole('switch').click();
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
	});

	// AK7 (e2e): Bei 375×812 lässt sich der Serie-Abschnitt ohne horizontales Scrollen bedienen.
	test('AK7 — Serie-Dialog ohne horizontales Scrollen auf 375px Viewport (Mobile-First)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		await modeSwitch(page).getByRole('switch').click();
		await expect(page.getByLabel('Startdatum')).toBeVisible();
		await expect(page.getByLabel('Rhythmus')).toBeVisible();

		// Kein horizontales Scrollen: die Scrollbreite überschreitet die Viewport-Breite nicht.
		const hasNoHorizontalScroll = await page.evaluate(
			() => document.scrollingElement !== null && document.scrollingElement.scrollWidth <= window.innerWidth,
		);
		expect(hasNoHorizontalScroll).toBeTruthy();
	});

	// AK3 (#330): Beim Umschalten zwischen den Modi bleiben Titel und Beschreibung erhalten — auch bei
	// mehrfachem Wechsel (Aufgabe → Serie → Aufgabe). Die eingegebenen Werte gehen nicht verloren.
	test('AK3 (#330) — Titel/Beschreibung bleiben beim Mode-Toggle erhalten (Aufgabe → Serie → Aufgabe)', async ({
		page,
	}) => {
		await page.goto('/');
		await waitForStableView(page);
		await openCreateForm(page);

		const title = uniqueTitle('Wert-Erhalt');
		await page.getByRole('textbox', { name: 'Titel' }).fill(title);

		// Umschalten auf „Serie" — Startdatum erscheint, der Titel-Wert überlebt.
		await modeSwitch(page).getByRole('switch').click();
		await expect(page.getByLabel('Startdatum')).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);

		// Zurück auf „Aufgabe" — Deadline erscheint wieder, der Titel-Wert überlebt auch den Rückwechsel.
		await modeSwitch(page).getByRole('switch').click();
		await expect(page.getByLabel('Deadline (optional)')).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(title);
	});
});
