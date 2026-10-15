import { expect, test } from './fixtures';
import { openAccordionSection, waitForStableView, MOBILE } from './helpers';

/**
 * E2E-Layout-Tests für #727 „Range-Inputs bei schmalen Bildschirmen übereinander anzeigen".
 *
 * Anordnung seit #2525 (Fixup PR #2577, Runde 3): Die Priorität liegt als eigene Zeile unter
 * dem Titel der Basisangaben (#761 AK1: das Titelfeld füllt seine Zeile allein), der
 * Aufwand-Slider im gefalteten Sekundär-Abschnitt „Termin & Ort“ — die Tests klappen ihn
 * vor der Prüfung auf.
 *
 * Spezifikation: docs/spec/issue-727.md. Die ursprüngliche AK3-Erwartung „nebeneinander
 * ab 769 px" hat mit den getrennten Abschnitten ihre Grundlage verloren und ist per
 * PO-Entscheid (Kreuzverhör PR #2577) ersetzt: Jedes Range-Feld füllt seine Spalte,
 * es entsteht kein horizontaler Überlauf.
 *
 * Diese Tests prüfen NICHT die Funktionalität der Range-Inputs (input-range-fields.spec.ts),
 * sondern das LAYOUT-Verhalten (Positionierung bei verschiedenen Viewports).
 */
test.describe('#727 Range-Inputs Layout über alle Viewports', () => {
	/**
	 * AK1 (Mobile) — Priorität bleibt über dem Aufwand bei ≤768px (375px).
	 * Bezug: docs/spec/issue-727.md, Schritt 1 (Mobile-Ansicht ≤768px).
	 */
	test('AK1 (Mobile): Range-Inputs sind bei 375×812 übereinander (vertikal gestapelt)', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		await page.goto('/app/');
		await waitForStableView(page);

		// Schnellerfassungs-Dialog öffnen (Button mit Plus-Icon)
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();

		// QuickCapture-Capture-Schritt überspringen, direkt zum Formular
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		// #2525: Der Aufwand-Slider liegt im gefalteten Sekundär-Abschnitt — erst aufklappen.
		await openAccordionSection(page, 'Termin & Ort');

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
	 * AK2 (Tablet) — Priorität bleibt über dem Aufwand bei ≤768px (768px).
	 * Bezug: docs/spec/issue-727.md, Schritt 1 (Mobile-Ansicht ≤768px).
	 */
	test('AK2 (Tablet): Range-Inputs sind bei 768×1024 übereinander (vertikal gestapelt)', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/app/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: /überspringen/i }).click();

		// #2525: Der Aufwand-Slider liegt im gefalteten Sekundär-Abschnitt — erst aufklappen.
		await openAccordionSection(page, 'Termin & Ort');

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
	 * AK3 (Desktop) — Ersetzt per PO-Entscheid (Kreuzverhör PR #2577): Priorität und Aufwand
	 * liegen seit #2525 in verschiedenen Abschnitten, „nebeneinander" ist gegenstandslos.
	 * Geprüft wird: Jedes Range-Feld füllt seine Spalte (volle Breite des umgebenden
	 * .range-inputs-row-Slots), kein horizontaler Überlauf bei 1024px.
	 */
	test('AK3 (Desktop): Jedes Range-Feld füllt seine Spalte, kein Überlauf (1024px)', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await page.goto('/app/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		// #2525: Der Aufwand-Slider liegt im gefalteten Sekundär-Abschnitt — erst aufklappen.
		await openAccordionSection(page, 'Termin & Ort');

		const prioritySlider = page.locator('kol-input-range').first();
		const effortSlider = page.locator('kol-input-range').nth(1);

		await expect(prioritySlider).toBeVisible();
		await expect(effortSlider).toBeVisible();

		// Spalten-Füllung: Host-Breite ≙ Container-Breite (±2px Rundungstoleranz).
		for (const slider of [prioritySlider, effortSlider]) {
			const fill = await slider.evaluate((el) => {
				const host = el.getBoundingClientRect();
				const parent = el.parentElement?.getBoundingClientRect();
				return { hostWidth: host.width, parentWidth: parent?.width ?? 0 };
			});
			expect(fill.hostWidth).toBeGreaterThanOrEqual(fill.parentWidth - 2);
		}

		// Kein horizontaler Overflow
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBe(1024);
	});

	/**
	 * AK4 (Übergänge) — Keine Layout-Breaks bei Viewport-Wechsel (375→768→1024).
	 * Bezug: docs/spec/issue-727.md, Schritt 3 (Breakpoint-Übergänge). Seit #2525 gilt
	 * übergreifend: beide Slider sichtbar (Sektion einmal aufgeklappt), die Priorität
	 * bleibt zu jedem Zeitpunkt oberhalb des Aufwands, kein horizontaler Überlauf.
	 */
	test('AK4 (Übergänge): Keine Layout-Breaks bei Resize 375→768→1024px', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		await page.goto('/app/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		// #2525: Der Aufwand-Slider liegt im gefalteten Sekundär-Abschnitt — einmal aufklappen
		// (bleibt über alle Viewport-Wechsel offen).
		await openAccordionSection(page, 'Termin & Ort');

		const prioritySlider = page.locator('kol-input-range').first();
		const effortSlider = page.locator('kol-input-range').nth(1);
		await expect(effortSlider).toBeVisible();

		const sizes = [
			[MOBILE.width, MOBILE.height],
			[768, 1024],
			[1024, 768],
		] as const;

		for (const [width, height] of sizes) {
			await page.setViewportSize({ width, height });
			await waitForStableView(page);

			const priorityBox = await prioritySlider.boundingBox();
			const effortBox = await effortSlider.boundingBox();

			expect(priorityBox).not.toBeNull();
			expect(effortBox).not.toBeNull();
			// Getrennte Abschnitte: Priorität (Basisangaben) bleibt über dem Aufwand (Termin & Ort).
			expect(priorityBox!.y).toBeLessThan(effortBox!.y);

			// Kein Overflow bei allen Breakpoints
			const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
			const viewportWidth = await page.evaluate(() => window.innerWidth);
			expect(bodyWidth).toBe(viewportWidth); // Kein horizontaler Scroll
		}
	});
});
