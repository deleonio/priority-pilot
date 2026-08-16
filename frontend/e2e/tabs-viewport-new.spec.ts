import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #703 „Tabs bei schmalen Viewports".
 *
 * Ziel des Tickets: Tabs bleiben auch bei schmalen Viewports bedienbar, ohne Umbruch oder Überlappung.
 * Bei Platzmangel alternatives Menü (z.B. Dropdown/Stack). Konsistentes UX-Verhalten über alle Viewport-Größen.
 *
 * Diese Tests sind bewusst **rot**, bis das viewport-spezifische Tab-Verhalten implementiert ist.
 * Sie prüfen gegen die Spezifikation in docs/spec/issue-703.md.
 *
 * Bezug zu bestehenden Tests:
 * - settings-tabs.spec.ts AK5 prüft bereits Mobile-First (375px) für Settings-Tabs.
 * - Issue 703 erweitert dies auf viewport-spezifisches Verhalten (alternative Darstellung, Übergänge).
 */
test.describe('#703 Tabs bei schmalen Viewports', () => {
	/**
	 * AK1 — Mobile-Viewport (< 768px): Tabs sind bedienbar, alternatives Layout.
	 * Bezug: Spec issue-703.md → Schritte 1, Testfall 1.
	 */
	test('AK1: Tabs sind bei Mobile-Viewport (< 768px) bedienbar, alternatives Layout aktiv', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind sichtbar und bedienbar.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Kein horizontaler Überlauf.
		const overflowsHorizontally = await page.evaluate(() => {
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * AK2 — Desktop-Viewport (≥ 768px): Tabs nebeneinander, kein Umbruch.
	 * Bezug: Spec issue-703.md → Schritte 2, Testfall 2.
	 */
	test('AK2: Tabs sind bei Desktop-Viewport (≥ 768px) nebeneinander, kein Umbruch', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind nebeneinander (horizontal, keine vertikale Anordnung).
		const firstTab = page.getByRole('tab', { name: 'Allgemein', exact: true });
		const secondTab = page.getByRole('tab', { name: 'Säulen', exact: true });

		// Beide Tabs sind sichtbar.
		await expect(firstTab).toBeVisible();
		await expect(secondTab).toBeVisible();
	});

	/**
	 * AK3 — Viewport-Übergang: Nahtloser Wechsel zwischen alternativer und nebeneinander-Darstellung.
	 * Bezug: Spec issue-703.md → Schritte 3, Testfall 3.
	 */
	test('AK3: Viewport-Übergang von Mobile auf Desktop wechselt Tabs nahtlos', async ({ page }) => {
		// Start: Mobile-Viewport.
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind bedienbar (Mobile).
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();

		// Übergang zu Desktop-Viewport.
		await page.setViewportSize({ width: 768, height: 1024 });
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind weiterhin bedienbar (Desktop).
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Kein Layout-Zerbruch (kein horizontaler Überlauf).
		const overflowsHorizontally = await page.evaluate(() => {
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * AK4 — Extrem schmaler Viewport (< 320px): Tabs sind noch bedienbar.
	 * Bezug: Spec issue-703.md → Randfälle & Fehler, Zeile 1.
	 */
	test('AK4: Tabs sind bei extrem schmalem Viewport (< 320px) noch bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind sichtbar und bedienbar.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Kein horizontaler Überlauf.
		const overflowsHorizontally = await page.evaluate(() => {
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * AK5 — Viewport-Wechsel während Tab-Interaktion: Kein Layout-Zerbruch.
	 * Bezug: Spec issue-703.md → Randfälle & Fehler, Zeile 2.
	 */
	test('AK5: Viewport-Wechsel während Tab-Interaktion verursacht keinen Layout-Zerbruch', async ({ page }) => {
		// Start: Desktop-Viewport.
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Klick auf Allgemein-Tab.
		await page.getByRole('tab', { name: 'Allgemein', exact: true }).click();
		await waitForStableView(page, 'Priority Pilot');

		// Während Tab-Interaktion: Viewport schrumpfen.
		await page.setViewportSize({ width: 375, height: 812 });
		await waitForStableView(page, 'Priority Pilot');

		// Allgemein-Tab ist noch aktiv und sichtbar.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Kein Layout-Zerbruch.
		const overflowsHorizontally = await page.evaluate(() => {
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});
});
