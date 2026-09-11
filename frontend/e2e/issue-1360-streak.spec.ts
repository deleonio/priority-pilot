import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1360 „Streak-Anzeige auf dem Dashboard" (Spec docs/spec/issue-1360.md).
 *
 * AK5/AK6: Das Dashboard zeigt eine Streak-Card (`data-testid="streak-card"`) mit dem aktuellen
 * Streak und der Bestmarke. Bei 375px Viewportbreite bleibt die Card vollständig innerhalb der
 * Viewportbreite (Bounding-Box, kein horizontales Scrollen — Muster `ai-disable.spec.ts` AK6).
 *
 * Läuft wie `issue-1066-nearby-card.spec.ts` gegen das echte Backend (In-Memory-DB, Vite-Proxy);
 * ein erledigter Task heute liefert eine deterministische Streak von 1 Tag.
 */

const completeTaskToday = async (page: import('@playwright/test').Page, title: string): Promise<void> => {
	const createRes = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(createRes.ok()).toBeTruthy();
	const task = (await createRes.json()) as { id: number };
	const doneRes = await page.request.patch(`/api/v1/tasks/${task.id}`, { data: { status: 'Done' } });
	expect(doneRes.ok()).toBeTruthy();
};

const deleteAllTasks = async (page: import('@playwright/test').Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Priority Pilot — #1360: Streak-Anzeige', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK5 — Dashboard zeigt die Streak-Card mit aktuellem Wert und Bestmarke', async ({ page }) => {
		await completeTaskToday(page, 'E2E 1360 heute erledigt');
		await page.goto('/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		await expect(streakCard).toBeVisible();
		await expect(streakCard.getByTestId('streak-best')).toBeVisible();
	});

	test('AK6 — bei 375px bleibt die Streak-Card innerhalb der Viewportbreite (kein horizontales Scrollen)', async ({
		page,
	}) => {
		await completeTaskToday(page, 'E2E 1360 mobile');
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const streakCard = page.getByTestId('streak-card');
		await expect(streakCard).toBeVisible();
		const box = await streakCard.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375 + 1);
	});
});
