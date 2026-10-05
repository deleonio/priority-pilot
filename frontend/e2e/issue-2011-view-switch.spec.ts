import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #2011: Tag/Woche-Umschalter auf dem Dashboard eindeutiger beschriften (Spec:
 * docs/spec/issue-2011.md). Der Umschalter ist ein beschrifteter Schalter „Wochenansicht" (Repo-Muster Settings-Switches);
 * die aktive Ansicht ist am checked-Zustand erkennbar. Der
 * Deep-Link-Vertrag `?planview=week` aus #1617 bleibt unverändert.
 */

/** Öffnet das Dashboard und wartet auf stabile Hydration. */
const openDashboard = async (page: Page, search = ''): Promise<void> => {
	await page.goto(`/${search}`);
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

/**
 * Bounding-Box mit Nachmessen (Dauergedächtnis 2026-09-14): `boundingBox()` misst einmalig und
 * liefert bei einem React-Re-Render im Messmoment `null` — in kurzer Schleife nachmessen.
 */
const measureBox = async (
	page: Page,
	locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> => {
	await expect(locator).toBeVisible();
	for (let attempt = 0; attempt < 30; attempt++) {
		const box = await locator.boundingBox();
		if (box !== null) {
			return box;
		}
		await page.waitForTimeout(100);
	}
	throw new Error(`boundingBox blieb null: ${locator}`);
};

test.describe('Dashboard — Tag/Woche-Umschalter (#2011)', () => {
	test('AK1: genau ein beschrifteter Schalter „Wochenansicht", Zustand am checked-Zustand erkennbar', async ({
		page,
	}) => {
		await openDashboard(page);

		const freshen = page.locator('.dashboard-view-switch');
		await expect(freshen.getByRole('checkbox')).toHaveCount(1);
		await expect(freshen.getByRole('button', { name: 'Tagesansicht' })).toHaveCount(0);

		const week = freshen.getByRole('checkbox', { name: 'Wochenansicht' });

		// Standard: Tagesansicht, Schalter aus.
		await expect(week).not.toBeChecked();

		await week.click();
		await expect(week).toBeChecked();
		await expect(page.locator('.week-view-grid')).toBeVisible();

		await week.click();
		await expect(week).not.toBeChecked();
		await expect(page.locator('.week-view-grid')).toHaveCount(0);
	});

	test('AK2: gespeicherter Link ?planview=week öffnet die Wochenansicht, ohne Parameter die Tagesansicht', async ({
		page,
	}) => {
		const week = page.locator('.dashboard-view-switch').getByRole('checkbox', { name: 'Wochenansicht' });

		await page.goto('/?planview=week');
		await waitForStableView(page);
		await expect(week).toBeChecked();
		await expect(page.locator('.week-view-grid')).toBeVisible();

		await page.goto('/');
		await waitForStableView(page);
		await expect(week).not.toBeChecked();
		await expect(page.locator('.week-view-grid')).toHaveCount(0);
	});

	test('AK3: bei 375 px bleibt der Umschalter ohne horizontalen Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);

		// Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x (Dauergedächtnis 2026-08-24).
		const box = await measureBox(page, page.locator('.dashboard-view-switch'));
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(375);
	});
});
