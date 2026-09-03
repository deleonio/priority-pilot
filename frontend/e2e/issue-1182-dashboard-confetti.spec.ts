import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1182 „Konfetti auch über den Dashboard-Pfad".
 *
 * Spezifikation: `docs/spec/issue-1182.md`. Das Konfetti-Overlay existiert (#1169,
 * `frontend/src/lib/confetti.ts`), aber `completeTask` (App.tsx, hinter `openComplete`)
 * ruft `launchConfetti()` noch nicht auf → AK1/AK3/AK4 laufen in ihren Ziel-Assertionen
 * rot, bis die Verdrahtung existiert.
 *
 * Konventionen wie `issue-1168-dashboard-done-button.spec.ts` (Dashboard-Signal-Panel,
 * Bestätigungsdialog) und `issue-1169-confetti.spec.ts` (Overlay-Vertrag): echtes Backend,
 * API-Seed pro Test, `afterEach` räumt alle Tasks ab. Das Overlay wird ausschließlich über
 * `data-testid="confetti-overlay"` adressiert.
 *
 * AK2 (Wieder-Öffnen ohne Konfetti) ist bewusst nicht erneut getestet — Dedup gegen
 * `issue-1169-confetti.spec.ts` AK3, der den einzigen Reopen-Pfad (Aufgabenliste-Umschalter)
 * unverändert grün hält.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const createTask = async (page: Page, title: string, priority: number): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', { data: { title, priority } });
	expect(response.ok()).toBeTruthy();
	const created = (await response.json()) as { id: number };
	return created.id;
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

const taskStatus = async (page: Page, id: number): Promise<string> => {
	const response = await page.request.get(`/api/v1/tasks/${id}`);
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { status: string };
	return task.status;
};

/** Das Konfetti-Overlay — der einzige Vertragspunkt zwischen Spec und Umsetzung (#1169). */
const confetti = (page: Page) => page.getByTestId('confetti-overlay');

/** AK1-Ablauf: Aufgabe über das Signal-Panel und den Bestätigungsdialog erledigen. */
const completeViaDashboard = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Erledigt', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeVisible();
	await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
	await expect(page.getByRole('heading', { name: 'Aufgabe erledigen' })).toBeHidden();
};

test.describe('#1182 Konfetti über das Dashboard-Signal-Panel', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1: Bestätigen des Dialogs „Aufgabe erledigen" erzeugt genau ein Konfetti-Overlay', async ({ page }) => {
		const id = await createTask(page, 'E2E #1182 Signal-Panel', 5);

		await openDashboard(page);
		await expect(page.locator('.dashboard-next-task-content')).toContainText('E2E #1182 Signal-Panel');

		await completeViaDashboard(page);

		// Erwartetes Verhalten: genau EIN Overlay (kein Doppel-Start aus Dialog- und Panel-Pfad).
		await expect(confetti(page)).toBeVisible();
		expect(await confetti(page).count()).toBe(1);
		await expect.poll(async () => taskStatus(page, id)).toBe('Done');
	});

	test('AK3: bei prefers-reduced-motion: reduce bleibt das Konfetti über den Dashboard-Pfad aus', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const id = await createTask(page, 'E2E #1182 Reduce', 5);

		await openDashboard(page);
		await completeViaDashboard(page);

		// Der Statuswechsel funktioniert trotzdem …
		await expect.poll(async () => taskStatus(page, id)).toBe('Done');

		// … nur der Effekt bleibt aus (JS-Abfrage in launchConfetti, s. Spec #1169 AK6).
		await page.waitForTimeout(1_000);
		expect(await confetti(page).count()).toBe(0);
	});

	test('AK4: auf 375×667 erscheint das Overlay vollständig im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await createTask(page, 'E2E #1182 Mobil', 5);

		await openDashboard(page);
		await completeViaDashboard(page);

		await expect(confetti(page)).toBeVisible();

		// Kein horizontaler Überlauf: Bounding-Box messen (die App-Shell clippt mit
		// overflow-x: hidden, scrollWidth bleibt strukturell ≤ Viewport).
		const box = await confetti(page).boundingBox();
		expect(box).not.toBeNull();
		if (box !== null) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.y).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
			expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
		}
	});
});
