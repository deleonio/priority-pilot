import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #727 „Range-Inputs bei schmalen Bildschirmen übereinander anzeigen".
 *
 * Ziel: Range-Inputs (Priorität 1–5, Aufwand 0,1–1 Tage) werden bei ≤768px vertikal gestapelt,
 * bei >768px nebeneinander angezeigt.
 *
 * Spezifikation: docs/spec/issue-727.md
 *
 * Diese Tests sind **rot**, bis das Layout bei verschiedenen Breakpoints umgesetzt ist.
 * Sie testen NICHT die Funktionalität der Range-Inputs (bereits in input-range-fields.spec.ts),
 * sondern das LAYOUT-Verhalten (Positionierung bei verschiedenen Viewports).
 */
test.describe('#727 Range-Inputs Layout über alle Viewports', () => {
	/**
	 * AK1 (Mobile) — Range-Inputs sind übereinander bei ≤768px (375px).
	 * RED, solange die Inputs noch nebeneinander angezeigt werden.
	 * Bezug: docs/spec/issue-727.md, Schritt 1 (Mobile-Ansicht ≤768px).
	 */
	test('AK1 (Mobile): Range-Inputs sind bei 375×667 übereinander (vertikal gestapelt)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');
		await waitForStableView(page);

		// Schnellerfassungs-Dialog öffnen (Button mit Plus-Icon)
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();

		// QuickCapture-Capture-Schritt überspringen, direkt zum Formular
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		// Range-Inputs am Host lokalisieren (kein Shadow-DOM-Piercing)
		const prioritySlider = page.locator('kol-input-range').first();
		const effortSlider = page.locator('kol-input-range').nth(1);

		await expect(prioritySlider).toBeVisible();
		await expect(effortSlider).toBeVisible();

		// LAYOUT-PRÜFUNG: Y-Position von Priorität < Y-Position von Aufwand (übereinander)
		const priorityBox = await prioritySlider.boundingBox();
		const effortBox = await effortSlider.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();

		// Vertikale Anordnung: priority.y muss kleiner sein als effort.y (liegt darüber)
		expect(priorityBox!.y).toBeLessThan(effortBox!.y);

		// Zusatz: Kein horizontaler Scroll (kein Overflow)
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBe(375); // Exakte Viewport-Breite, kein Scroll
	});

	/**
	 * AK2 (Tablet) — Range-Inputs sind übereinander bei ≤768px (768px).
	 * RED, solange die Inputs noch nebeneinander angezeigt werden.
	 * Bezug: docs/spec/issue-727.md, Schritt 1 (Mobile-Ansicht ≤768px).
	 */
	test('AK2 (Tablet): Range-Inputs sind bei 768×1024 übereinander (vertikal gestapelt)', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: /überspringen/i }).click();

		const prioritySlider = page.locator('kol-input-range').first();
		const effortSlider = page.locator('kol-input-range').nth(1);

		await expect(prioritySlider).toBeVisible();
		await expect(effortSlider).toBeVisible();

		const priorityBox = await prioritySlider.boundingBox();
		const effortBox = await effortSlider.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();

		// Vertikale Anordnung auch bei 768px (Breakpoint-Grenze)
		expect(priorityBox!.y).toBeLessThan(effortBox!.y);

		// Kein horizontaler Overflow
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBe(768);
	});

	/**
	 * AK3 (Desktop) — Range-Inputs sind nebeneinander bei >768px (1024px).
	 * RED, solange die Inputs noch übereinander angezeigt werden.
	 * Bezug: docs/spec/issue-727.md, Schritt 2 (Desktop-Ansicht >768px).
	 */
	test('AK3 (Desktop): Range-Inputs sind bei 1024×768 nebeneinander (horizontal)', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		const prioritySlider = page.locator('kol-input-range').first();
		const effortSlider = page.locator('kol-input-range').nth(1);

		await expect(prioritySlider).toBeVisible();
		await expect(effortSlider).toBeVisible();

		const priorityBox = await prioritySlider.boundingBox();
		const effortBox = await effortSlider.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();

		// Horizontale Anordnung: priority.x muss kleiner sein als effort.x (nebeneinander)
		// UND ähnliche Y-Position (toleranz ±10px für gleiche Zeile)
		expect(priorityBox!.x).toBeLessThan(effortBox!.x);
		expect(Math.abs(priorityBox!.y - effortBox!.y)).toBeLessThanOrEqual(10);
	});

	/**
	 * AK4 (Übergänge) — Keine Layout-Breaks bei Viewport-Wechsel (375→768→1024).
	 * RED, wenn bei Übergängen Elemente überlappen oder Layout springt.
	 * Bezug: docs/spec/issue-727.md, Schritt 3 (Breakpoint-Übergänge).
	 */
	test('AK4 (Übergänge): Keine Layout-Breaks bei Resize 375→768→1024px', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		const prioritySlider = page.locator('kol-input-range').first();
		const effortSlider = page.locator('kol-input-range').nth(1);

		// Mobile 375px
		await page.setViewportSize({ width: 375, height: 667 });
		await waitForStableView(page);

		let priorityBox = await prioritySlider.boundingBox();
		let effortBox = await effortSlider.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();
		expect(priorityBox!.y).toBeLessThan(effortBox!.y); // Übereinander

		// Tablet 768px
		await page.setViewportSize({ width: 768, height: 1024 });
		await waitForStableView(page);

		priorityBox = await prioritySlider.boundingBox();
		effortBox = await effortSlider.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();
		expect(priorityBox!.y).toBeLessThan(effortBox!.y); // Immer noch übereinander

		// Desktop 1024px
		await page.setViewportSize({ width: 1024, height: 768 });
		await waitForStableView(page);

		priorityBox = await prioritySlider.boundingBox();
		effortBox = await effortSlider.boundingBox();

		expect(priorityBox).not.toBeNull();
		expect(effortBox).not.toBeNull();
		expect(priorityBox!.x).toBeLessThan(effortBox!.x); // Nebeneinander
		expect(Math.abs(priorityBox!.y - effortBox!.y)).toBeLessThanOrEqual(10); // Gleiche Zeile

		// Zusatz: Kein Overflow bei allen Breakpoints
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		const viewportWidth = await page.evaluate(() => window.innerWidth);
		expect(bodyWidth).toBe(viewportWidth); // Kein horizontaler Scroll
	});
});
