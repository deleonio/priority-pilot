import { test, expect } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1028 „KolAlert: leichtes Padding und abgerundete Ecken am Host".
 *
 * Spezifikation: docs/spec/issue-1028.md
 * Verbindliche Design-Entscheidung (deleonio, Issue-Kommentar 2026-08-25):
 * Radius + Padding am Light-DOM-Host, sichtbare Fläche bleibt KoliBri-intern (Shadow-DOM),
 * die #930-Transparenz-Regel (Host-Hintergrund transparent, app.css:1879–1904) bleibt unverändert.
 *
 * Testklassen (siehe Spec „Erwartetes Ergebnis"):
 * - Test 1 → AK1/AK2/AK5, ROT bis zur Umsetzung: getComputedStyle am Host liefert heute
 *   padding 0 / border-radius 0 (KoliBri-Hosts haben kein UA-Default-Padding).
 * - Test 2 → AK3, Schutz-Test (initial grün): Fallstrick ohne globales box-sizing — Padding
 *   darf die Host-Box bei 320px weder aus dem Container noch in horizontalen Scroll drücken.
 *
 * Dedup (bewusst KEINE neuen Tests für):
 * - AK4 (#930-Transparenz bleibt): issue-930-transparent-backgrounds.spec.ts sichert bereits
 *   background-color: transparent am kol-alert-Host in beiden Themes.
 * - AK3 Row-Layout (Flex-Aufteilung Desktop/Mobile): settings-switch-layout.spec.ts (#971).
 *
 * Messung ausschließlich am Host-Element (kein Shadow-DOM-Piercing, ESLint-Guard #824 /
 * docs/testing.md §3 — KoliBri black-box testen).
 */

/** Viewport-Wechsel ändert Padding/Radius nicht — aber gemessen wird deterministisch bei 1280px. */
const VIEWPORT_DESKTOP = { width: 1280, height: 900 } as const;
/** „Leicht" laut AK1: Werte innerhalb der Token-Skala 0.25–0.5rem (= 4–8px). */
const MAX_PX = 8;

/** Mockt verweigerte Mikrofon-Berechtigung (Muster aus settings-switch-layout.spec.ts, #971). */
const MIC_DENIED_INIT_SCRIPT = `
	(() => {
		if (navigator.mediaDevices) {
			navigator.mediaDevices.getUserMedia = async () => {
				throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
			};
		}
	})();
`;

/** Schalter-Locator mit Rollen-Fallback: KoliBri exponiert `switch` bzw. `checkbox` je Version. */
const switchControl = (page: import('@playwright/test').Page, name: RegExp) =>
	page.getByRole('switch', { name }).or(page.getByRole('checkbox', { name }));

/** Computed Padding/Radius am Host als px-Zahlen (parse „4px" → 4). */
const hostMetrics = (el: Element): Record<string, number> => {
	const s = window.getComputedStyle(el);
	const px = (value: string): number => Number.parseFloat(value) || 0;
	return {
		paddingTop: px(s.paddingTop),
		paddingRight: px(s.paddingRight),
		paddingBottom: px(s.paddingBottom),
		paddingLeft: px(s.paddingLeft),
		radiusTopLeft: px(s.borderTopLeftRadius),
		radiusTopRight: px(s.borderTopRightRadius),
		radiusBottomRight: px(s.borderBottomRightRadius),
		radiusBottomLeft: px(s.borderBottomLeftRadius),
	};
};

test.describe('#1028 KolAlert-Host: leichtes Padding + Radius', () => {
	/**
	 * Spec-Bezug: AK1 (Padding > 0, Radius > 0, je ≤ 8px am Host), AK2 (globale Wirkung auch im
	 * Spezial-Kontext `.settings-switch-row kol-alert`, app.css:1482 — dort gilt eigenes Flex-CSS,
	 * das Padding/Radius nicht setzt), AK5 (themenneutral: identische Werte in Dark).
	 * ROT bis Umsetzung: KoliBri-Hosts haben kein Default-Padding/-Radius → beide Messungen failen.
	 */
	test('AK1/AK2/AK5: kol-alert-Host hat leichtes Padding (>0, ≤8px) und kleinen Radius in beiden Themes', async ({
		page,
	}) => {
		await page.addInitScript(MIC_DENIED_INIT_SCRIPT);
		await page.setViewportSize(VIEWPORT_DESKTOP);
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Deterministischen Alert erzegen: Sprachaufnahme-Switch togglen → getUserMedia(NotAllowedError)
		// → micDenied-Warn-Alert in der .settings-switch-row (SettingsPage.tsx:168).
		await switchControl(page, /Sprachaufnahme automatisch starten/i).click();
		const micAlert = page.locator('kol-alert', { hasText: /Mikrofon-Zugriff verweigert/ }).first();
		await expect(micAlert).toBeVisible({ timeout: 10_000 });

		const expectLightlyPaddedAndRounded = (metrics: Record<string, number>, context: string): void => {
			for (const [property, value] of Object.entries(metrics)) {
				expect(
					value,
					`${context}: ${property} muss „leicht" sein (> 0 und ≤ ${MAX_PX}px laut AK-Token-Skala)`,
				).toBeGreaterThan(0);
				expect(value, `${context}: ${property} muss ≤ ${MAX_PX}px (0.5rem) bleiben`).toBeLessThanOrEqual(MAX_PX);
			}
		};

		// Spezial-Kontext: Alert INNERHALB der Switch-Row mit eigenem Flex-CSS (app.css:1482).
		const rowMetrics = await micAlert.evaluate(hostMetrics);
		expectLightlyPaddedAndRounded(rowMetrics, 'micDenied-Alert in .settings-switch-row');

		// AK2: Die Regel ist global — jeder ANDERE sichtbare kol-alert der Seite (z. B. der
		// pushUnsupported-Info-Alert außerhalb jeder Row, SettingsPage.tsx:198) erfüllt sie genauso.
		const allMetrics = await page.locator('kol-alert').evaluateAll(hostMetricsList);
		expect(allMetrics.length, 'mind. ein kol-alert muss im DOM sein (Guard gegen leere Messung)').toBeGreaterThan(0);
		for (const [index, metrics] of allMetrics.entries()) {
			expectLightlyPaddedAndRounded(metrics, `kol-alert #${index} der Seite`);
		}

		// AK5: Padding/Radius sind themenneutral — Theme-Wechsel darf die Werte nicht ändern.
		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		const darkMetrics = await micAlert.evaluate(hostMetrics);
		expect(darkMetrics).toEqual(rowMetrics);
	});

	/**
	 * Spec-Bezug: AK3 (Schutz-Test, initial grün) — bekannter Fallstrick: kein globales
	 * `box-sizing: border-box` in app.css; neues Padding vergrößert die Host-Box potenziell um die
	 * Padding-Werte. Bei 320px darf der Alert weder den `.settings-general`-Container noch den
	 * Viewport horizontal überschreiten, und das Dokument darf nicht horizontal scrollen.
	 */
	test('AK3: Alert-Box sprengt bei 320px weder Container noch Viewport (kein Horizontal-Scroll)', async ({ page }) => {
		await page.addInitScript(MIC_DENIED_INIT_SCRIPT);
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await switchControl(page, /Sprachaufnahme automatisch starten/i).click();
		const micAlert = page.locator('kol-alert', { hasText: /Mikrofon-Zugriff verweigert/ }).first();
		await expect(micAlert).toBeVisible({ timeout: 10_000 });

		const alertBox = await micAlert.boundingBox();
		expect(alertBox, 'Alert muss eine Bounding-Box haben').toBeTruthy();

		const container = page.locator('.settings-general').first();
		await expect(container).toBeVisible();
		const containerBox = await container.boundingBox();
		expect(containerBox, '.settings-general muss eine Bounding-Box haben').toBeTruthy();

		// Rechte Alert-Kante höchstens 1px (Rundungstoleranz) rechts der Container-Kante.
		expect(
			alertBox!.x + alertBox!.width,
			`Alert-Rechte (${alertBox!.x + alertBox!.width}px) darf Container-Rechte nicht überschreiten (${containerBox!.x + containerBox!.width}px)`,
		).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);

		// Kein horizontaler Überlauf durch die gewachsene Host-Box: Die App-Shell clippt mit
		// `overflow-x: hidden`, deshalb wäre `scrollWidth` strukturell ≤ Viewport und hätte
		// keinen Biss (Mutationsprobe, Memory 2026-08-24 „E2E/Horizontal-Overflow“). Stattdessen
		// Bounding-Box gegen den Viewport prüfen — das deckt Clip-Fälle, die ein reiner
		// Container-Vergleich (Container-Kante + Card-Padding schlucken Überlauf) nicht sieht.
		const viewportWidth = page.viewportSize()!.width;
		expect(
			alertBox!.x + alertBox!.width,
			`Alert-Rechte (${alertBox!.x + alertBox!.width}px) darf den Viewport (${viewportWidth}px) nicht überschreiten`,
		).toBeLessThanOrEqual(viewportWidth);
	});
});

/** evaluateAll-Helfer: hostMetrics auf jede Node anwenden (der Block oben hält es lesbar). */
function hostMetricsList(elements: Element[]): Record<string, number>[] {
	const px = (value: string): number => Number.parseFloat(value) || 0;
	return elements.map((el) => {
		const s = window.getComputedStyle(el);
		return {
			paddingTop: px(s.paddingTop),
			paddingRight: px(s.paddingRight),
			paddingBottom: px(s.paddingBottom),
			paddingLeft: px(s.paddingLeft),
			radiusTopLeft: px(s.borderTopLeftRadius),
			radiusTopRight: px(s.borderTopRightRadius),
			radiusBottomRight: px(s.borderBottomRightRadius),
			radiusBottomLeft: px(s.borderBottomLeftRadius),
		};
	});
}
