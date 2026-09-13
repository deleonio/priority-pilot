import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * e2e-Spec für die Dashboard-Card „Verpasste Aufgaben" (PR #1440, Review-Finding #4).
 *
 * Der Auto-Delete-Cron lässt sich in e2e nicht deterministisch auslösen (kein manueller
 * Trigger, echter Zeitablauf nötig) — `GET /scores/missed` wird deshalb wie bei
 * #1066/AK11 per `page.route` gemockt, um Nullzustand und einen langen Titel bei 375px
 * zu prüfen (Bounding-Box, kein horizontales Scrollen).
 */

const mockMissed = (
	page: import('@playwright/test').Page,
	summary: { anzahl: number; eintraege: { taskId: number; title: string; deadline: string; verpasstAm: string }[] },
) => page.route('**/api/v1/scores/missed', (route) => route.fulfill({ status: 200, body: JSON.stringify(summary) }));

test.describe('Priority Pilot — Dashboard-Card „Verpasste Aufgaben"', () => {
	test('Nullzustand: neutraler Hinweistext statt einer Zahl', async ({ page }) => {
		await mockMissed(page, { anzahl: 0, eintraege: [] });
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByTestId('missed-tasks-zero')).toBeVisible();
		await expect(page.getByTestId('missed-tasks-count')).toHaveCount(0);
	});

	test('bei 375px bleibt die Card mit einem langen Titel innerhalb des Viewports', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockMissed(page, {
			anzahl: 1,
			eintraege: [
				{
					taskId: 1,
					title: 'EinSehrLangerTitelOhneLeerzeichenDerDieCardSprengenKoennteWennKeinUmbruchStattfindet',
					deadline: '2026-08-01T00:00:00.000Z',
					verpasstAm: '2026-08-04T00:00:00.000Z',
				},
			],
		});
		await page.goto('/');
		await waitForStableView(page);

		const card = page.getByTestId('missed-tasks-card');
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375 + 1);
	});
});
