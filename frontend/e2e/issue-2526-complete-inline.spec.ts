import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #2526 „Erledigen mit einem Tipp, sichtbarem Erfolg und Rückgängig“.
 *
 * Spec: `docs/spec/issue-2526.md`, Produktvertrag ADR 0024. Heute öffnet „Erledigen“ im
 * Signal-Panel den Bestätigungsdialog und es gibt keine Inline-Rückmeldung — AK1 (kein Dialog),
 * AK2/AK3/AK4 (Rückmeldung + „Rückgängig“ + 7-s-Fenster) und AK8 laufen bis zur Umsetzung rot.
 * AK5 (Checkliste/verpasst) ist gegen `issue-1583`/`issue-1964` dedupliziert, AK6 gegen
 * `issue-2522`/`issue-1182` (Test-Pflege), der Reopen-Score gegen `tasks-reopen-score.test.ts`.
 *
 * Punkte-Vertrag (eine Wahrheit, Server): PATCH /tasks/:id liefert beim Done-Übergang
 * `vergebenePunkte` (score.ts: estimatedEffort × priority, ohne Deadline pünktlich = voll).
 * Seeds nutzen estimatedEffort 1 × priority 3 ⇒ „+3 Punkte“.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const createTask = async (
	page: Page,
	title: string,
	options: { priority?: number; estimatedEffort?: number; deadline?: string } = {},
): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: {
			title,
			priority: options.priority ?? 3,
			estimatedEffort: options.estimatedEffort ?? 1,
			...(options.deadline !== undefined ? { deadline: options.deadline } : {}),
		},
	});
	expect(response.ok()).toBeTruthy();
	const created = (await response.json()) as { id: number };
	return created.id;
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

const openAufgaben = async (page: Page): Promise<void> => {
	await page.goto('/app/aufgaben');
	await waitForStableView(page);
};

const taskStatus = async (page: Page, id: number): Promise<string> => {
	const response = await page.request.get(`/api/v1/tasks/${id}`);
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { status: string };
	return task.status;
};

/** Panel-Inhalt „Nächste Aufgabe“ — die Tipp-Stelle des Dashboards. */
const panel = (page: Page) => page.locator('.dashboard-next-task-content');

/** Erledigt über den „…“-Popover der Aufgabenlisten-Zeile (#387). */
const completeViaListe = async (page: Page, id: number): Promise<void> => {
	await page.getByTestId(`task-list-item-${id}`).getByRole('button', { name: 'Weitere Aktionen' }).click();
	await page.getByRole('button', { name: 'Erledigt', exact: true }).first().click();
};

