import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für Tab-Leisten über Viewport-Größen hinweg.
 *
 * Ursprünglich #703 „Tabs bei schmalen Viewports" (vertikales Stapeln < 768px als Mobile-First-
 * Lösung). #968 revidiert genau diese Entscheidung: Tab-Leisten sollen auch mobil **nebeneinander**
 * stehen (KoliBri-Default `row` + `flex-wrap: wrap`); bei Platzmangel sauber umgebrochen werden,
 * ohne horizontalen Seitenüberlauf. Siehe docs/spec/issue-968.md.
 *
 * Bezug zu bestehenden Tests:
 * - settings-tabs.spec.ts AK5 prüft Mobile-First (375px, kein horizontaler Scroll) — bleibt grün.
 * - Die #968-Tests AK1/AK6 sind **rot**, bis der Media-Query-Override in app.css entfernt ist.
 */
test.describe('#968/#703 Tab-Leisten über Viewports', () => {
	/**
	 * AK1 — Mobile-Viewport (< 768px): Settings-Tabs stehen nebeneinander, nicht gestapelt.
	 * Bezug: Spec issue-968.md → E1; ersetzt den #703-Check „alternatives Layout".
	 */
	test('AK1: Settings-Tabs sind bei Mobile-Viewport (375px) nebeneinander in einer Zeile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind sichtbar und bedienbar.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Nebeneinander: gleiche Zeile (y identisch), Säulen rechts von Allgemein (x aufsteigend).
		const firstTabBox = await page.getByRole('tab', { name: 'Allgemein', exact: true }).boundingBox();
		expect(firstTabBox).not.toBeNull();
		const secondTabBox = await page.getByRole('tab', { name: 'Säulen', exact: true }).boundingBox();
		expect(secondTabBox).not.toBeNull();
		expect(secondTabBox!.y).toBeCloseTo(firstTabBox!.y, 0);
		expect(secondTabBox!.x).toBeGreaterThan(firstTabBox!.x);

		// Kein horizontaler Überlauf.
		const overflowsHorizontally = await page.evaluate(() => {
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * AK6 — Mobile-Viewport (< 768px): App-Tabs (Hauptansicht) stehen nebeneinander, nicht gestapelt.
	 * Bezug: Spec issue-968.md → E2 (Dashboard/Aufgaben/Serien/Wald auf `/`).
	 */
	test('AK6: App-Tabs sind bei Mobile-Viewport (375px) nebeneinander in einer Zeile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		// Hinweis: Auf der Hauptansicht ist der App-Name bei 375px per CSS versteckt (app.css:288,
		// Banner zeigt nur das Logo-Img) — daher hier der Default-ReadyText „Dashboard".
		await waitForStableView(page);

		// Tabs sind sichtbar und bedienbar.
		await expect(page.getByRole('tab', { name: 'Dashboard', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Aufgaben', exact: true })).toBeVisible();

		// Nebeneinander: gleiche Zeile (y identisch), Aufgaben rechts von Dashboard (x aufsteigend).
		const firstTabBox = await page.getByRole('tab', { name: 'Dashboard', exact: true }).boundingBox();
		expect(firstTabBox).not.toBeNull();
		const secondTabBox = await page.getByRole('tab', { name: 'Aufgaben', exact: true }).boundingBox();
		expect(secondTabBox).not.toBeNull();
		expect(secondTabBox!.y).toBeCloseTo(firstTabBox!.y, 0);
		expect(secondTabBox!.x).toBeGreaterThan(firstTabBox!.x);

		// Kein horizontaler Überlauf — bei Platzmangel wird umgebrochen, nicht überlaufen.
		const overflowsHorizontally = await page.evaluate(() => {
			const body = document.body;
			return body.scrollWidth > window.innerWidth + 1;
		});
		expect(overflowsHorizontally).toBe(false);
	});

	/**
	 * AK2 — Desktop-Viewport (≥ 768px): Tabs nebeneinander, kein Umbruch.
	 * Bezug: Spec issue-703.md → Schritte 2, Testfall 2; deckt auch issue-968.md → E3 (Desktop unverändert).
	 */
	test('AK2: Tabs sind bei Desktop-Viewport (≥ 768px) nebeneinander, kein Umbruch', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/settings/pillars');
		await waitForStableView(page, 'Priority Pilot');

		// Tabs sind sichtbar.
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Säulen', exact: true })).toBeVisible();

		// Tabs sind nebeneinander (horizontal, keine vertikale Anordnung).
		const firstTab = page.getByRole('tab', { name: 'Allgemein', exact: true });
		const firstTabBox = await firstTab.boundingBox();
		expect(firstTabBox).not.toBeNull();
		const secondTab = page.getByRole('tab', { name: 'Säulen', exact: true });
		const secondTabBox = await secondTab.boundingBox();
		expect(secondTabBox).not.toBeNull();

		// Prüfung: Zweiter Tab ist rechts vom ersten Tab (nicht darunter).
		expect(secondTabBox!.y).toBeCloseTo(firstTabBox!.y, 0);
		expect(secondTabBox!.x).toBeGreaterThan(firstTabBox!.x);

		// Kein Umbruch (Tabs sind in einer Zeile).
		const tablist = page.getByRole('tablist').first();
		const tablistBox = await tablist.boundingBox();
		expect(tablistBox).not.toBeNull();
		expect(tablistBox!.height).toBeLessThan(firstTabBox!.height * 2);
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
