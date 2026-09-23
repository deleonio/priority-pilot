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
 *
 * #1465: „Erledigen" und der Bearbeiten-Stift (#1447) liegen jetzt nebeneinander in
 * `.dashboard-next-task-actions`. Der Breiten-Vertrag zieht damit vom einzelnen Button auf die
 * Zeile um (AK1/AK2 gemessen an der Zeile bzw. am ersten Button darin); AK4 sichert die eine Zeile.
 */

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

/** Legt eine offene Aufgabe an und öffnet das Dashboard mit sichtbarem „Erledigen"-Button. */
async function openDashboardWithStartButton(page: Page): Promise<void> {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.request.post('/api/v1/tasks', { data: { title: 'E2E #1042 Signal-Panel-Task', priority: 5 } });

	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);

	// #1168 AK1/AK7: der Button heißt „Erledigen" statt „Jetzt starten".
	await expect(page.getByRole('button', { name: 'Erledigen' })).toBeVisible();
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

/**
 * #1465: Der Breiten-Vertrag gilt jetzt für die Aktionszeile — „Erledigen" und der Bearbeiten-Stift
 * (#1447) liegen nebeneinander in `.dashboard-next-task-actions` statt untereinander im
 * Content-Container. Gemessen wird weiterhin der HOST `kol-button` (Repo-Konvention).
 */
const actionsRow = (page: Page) => page.locator('.dashboard-next-task-actions');
const startButtonHost = (page: Page) => page.locator('.dashboard-next-task-actions > kol-button').first();
const editButtonHost = (page: Page) => page.locator('.dashboard-next-task-actions > kol-button').nth(1);

test.describe('#1042 „Jetzt starten"-Button responsiv', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/**
	 * AK1 (Schutz): Mobil (375px) füllt die Aktionszeile die Container-Innenbreite (Toleranz 2px),
	 * „Erledigen" nimmt darin die Restbreite neben dem Stift ein. Vor #1465 galt dieselbe Zusicherung
	 * für den Button selbst — der Stift stand damals in einer eigenen Zeile darunter.
	 */
	test('AK1: mobil (375px) füllt die Aktionszeile die Innenbreite, „Erledigen" die Restbreite', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboardWithStartButton(page);

		const { innerWidth } = await containerMetrics(page);
		const [rowBox, doneBox, editBox] = await Promise.all([
			actionsRow(page).boundingBox(),
			startButtonHost(page).boundingBox(),
			editButtonHost(page).boundingBox(),
		]);
		expect(rowBox).toBeTruthy();
		expect(doneBox).toBeTruthy();
		expect(editBox).toBeTruthy();

		expect(Math.abs(rowBox!.width - innerWidth)).toBeLessThanOrEqual(2);
		// „Erledigen" beginnt links in der Zeile und endet vor dem Stift, der rechts abschließt.
		expect(Math.abs(doneBox!.x - rowBox!.x)).toBeLessThanOrEqual(2);
		expect(doneBox!.x + doneBox!.width).toBeLessThanOrEqual(editBox!.x + 1);
		expect(Math.abs(editBox!.x + editBox!.width - (rowBox!.x + rowBox!.width))).toBeLessThanOrEqual(2);
	});

	/**
	 * AK4 (#1465): Beide Aktionen stehen in EINER Zeile — gleiche Oberkante, beide ≥44px hoch
	 * (Mobile-UI-Regel 2), kein horizontaler Überlauf.
	 */
	test('AK4 (#1465): „Erledigen" und Stift liegen bei 375px in derselben Zeile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboardWithStartButton(page);

		const [doneBox, editBox] = await Promise.all([
			startButtonHost(page).boundingBox(),
			editButtonHost(page).boundingBox(),
		]);
		expect(doneBox).toBeTruthy();
		expect(editBox).toBeTruthy();

		expect(Math.abs(doneBox!.y - editBox!.y), 'gleiche Oberkante = eine Zeile').toBeLessThanOrEqual(2);
		expect(doneBox!.height).toBeGreaterThanOrEqual(44);
		expect(editBox!.height).toBeGreaterThanOrEqual(44);

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
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