test.describe('#2526 Erledigen mit einem Tipp, sichtbarem Erfolg und Rückgängig', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1: Ein Tipp auf „Erledigen“ erledigt ohne Checkliste direkt — kein Bestätigungsdialog', async ({ page }) => {
		const id = await createTask(page, 'E2E #2526 Direkt', { priority: 5 });
		await createTask(page, 'E2E #2526 Zweite', { priority: 2 });

		await openDashboard(page);
		await expect(panel(page)).toContainText('E2E #2526 Direkt');

		await page.getByRole('button', { name: 'Erledigen', exact: true }).click();

		// Kein Bestätigungsdialog: der Dialog-Titel darf gar nicht erst auftauchen.
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toHaveCount(0);
		await expect.poll(async () => taskStatus(page, id)).toBe('Done');
	});

	test('AK1/AK5: verpasste Aufgabe öffnet weiterhin die Pünktlich-Nachfrage (MissedCompleteDialog)', async ({
		page,
	}) => {
		const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
		const id = await createTask(page, 'E2E #2526 Verpasst', { priority: 5, deadline: past });

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen', exact: true }).click();

		// Nachfrage statt Direkt-Erledigen: „Pünktlich erledigt“ existiert nur im MissedCompleteDialog,
		// „Als erledigt markieren“ nur im (abgelösten) CompleteTaskDialog.
		await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pünktlich erledigt' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Als erledigt markieren' })).toHaveCount(0);
		expect(await taskStatus(page, id)).toBe('Open');
	});

	test('AK2: Rückmeldung zeigt Punkte und Streak an der Tipp-Stelle; „Rückgängig“ öffnet die Aufgabe wieder', async ({
		page,
	}) => {
		const id = await createTask(page, 'E2E #2526 Rückmeldung', { priority: 3, estimatedEffort: 1 });

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen', exact: true }).click();

		// 1 × 3, ohne Deadline pünktlich ⇒ voller Basiswert.
		await expect(panel(page)).toContainText('+3 Punkte');
		await expect(panel(page)).toContainText(/Streak 1 Tag(?!e)/);

		await page.getByRole('button', { name: 'Rückgängig' }).click();
		await expect.poll(async () => taskStatus(page, id)).toBe('Open');
		await expect(panel(page)).toContainText('E2E #2526 Rückmeldung');
	});

	test('AK3: nach 7 Sekunden zeigt das Panel die nächste Aufgabe (Fenster abgelaufen)', async ({ page }) => {
		await page.clock.install();
		await createTask(page, 'E2E #2526 Erste', { priority: 5 });
		await createTask(page, 'E2E #2526 Nächste', { priority: 2 });

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen', exact: true }).click();
		await expect(panel(page)).toContainText(/Streak 1 Tag(?!e)/);
		await expect(panel(page)).not.toContainText('E2E #2526 Nächste');

		await page.clock.fastForward(7000);
		await expect(panel(page)).toContainText('E2E #2526 Nächste');
		await expect(page.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
	});

	test('AK3: Neuladen im Fenster macht die Erledigung endgültig', async ({ page }) => {
		const id = await createTask(page, 'E2E #2526 Endgültig', { priority: 5 });

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen', exact: true }).click();
		await expect(panel(page)).toContainText(/\+\d+ Punkte/);

		await page.reload();
		await waitForStableView(page);
		await expect.poll(async () => taskStatus(page, id)).toBe('Done');
		await expect(page.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
	});

	test('AK4: Aufgabenliste erledigt direkt, zeigt die Rückmeldung an der Zeile; nach 7 s baut die Zeile ab', async ({
		page,
	}) => {
		await page.clock.install();
		const id = await createTask(page, 'E2E #2526 Liste', { priority: 3, estimatedEffort: 1 });

		await openAufgaben(page);
		const zeile = page.getByTestId(`task-list-item-${id}`);
		await completeViaListe(page, id);

		await expect(zeile).toContainText('+3 Punkte');
		await zeile.getByRole('button', { name: 'Rückgängig' }).click();
		await expect.poll(async () => taskStatus(page, id)).toBe('Open');

		// Erneut erledigen; nach Ablauf des 7-s-Fensters baut die Zeile ab.
		await completeViaListe(page, id);
		await expect(zeile).toContainText(/\+\d+ Punkte/);
		await page.clock.fastForward(7000);
		await expect(zeile).toHaveCount(0);
	});

	test('AK8: 375×812 Dashboard — „Rückgängig“ vollständig im Viewport, Touch-Target ≥ 44 px', async ({ page }) => {
		// Test-Pflege #2526: `test.use()` im Test-Body ist Playwright-unzulässig (bricht beim Sammeln
		// ab) — Viewport stattdessen dynamisch setzen, Vertrag (375×812) unverändert.
		await page.setViewportSize({ width: 375, height: 812 });
		await createTask(page, 'E2E #2526 Mobil Panel', { priority: 3, estimatedEffort: 1 });

		await openDashboard(page);
		await page.getByRole('button', { name: 'Erledigen', exact: true }).click();
		await expect(panel(page)).toContainText(/\+\d+ Punkte/);

		const box = await page.getByRole('button', { name: 'Rückgängig' }).boundingBox();
		expect(box, '„Rückgängig“ muss messbar sein').not.toBeNull();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.y + box!.height).toBeLessThanOrEqual(812);
	});

	test('AK8: 375×812 Aufgabenliste — Rückmeldung an der Zeile ohne horizontales Clipping', async ({ page }) => {
		// Test-Pflege #2526: dito — dynamischer Viewport statt unzulässigem test.use() im Body.
		await page.setViewportSize({ width: 375, height: 812 });
		const id = await createTask(page, 'E2E #2526 Mobil Liste', { priority: 3, estimatedEffort: 1 });

		await openAufgaben(page);
		await completeViaListe(page, id);

		const zeile = page.getByTestId(`task-list-item-${id}`);
		await expect(zeile).toContainText(/\+\d+ Punkte/);
		const box = await zeile.getByRole('button', { name: 'Rückgängig' }).boundingBox();
		expect(box, '„Rückgängig“ muss messbar sein').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});
});
