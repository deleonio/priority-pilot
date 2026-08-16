import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für Issue #390: Dashboard zeigt genau drei Statuskacheln (Gesamt, Offen, Erledigt);
 * die Kachel „In Bearbeitung" ist entfernt. Bei Mobilbreite 375×812 passen alle drei Kacheln
 * ohne horizontalen Overflow in eine Reihe (AK3, Mobile-First).
 */
test.describe('Dashboard — drei Statuskacheln (Issue #390)', () => {
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

	test('AK3: genau drei Kacheln bei 375×812, kein horizontaler Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Mindestens ein Task anlegen, damit die Tab-Ansicht (inkl. Dashboard-Tab) erscheint.
		await page.goto('/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #390 Kachel-Test' } });

		await page.reload();
		await waitForStableView(page);

		// Zum Dashboard-Tab wechseln.
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		// Genau drei Kacheln sichtbar (Gesamt, Offen, Erledigt).
		await expect(page.locator('.dashboard-cards > li')).toHaveCount(3);

		// Keine InProcess-Akzentkachel vorhanden.
		await expect(page.locator('.dashboard-cards .dashboard-card-accent.inprocess')).toHaveCount(0);

		// Kein horizontaler Overflow bei 375 px.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});

	// Mobile-Optimierung des Dashboards: Kacheln 3er-Reihe statt 2+1-Versatz, „Was ist jetzt dran?"
	// als Panel, Gesamtguthaben mit Wert-rechts-Zeilen — alles muss bei 375 px ohne Overflow passen.
	test('AK4: gestylte Dashboard-Sektionen bei 375×812 in einer Kachelreihe, kein Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		// Ein offener Task (füllt Vorschlagsliste) und ein erledigter Task (füllt Gesamtguthaben).
		await page.goto('/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E Mobile offener Task' } });
		const doneResponse = await page.request.post('/api/v1/tasks', { data: { title: 'E2E Mobile erledigt' } });
		const doneTask = (await doneResponse.json()) as { id: number };
		await page.request.patch(`/api/v1/tasks/${doneTask.id}`, { data: { status: 'Done' } });

		await page.reload();
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
		await waitForStableView(page);

		// Alle drei Kacheln sitzen in einer Reihe (gleiche Y-Position) statt 2+1-Versatz.
		const cardTopPositions = await page
			.locator('.dashboard-cards > li')
			.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
		expect(cardTopPositions).toHaveLength(3);
		expect(new Set(cardTopPositions).size).toBe(1);

		// Vorschlagsliste und Guthaben sind gerendert und sichtbar (neu gestylte Sektionen).
		await expect(page.locator('.dashboard-suggestions .dashboard-suggestion').first()).toBeVisible();
		await expect(page.locator('[data-testid="balance-total"]')).toBeVisible();

		// Kein horizontaler Overflow bei 375 px.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally).toBe(false);
	});
});
