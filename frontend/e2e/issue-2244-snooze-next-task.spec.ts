import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #2244 „Kurz zurückstellen" (docs/spec/issue-2244.md) — AK1, AK4, AK6, AK7.
 * Rot, bis der Uhr-Button in „Nächste Aufgabe" samt `POST /tasks/:id/snooze` existiert.
 */

const createTask = async (page: Page, title: string, priority: number): Promise<void> => {
	await page.request.post('/api/v1/tasks', { data: { title, priority } });
};

const openDashboard = async (page: Page): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

test.describe('#2244 „Kurz zurückstellen" in „Nächste Aufgabe"', () => {
	// Eigener Nutzer statt Pass-Through: Aufgaben anderer Specs derselben Shard würden sonst die Karte
	// belegen (Muster #1849).
	test.beforeEach(async ({ page }) => {
		await registerOwnSession(page, 'snooze-2244');
	});

	test('AK1/AK4/AK6: Klick zeigt die andere Aufgabe, danach den Leerzustand', async ({ page }) => {
		await createTask(page, 'E2E #2244 Wichtig', 5);
		await createTask(page, 'E2E #2244 Weniger wichtig', 1);
		await openDashboard(page);

		const card = page.locator('.dashboard-next-task-content');
		await expect(card).toContainText('E2E #2244 Wichtig');

		await card.getByRole('button', { name: 'Kurz zurückstellen' }).click();
		await expect(card).toContainText('E2E #2244 Weniger wichtig');
		await expect(card).not.toContainText('E2E #2244 Wichtig');

		await card.getByRole('button', { name: 'Kurz zurückstellen' }).click();
		await expect(page.locator('.dashboard-next-task-empty')).toBeVisible();
		await expect(page.locator('.dashboard-next-task-empty')).toBeFocused();
	});

	test('AK7: bei 375 px ≥ 44×44 px, per Tastatur auslösbar, Aktionszeile einzeilig ohne Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await createTask(page, 'E2E #2244 Mobil A', 5);
		await createTask(page, 'E2E #2244 Mobil B', 1);
		await openDashboard(page);

		const card = page.locator('.dashboard-next-task-content');
		const done = card.getByRole('button', { name: 'Erledigen' });
		const snooze = card.getByRole('button', { name: 'Kurz zurückstellen' });
		await expect(snooze).toBeVisible();

		const doneBox = await done.boundingBox();
		const snoozeBox = await snooze.boundingBox();
		expect(snoozeBox).not.toBeNull();
		expect(snoozeBox!.width).toBeGreaterThanOrEqual(44);
		expect(snoozeBox!.height).toBeGreaterThanOrEqual(44);
		expect(snoozeBox!.x + snoozeBox!.width).toBeLessThanOrEqual(375);
		expect(Math.abs(snoozeBox!.y - doneBox!.y), 'einzeilig neben „Erledigen"').toBeLessThan(doneBox!.height);

		await snooze.focus();
		await page.keyboard.press('Enter');
		await expect(card).toContainText('E2E #2244 Mobil B');
	});
});
