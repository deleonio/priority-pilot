import { expect, test, type Page } from './fixtures';
import { MOBILE, waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #2767 „App: Erledigt-Feedback nach „Wieder öffnen“ räumen“.
 *
 * Spec: `docs/spec/issue-2767.md`. Ursache: das Reopen aus der Erledigt-Tabelle
 * (`CompletedTasksTable.tsx:92-103`) räumt das App-seitige `doneFeedback` nicht — die wieder
 * geöffnete Zeile trägt weiter „+X Punkte · Streak N“ samt „Rückgängig“; ein Klick darauf
 * erledigt erneut und vergibt erneut Punkte. AK3 (regulärer Erledigen-Moment inkl. Undo im
 * Fenster) ist gegen `issue-2526-complete-inline.spec.ts` dedupliziert (AK2 Panel, AK4 Liste)
 * und läuft hier nur als Positiv-Kontrolle im selben Ablauf.
 *
 * Punkte-Vertrag wie #2526: Seeds nutzen estimatedEffort 1 × priority 3 ⇒ „+3 Punkte“.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const createTask = async (page: Page, title: string): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(response.ok()).toBeTruthy();
	const created = (await response.json()) as { id: number };
	return created.id;
};

const taskStatus = async (page: Page, id: number): Promise<string> => {
	const response = await page.request.get(`/api/v1/tasks/${id}`);
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { status: string };
	return task.status;
};

/** Punktesumme über alle ScoreEntries — der Spiegel für AK2 (Reopen vergibt keine Punkte). */
const scoreSum = async (page: Page): Promise<number> => {
	const response = await page.request.get('/api/v1/scores');
	expect(response.ok()).toBeTruthy();
	const entries = (await response.json()) as { punkte: number }[];
	return entries.reduce((sum, entry) => sum + entry.punkte, 0);
};

const openAufgaben = async (page: Page): Promise<void> => {
	await page.goto('/app/aufgaben');
	await waitForStableView(page);
};

/** Erledigt über den „…“-Popover der Aufgabenlisten-Zeile (#387). */
const completeViaListe = async (page: Page, id: number): Promise<void> => {
	await page.getByTestId(`task-list-item-${id}`).getByRole('button', { name: 'Weitere Aktionen' }).click();
	await page.getByRole('button', { name: 'Erledigt', exact: true }).first().click();
};

// Offen/Erledigt-Umschalter des Aufgaben-Tabs — Idempotenz-Muster aus `completed-tasks.spec.ts`
// (Klick nur bei abweichendem Zustand, auto-retryende Assertion per toPass).
const viewSwitch = (page: Page) => page.getByRole('checkbox', { name: /Erledigte Aufgaben/i });

const setViewSwitch = async (page: Page, on: boolean): Promise<void> => {
	await expect(async () => {
		if ((await viewSwitch(page).isChecked()) !== on) {
			await viewSwitch(page).click();
		}
		await expect(viewSwitch(page)).toBeChecked({ checked: on, timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
};

test.describe('#2767 Erledigt-Feedback nach „Wieder öffnen“ räumen', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1/AK2: Nach „Wieder öffnen“ aus der Erledigt-Tabelle ist die Zeilen-Rückmeldung geräumt — kein Undo, Punktestand unverändert', async ({
		page,
	}) => {
		await page.clock.install();
		const id = await createTask(page, 'E2E #2767 Reopen');
		const basisPunkte = await scoreSum(page);

		await openAufgaben(page);
		const zeile = page.getByTestId(`task-list-item-${id}`);
		await completeViaListe(page, id);

		// Positiv-Kontrolle (AK3-Rand): nach dem Erledigen steht die Rückmeldung wie heute an der Zeile.
		await expect(zeile).toContainText('+3 Punkte');
		await expect(zeile.getByRole('button', { name: 'Rückgängig' })).toBeVisible();

		// 7-s-Fenster ablaufen lassen: Auto-Reload baut die Zeile ab, die Aufgabe landet in der
		// Erledigt-Tabelle.
		await page.clock.fastForward(7000);
		await expect(zeile).toHaveCount(0);

		await setViewSwitch(page, true);
		const erledigtZeile = page.getByRole('row').filter({ hasText: 'E2E #2767 Reopen' });
		await expect(erledigtZeile).toBeVisible();
		await erledigtZeile.getByRole('button', { name: 'Wieder öffnen' }).click();
		await expect.poll(async () => taskStatus(page, id)).toBe('Open');

		// AK1: die offene Zeile trägt keine Erledigungs-Rückmeldung mehr (rot: stale „+3 Punkte“).
		await setViewSwitch(page, false);
		const zeileNachReopen = page.getByTestId(`task-list-item-${id}`);
		await expect(zeileNachReopen).toBeVisible();
		await expect(zeileNachReopen.locator('.task-tree-done-feedback')).not.toContainText(/Punkte/);

		// AK2: kein steuerbares Undo mehr; der Punktestand bleibt durch den Reopen unverändert.
		await expect(zeileNachReopen.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
		expect(await scoreSum(page)).toBe(basisPunkte);
	});

	test('AK4: 375×812 — auch mobil trägt die offene Zeile nach „Wieder öffnen“ keine Rückmeldung', async ({ page }) => {
		// Test-Pflege #2526: `test.use()` im Test-Body ist Playwright-unzulässig — Viewport dynamisch.
		await page.setViewportSize(MOBILE);
		await page.clock.install();
		const id = await createTask(page, 'E2E #2767 Mobil');

		await openAufgaben(page);
		const zeile = page.getByTestId(`task-list-item-${id}`);
		await completeViaListe(page, id);
		await expect(zeile).toContainText('+3 Punkte');

		await page.clock.fastForward(7000);
		await expect(zeile).toHaveCount(0);

		await setViewSwitch(page, true);
		const erledigtZeile = page.getByRole('row').filter({ hasText: 'E2E #2767 Mobil' });
		await expect(erledigtZeile).toBeVisible();
		await erledigtZeile.getByRole('button', { name: 'Wieder öffnen' }).click();
		await expect.poll(async () => taskStatus(page, id)).toBe('Open');

		await setViewSwitch(page, false);
		const zeileNachReopen = page.getByTestId(`task-list-item-${id}`);
		await expect(zeileNachReopen).toBeVisible();
		await expect(zeileNachReopen.locator('.task-tree-done-feedback')).not.toContainText(/Punkte/);
		await expect(zeileNachReopen.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0);
	});
});
