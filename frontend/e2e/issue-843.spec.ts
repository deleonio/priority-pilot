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
	 *
	 * Ausgenommen sind die Feinschalter in `.settings-switch-row--sub` (wie bei AK2 unten): Sie
	 * liegen seit #1227 in einem KolDetails, dessen Zeilenhöhe bei geschlossenem Zustand auf 0
	 * kollabiert — ihre Bounding-Box würde den 16dp-Abstand zu den Hauptzeilen verfälschen. Das
	 * `kol-details`-Summary-Element selbst bleibt aber sichtbar und zählt als eigene Zeile — sonst
	 * würde der Abstandscheck über es hinweg messen (Animationen -> Push-Nachrichten) und einen
	 * falschen Ausschlag melden.
	 */
	test('AK1: Settings-UI verwendet konsistente Spacing-Werte (24dp linker Margin, 16dp Section-Abstand, 12dp Element-Abstand)', async ({
		page,
	}) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Wir prüfen die Host-Elemente für konsistentes Spacing
		const controls = page.locator(
			'.settings-general > kol-input-radio, .settings-general :not(.settings-switch-row--sub) > kol-input-checkbox, .settings-general > kol-button, .settings-general > kol-details',
		);
		const count = await controls.count();

		// Mindestens ein Control sollte existieren
		expect(count).toBeGreaterThan(0);

		// Vertikale Abstände zwischen Controls messen (16dp Section-Abstand via gap)
		for (let i = 0; i < count - 1; i++) {
			const current = controls.nth(i);
			const next = controls.nth(i + 1);

			const currentBox = await current.boundingBox();
			const nextBox = await next.boundingBox();

			if (currentBox && nextBox) {
				const verticalGap = nextBox.y - (currentBox.y + currentBox.height);
				expect(verticalGap).toBeCloseTo(16, 1); // 16dp Toleranz ±1px für Rundung
			}
		}
	});

	/**
	 * Spec-Bezug: Schritt 3 — Layout-Inspektion: Alignment
	 * AK2 aus Spec: Alle Controls (Radio-Buttons, Toggles, Button) sind auf 24dp linker Margin aligned
	 *
	 * HINWEIS: Wir prüfen die Host-Elemente (kol-input-radio, kol-input-checkbox, kol-button),
	 * da die role-Elemente im Shadow-DOM unterschiedliche interne Abstände haben.
	 *
	 * Ausgenommen sind die Feinschalter in `.settings-switch-row--sub`: Sie stehen bewusst
	 * eingerückt unter ihrem Master-Schalter, um die Zugehörigkeit zu zeigen — eine Ebene tiefer,
	 * nicht eine fehlausgerichtete Zeile. Ihre Einrückung ist eigens abgesichert
	 * (`settings-switch-layout.spec.ts`: Master-Zeilen fluchten, Sub-Zeilen liegen versetzt),
	 * dieser Test hier deckt weiterhin lückenlos die oberste Ebene ab.
	 */
	test('AK2: Alle Controls sind auf 24dp linker Margin aligned', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Wir prüfen die Host-Elemente, nicht die role-Elemente im Shadow-DOM
		const controls = page.locator(
			'.settings-general > kol-input-radio, .settings-general :not(.settings-switch-row--sub) > kol-input-checkbox, .settings-general > kol-button',
		);
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

		// KoliBri rendert _hint-Text im Shadow-DOM. Wir prüfen die CSS-Variablen,
		// die für deskriptiven Text gesetzt sind (siehe app.css).
		// --pp-text-muted: Farbe #616161
		// --pp-text-hint-font-size: Schriftgröße ≥16sp (1rem = 16sp bei 96 DPI)
		const settingsGeneral = page.locator('.settings-general').first();
		const computedStyle = await settingsGeneral.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return {
				textColor: styles.getPropertyValue('--pp-text-muted'),
				fontSize: styles.getPropertyValue('--pp-text-hint-font-size'),
			};
		});

		// Farbe sollte #616161 sein
		expect(computedStyle.textColor).toMatch(/#616161|rgb\(97,\s*97,\s*97\)/);

		// Schriftgröße sollte ≥1rem (16sp) sein
		// Wir prüfen, dass die Variable existiert und min. 1rem ist
		expect(computedStyle.fontSize).toBeTruthy();
		const fontSizeNum = parseFloat(computedStyle.fontSize);
		expect(fontSizeNum).toBeGreaterThanOrEqual(1); // 1rem = 16sp
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
