import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1042 „Button ‚Jetzt starten' im Dashboard-Signal-Panel responsiv".
 *
 * Spec-Bezug: docs/spec/issue-1042.md — Erwartetes Ergebnis AK1, AK2, AK3.
 *
 * Der Button „Jetzt starten" im Signal-Panel „Nächste Aufgabe" (Dashboard.tsx:184-189) ist als
 * Kind von `.dashboard-next-task-content` (flex-column) ein Flex-Item mit Default
 * `align-self: stretch` — er füllt daher HEUTE auf jeder Breite die Container-Innenbreite.
 * → AK1/AK3 (mobil) sind bereits grün (Ist-Zustand, Schutz-AK gegen Regression durch die
 * Desktop-Änderung). AK2 (Desktop inhaltsbreit + linksbündig) ist ROT, bis die
 * `min-width: 768px`-Regel analog `.settings-action-btn` (#1017/#932) existiert.
 *
 * Gemessen wird das HOST-Element `kol-button` (Repo-Konvention wie in settings-action-buttons.spec.ts).
 *
 * #1168 (TF7): Der Button wurde umbenannt in „Erledigt" (`docs/spec/issue-1168.md` AK1/AK7) — der
 * Layout-Vertrag (AK1–AK3 hier) bleibt für den umbenannten Button inhaltlich gültig und wird unter
 * dem neuen Label geprüft.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

/** Legt eine offene Aufgabe an und öffnet das Dashboard mit sichtbarem „Erledigt"-Button. */
async function openDashboardWithStartButton(page: Page): Promise<void> {
	await page.goto('/');
	await waitForStableView(page);
	await page.request.post('/api/v1/tasks', { data: { title: 'E2E #1042 Signal-Panel-Task', priority: 5 } });

	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);

	// #1168 AK1/AK7: der Button heißt „Erledigt" statt „Jetzt starten".
	await expect(page.getByRole('button', { name: 'Erledigt' })).toBeVisible();
}

/** Innenbreite/-rand aus dem gerenderten Style von `.dashboard-next-task-content`. */
async function containerMetrics(page: Page): Promise<{ innerLeft: number; innerWidth: number }> {
	return page
		.locator('.dashboard-next-task-content')
		.first()
		.evaluate((el) => {
			const rect = el.getBoundingClientRect();
			const style = window.getComputedStyle(el);
			const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
			const paddingRight = Number.parseFloat(style.paddingRight) || 0;
			return {
				innerLeft: rect.x + paddingLeft,
				innerWidth: rect.width - paddingLeft - paddingRight,
			};
		});
}

const startButtonHost = (page: Page) => page.locator('.dashboard-next-task-content > kol-button');

test.describe('#1042 „Jetzt starten"-Button responsiv', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/**
	 * AK1 (Schutz, heute grün): Mobil (375px) füllt der Button die Container-Innenbreite
	 * (Toleranz 2px) — heutiger Ist-Zustand durch Flex-Default `align-self: stretch`.
	 */
	test('AK1: mobil (375px) füllt der Button die Innenbreite von .dashboard-next-task-content', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboardWithStartButton(page);

		const { innerWidth } = await containerMetrics(page);
		const box = await startButtonHost(page).boundingBox();
		expect(box).toBeTruthy();
		expect(Math.abs(box!.width - innerWidth)).toBeLessThanOrEqual(2);
	});

	/**
	 * AK2 (rot): Desktop (1280px) ist der Button inhaltsbreit (<60% Container-Innenbreite) und
	 * linksbündig mit `.dashboard-next-task-title`. Heute füllt der Button die volle
	 * Flex-Breite (`align-self: stretch` ohne Desktop-Ausnahme) — Test wird rot.
	 */
	test('AK2: desktop (1280px) ist der Button inhaltsbreit und linksbündig mit dem Titel', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openDashboardWithStartButton(page);

		const { innerWidth } = await containerMetrics(page);
		const [buttonBox, titleBox] = await Promise.all([
			startButtonHost(page).boundingBox(),
			page.locator('.dashboard-next-task-title').first().boundingBox(),
		]);
		expect(buttonBox).toBeTruthy();
		expect(titleBox).toBeTruthy();

		expect(buttonBox!.width).toBeLessThan(0.6 * innerWidth);
		expect(Math.abs(buttonBox!.x - titleBox!.x)).toBeLessThanOrEqual(2);
	});

	/**
	 * AK3 (Schutz, heute grün): Touch-Target-Höhe bleibt bei 375px >= 44px — die
	 * Breitenschaltung darf KoliBri-Default-Paddings/-Höhen nicht reduzieren (Mobile-UI-Regel 2).
	 */
	test('AK3: Touch-Target des Buttons bleibt bei 375px >= 44px hoch', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboardWithStartButton(page);

		const box = await startButtonHost(page).boundingBox();
		expect(box).toBeTruthy();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});
});
