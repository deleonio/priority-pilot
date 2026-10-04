import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #2011: Tag/Woche-Umschalter auf dem Dashboard eindeutiger beschriften (Spec:
 * docs/spec/issue-2011.md). Der Umschalter ist eine Radiogruppe „Heute"/„Woche" (KI-UX-Entscheidung,
 * Repo-Muster AppearanceSetting.tsx); die aktive Ansicht ist am checked-Zustand erkennbar. Der
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
	test('AK1: genau ein Umschalter „Heute"/„Woche", aktive Ansicht am checked-Zustand erkennbar', async ({ page }) => {
		await openDashboard(page);

		const freshen = page.locator('.dashboard-view-switch');
		// Genau ein Bedienelement: zwei Radio-Optionen, die alten Einzelschaltflächen sind weg.
		await expect(freshen.getByRole('radio')).toHaveCount(2);
		await expect(freshen.getByRole('button', { name: 'Tagesansicht' })).toHaveCount(0);
		await expect(freshen.getByRole('button', { name: 'Wochenansicht' })).toHaveCount(0);

		const today = freshen.getByRole('radio', { name: 'Heute', exact: true });
		const week = freshen.getByRole('radio', { name: 'Woche', exact: true });

		// Standard: Tagesansicht, „Heute" gewählt.
		await expect(today).toBeChecked();

		// Wechsel zur Wochenansicht — Zustand und Inhalt wechseln mit.
		await week.click();
		await expect(week).toBeChecked();
		await expect(today).not.toBeChecked();
		await expect(page.locator('.week-view-grid')).toBeVisible();

		// Rückwahl stellt die Tagesansicht wieder her.
		await today.click();
		await expect(today).toBeChecked();
		await expect(page.locator('.week-view-grid')).toHaveCount(0);
	});

	test('AK2: gespeicherter Link ?planview=week öffnet die Wochenansicht, ohne Parameter die Tagesansicht', async ({
		page,
	}) => {
		await page.goto('/?planview=week');
		await waitForStableView(page);
		await expect(
			page.locator('.dashboard-view-switch').getByRole('radio', { name: 'Woche', exact: true }),
		).toBeChecked();
		await expect(page.locator('.week-view-grid')).toBeVisible();

		await page.goto('/');
		await waitForStableView(page);
		await expect(
			page.locator('.dashboard-view-switch').getByRole('radio', { name: 'Heute', exact: true }),
		).toBeChecked();
		await expect(page.locator('.week-view-grid')).toHaveCount(0);
	});

	test('AK3: bei 375 px bleibt der Umschalter einzeilig ohne horizontalen Overflow', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openDashboard(page);

		const freshen = page.locator('.dashboard-view-switch');
		// Nichts ragt über den Viewport (Bounding-Box statt scrollWidth — die App-Shell clippt
		// overflow-x, Dauergedächtnis 2026-08-24).
		const box = await measureBox(page, freshen);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(375);

		// „Einzeilig": beide Optionen stehen auf gleicher Höhe (kein Umbruch der Bezeichnungen).
		const yHeute = (await measureBox(page, freshen.getByRole('radio', { name: 'Heute', exact: true }))).y;
		const yWoche = (await measureBox(page, freshen.getByRole('radio', { name: 'Woche', exact: true }))).y;
		expect(Math.abs(yHeute - yWoche)).toBeLessThan(8);
	});
});
