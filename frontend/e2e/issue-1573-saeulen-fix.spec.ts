import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-e2e für #1573 — „Säulen sind fest: CRUD sperren, Hinweis im Settings-Tab".
 *
 * Vertrag (Spec: docs/spec/issue-1573.md, AK2 + AK6):
 *  - AK2: Im Settings-Tab „Säulen" gibt es keine Anlegen-/Bearbeiten-/Löschen-Kontrollen
 *         (auch keine Anlege-CTA im Leerzustand); stattdessen einen statischen Info-Hinweis
 *         (KolAlert _type="info"), der erklärt, dass die 5 Säulen per Definition die Balance
 *         adressieren und stets gelten.
 *  - AK3: Die Gewichtsverteilung bleibt über die Regler in .pillar-weights-grid editierbar.
 *  - AK6 (Mobile, 375 px): Hinweistext und Gewichts-Regler sind ohne horizontalen Overflow
 *         benutzbar — gemessen als Bounding-Boxen der Light-DOM-Hosts, NICHT per scrollWidth
 *         (die App-Shell clippt overflow-x: hidden; Muster: issue-996-pillar-row-mobile.spec.ts).
 *
 * Ersetzt die gelöschten pillar-crud.spec.ts (#439) und pillar-dynamic-cases.spec.ts (#431),
 * die künftig verbotenes CRUD gegen das echte Backend testeten (Test-Pflege-Bedarf, Spec).
 */
test.describe('#1573 Feste Säulen im Settings-Tab (375 px)', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
	});

	/** Öffnet den Säulen-Tab und wartet auf den stabilen Zustand. */
	const openPillarTab = async (page: import('@playwright/test').Page): Promise<void> => {
		await page.goto('/app/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Balamentum');
	};

	test('AK2: Hinweistext sichtbar, keine Anlegen-/Bearbeiten-/Löschen-Kontrollen', async ({ page }) => {
		await openPillarTab(page);

		const panel = page.locator('.settings-pillars');

		// Info-Hinweis: Balance, „gelten stets", Gewichtung bleibt anpassbar.
		const hint = panel.locator('kol-alert[_type="info"]');
		await expect(hint).toBeVisible();
		await expect(hint).toContainText(/balance/i);
		await expect(hint).toContainText(/gelten stets/i);

		// Keine CRUD-Kontrollen (auch keine Leerzustands-CTA).
		await expect(panel.getByRole('button', { name: 'Neue Säule anlegen' })).toHaveCount(0);
		await expect(panel.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0);
		await expect(panel.getByRole('button', { name: 'Löschen', exact: true })).toHaveCount(0);
		await expect(panel.getByText(/noch keine säulen/i)).toHaveCount(0);
	});

	test('AK3+AK6: Gewichts-Regler vorhanden und ohne horizontalen Overflow benutzbar', async ({ page }) => {
		await openPillarTab(page);

		const panel = page.locator('.settings-pillars');

		// AK3: Die Regler der Gewichtsverteilung bleiben vorhanden und sichtbar (scoped auf
		// .pillar-weights-grid — KolTabs hält inaktive Panels gemountet, seitenweite Slider-Queries
		// träfen sonst die Geo-Regler des Allgemein-Panels zuerst, KI-UX-Block).
		const sliders = panel.locator('.pillar-weights-grid kol-input-range');
		await expect(sliders.first()).toBeVisible();

		// AK6: Bounding-Box-Assertion statt scrollWidth — kein Hinweis- oder Regler-Host ragt
		// horizontal aus dem 375-px-Viewport (Toleranz 1 px für Sub-Pixel-Rundungen).
		const viewportWidth = 375;
		for (const locator of [panel.locator('kol-alert[_type="info"]'), sliders]) {
			const count = await locator.count();
			expect(count).toBeGreaterThan(0);
			for (let i = 0; i < count; i += 1) {
				const box = await locator.nth(i).boundingBox();
				expect(box, 'Host muss eine Bounding-Box haben').not.toBeNull();
				expect(box!.x, 'linke Kante innerhalb des Viewports').toBeGreaterThanOrEqual(-1);
				expect(box!.x + box!.width, 'rechte Kante innerhalb des Viewports').toBeLessThanOrEqual(viewportWidth + 1);
			}
		}
	});
});
