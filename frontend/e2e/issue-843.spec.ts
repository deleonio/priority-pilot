import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #843 „Settings Screen Layout" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets: Settings Screen verwendet konsistente Layout-Werte: Spacing (24dp linker Margin,
 * 16dp Section-Abstand, 12dp Element-Abstand), Alignment (alle Controls auf 24dp linker Margin),
 * Typografie (≥16sp, Farbe #616161), Icon-Größe (20×20dp mit 8dp Padding).
 *
 * Diese Tests sind bewusst **rot**, bis die Layout-Anforderungen im Produktivcode umgesetzt sind.
 * Sie prüfen reines UI-Layout gegen die Spec (docs/spec/issue-843.md) — keine API-Interaktion.
 *
 * Bezug zur Spec:
 * - Test 1 → Spec Schritt 2: Layout-Inspektion Spacing
 * - Test 2 → Spec Schritt 3: Layout-Inspektion Alignment
 * - Test 3 → Spec Schritt 4: Typografie-Inspektion
 * - Test 4 → Spec Schritt 5: Icon-Inspektion
 */

test.describe('#843 Settings Screen Layout', () => {
	/**
	 * Spec-Bezug: Schritt 2 — Layout-Inspektion: Spacing
	 * AK1 aus Spec: Settings-UI verwendet einheitliche Spacing-Werte (24dp linker Margin, 16dp Section-Abstand, 12dp Element-Abstand)
	 */
	test('AK1: Settings-UI verwendet konsistente Spacing-Werte (24dp linker Margin, 16dp Section-Abstand, 12dp Element-Abstand)', async ({
		page,
	}) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Linker Margin aller Controls ist 24dp (24px bei 96 DPI)
		const controls = page
			.getByRole('radio')
			.or(page.getByRole('switch'))
			.or(page.getByRole('button', { name: /testen/i }));
		const count = await controls.count();

		for (let i = 0; i < count; i++) {
			const control = controls.nth(i);
			const marginLeft = await control.evaluate((el) => window.getComputedStyle(el).marginLeft);
			expect(marginLeft).toBe('24px');
		}

		// Vertikale Abstände zwischen Sections messen (16dp = 16px)
		// Wir prüfen den Abstand zwischen der Theme-Selection (erstes Control) und dem nächsten Section-Header
		const themeControl = page.getByRole('radio', { name: /System|Hell|Dunkel/i }).first();
		const nextSection = page
			.getByRole('heading')
			.filter({ hasText: /^(?!Darstellung)/ })
			.first();

		const themeBox = await themeControl.boundingBox();
		const nextSectionBox = await nextSection.boundingBox();

		if (themeBox && nextSectionBox) {
			const verticalGap = nextSectionBox.y - (themeBox.y + themeBox.height);
			expect(verticalGap).toBeCloseTo(16, 1); // 16dp Toleranz ±1px für Rundung
		}

		// Vertikale Abstände zwischen Elementen innerhalb einer Section messen (12dp = 12px)
		const radioButtons = page.getByRole('radio');
		const radioButtonCount = await radioButtons.count();

		for (let i = 0; i < radioButtonCount - 1; i++) {
			const current = radioButtons.nth(i);
			const next = radioButtons.nth(i + 1);

			const currentBox = await current.boundingBox();
			const nextBox = await next.boundingBox();

			if (currentBox && nextBox) {
				const elementGap = nextBox.y - (currentBox.y + currentBox.height);
				expect(elementGap).toBeCloseTo(12, 1); // 12dp Toleranz ±1px für Rundung
			}
		}
	});

	/**
	 * Spec-Bezug: Schritt 3 — Layout-Inspektion: Alignment
	 * AK2 aus Spec: Alle Controls (Radio-Buttons, Toggles, Button) sind auf 24dp linker Margin aligned
	 */
	test('AK2: Alle Controls sind auf 24dp linker Margin aligned', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Alle Controls starten an derselben linken Position (24dp = 24px)
		const controls = page
			.getByRole('radio')
			.or(page.getByRole('switch'))
			.or(page.getByRole('button', { name: /testen/i }));
		const count = await controls.count();

		// Erste Control-Position als Referenz
		const firstControl = controls.first();
		const firstBox = await firstControl.boundingBox();
		expect(firstBox).toBeTruthy();

		const referenceLeft = firstBox!.x;

		// Alle weiteren Controls müssen dieselbe linke Position haben
		for (let i = 1; i < count; i++) {
			const control = controls.nth(i);
			const box = await control.boundingBox();
			expect(box).toBeTruthy();
			expect(box!.x).toBeCloseTo(referenceLeft, 0); // Exakt gleich, keine Rundungstoleranz
		}
	});

	/**
	 * Spec-Bezug: Schritt 4 — Typografie-Inspektion
	 * AK3 aus Spec: Deskriptiver Text hat ≥16sp Schriftgröße und Farbe #616161
	 */
	test('AK3: Deskriptiver Text hat ≥16sp Schriftgröße und Farbe #616161', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Deskriptiver Text ist typischerweise in <p>-Tags oder <div>-Elementen mit beschreibendem Text
		// Wir suchen nach Text-Elementen, die nicht Labels oder Überschriften sind
		const descriptiveTexts = page
			.locator('p, div')
			.filter({ hasNot: page.getByRole('button').or(page.getByRole('radio')).or(page.getByRole('switch')) });

		const count = await descriptiveTexts.count();

		if (count > 0) {
			for (let i = 0; i < count; i++) {
				const text = descriptiveTexts.nth(i);
				const fontSize = await text.evaluate((el) => window.getComputedStyle(el).fontSize);
				const color = await text.evaluate((el) => window.getComputedStyle(el).color);

				// Schriftgröße muss ≥16sp sein (16px bei Standard-DPI)
				const fontSizeValue = parseFloat(fontSize);
				expect(fontSizeValue).toBeGreaterThanOrEqual(16);

				// Farbe muss #616161 sein (rgb(97, 97, 97))
				const expectedColor = 'rgb(97, 97, 97)';
				expect(color).toBe(expectedColor);
			}
		}
	});

	/**
	 * Spec-Bezug: Schritt 5 — Icon-Inspektion
	 * AK4 aus Spec: Checkmark-Icon hat 20×20dp Größe mit 8dp Padding
	 */
	test('AK4: Checkmark-Icons haben 20×20dp Größe mit 8dp Padding', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Checkmark-Icons finden (typischerweise SVG mit checkmark-Klasse oder path)
		const checkmarkIcons = page.locator('svg').filter({ has: page.locator('path').or(page.locator('circle')) });

		const count = await checkmarkIcons.count();

		if (count > 0) {
			for (let i = 0; i < count; i++) {
				const icon = checkmarkIcons.nth(i);
				const iconBox = await icon.boundingBox();
				expect(iconBox).toBeTruthy();

				// Icon-Größe muss 20×20dp sein (20px bei 96 DPI)
				// Wir prüfen beide Dimensionen
				expect(iconBox!.width).toBeCloseTo(20, 1);
				expect(iconBox!.height).toBeCloseTo(20, 1);

				// Padding prüfen (8dp = 8px)
				// Das Padding ist der Abstand vom Icon-Rand zum umgebenden Container
				const padding = await icon.evaluate((el) => {
					const parent = el.parentElement;
					if (!parent) return 0;

					const iconRect = el.getBoundingClientRect();
					const parentRect = parent.getBoundingClientRect();

					const paddingLeft = iconRect.left - parentRect.left;
					const paddingRight = parentRect.right - iconRect.right;
					const paddingTop = iconRect.top - parentRect.top;
					const paddingBottom = parentRect.bottom - iconRect.bottom;

					return Math.min(paddingLeft, paddingRight, paddingTop, paddingBottom);
				});

				expect(padding).toBeGreaterThanOrEqual(8); // Mindestens 8dp Padding
			}
		}
	});
});
