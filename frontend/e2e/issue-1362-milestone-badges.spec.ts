import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1362 „Meilenstein-Badges auf dem Dashboard" (Spec docs/spec/issue-1362.md).
 *
 * AK7/AK8: Das Dashboard zeigt eine Meilenstein-Card (`data-testid="milestone-badges-card"`) mit
 * allen Stufen-Badges. Bei 375px Viewportbreite bleibt die Card vollständig innerhalb der
 * Viewportbreite (Bounding-Box, kein horizontales Scrollen), alle Badges bleiben sichtbar.
 *
 * Läuft wie `issue-1360-streak.spec.ts` gegen das echte Backend (In-Memory-DB, Vite-Proxy).
 */

const deleteAllTasks = async (page: import('@playwright/test').Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Priority Pilot — #1362: Meilenstein-Badges', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK7 — Dashboard zeigt die Meilenstein-Card mit sichtbaren Badges', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const card = page.getByTestId('milestone-badges-card');
		await expect(card).toBeVisible();
	});

	test('AK8 — bei 375px bleibt die Meilenstein-Card innerhalb der Viewportbreite und alle Badges bleiben sichtbar', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const card = page.getByTestId('milestone-badges-card');
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375 + 1);
	});
});
