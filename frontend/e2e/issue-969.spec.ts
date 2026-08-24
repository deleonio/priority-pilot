import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #969 „Padding in Einstellungen (Tab Allgemein) links größer als rechts“.
 *
 * Diese Tests sind bewusst **rot**, bis das symmetrische horizontale Padding auf
 * `.settings-general` umgesetzt ist (aktuell: `padding-left: 1.5rem` ohne rechtes
 * Gegenstück, s. app.css — links ≈ 2,5rem Einrückung, rechts 1rem).
 *
 * Bezug zur Spec (docs/spec/issue-969.md):
 * - Test 1 → Spec Schritt 2 / AK1: computed padding-left === padding-right auf `.settings-general`
 * - Test 2 → Spec Schritt 3 / AK2: linker und rechter Abstand des Contents zum Viewportrand gleich (±1px)
 * - Test 3 → Spec Schritt 4 / AK4: Insets der Tabs „Säulen“/„LLM“ entsprechen unverändert den `.settings-page`-Insets
 *
 * AK3 (#843-Regressionsschutz) ist durch die bestehende Suite `issue-843.spec.ts` gedeckt
 * und wird hier bewusst nicht dupliziert.
 */

test.describe('#969 Settings-Tab „Allgemein“: symmetrisches horizontales Padding', () => {
	/**
	 * Spec-Bezug: Schritt 2 — AK1: `.settings-general` hat identisches horizontales Padding
	 * (computed `padding-left` === `padding-right`).
	 */
	test('AK1: .settings-general hat identisches padding-left und padding-right', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const panel = page.locator('.settings-general').first();
		await expect(panel).toBeVisible();

		const paddings = await panel.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return {
				left: parseFloat(styles.paddingLeft),
				right: parseFloat(styles.paddingRight),
			};
		});

		expect(paddings.left).toBeCloseTo(paddings.right, 1); // ±0,05px Rundungstoleranz
	});

	/**
	 * Spec-Bezug: Schritt 3 — AK2: Content des Tabs „Allgemein“ hat links und rechts denselben
	 * Abstand zum Viewportrand (±1px). Gemessen an der Bounding Box des Panels, das als
	 * block-Element die volle Content-Breite von `.settings-page` einnimmt — links zählt heute
	 * das fehlende rechte Gegenstück von 1,5rem sichtbar auf.
	 */
	test('AK2: Content des Tabs „Allgemein“ schließt links und rechts gleichmäßig mit dem Viewport ab', async ({
		page,
	}) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const box = await page.locator('.settings-general').first().boundingBox();
		expect(box).toBeTruthy();

		const viewportWidth = page.viewportSize()?.width ?? 0;
		expect(viewportWidth).toBeGreaterThan(0);

		const leftInset = box!.x;
		const rightInset = viewportWidth - (box!.x + box!.width);

		expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(1); // ±1px Toleranz
	});

	/**
	 * Spec-Bezug: Schritt 4 — AK4: Tabs „Säulen“ und „LLM“ zeigen keine Layout-Änderung.
	 * Ihre horizontalen Insets müssen weiterhin exakt den Insets von `.settings-page`
	 * entsprechen (Spiegel: Sollwert aus der führenden Quelle `.settings-page` gelesen, nicht
	 * als Literal im Test) — der Fix darf nur auf `.settings-general` wirken.
	 *
	 * Test-Pflege (Umsetzungsphase, s. PR-Body „Test-Pflege-Bedarf“): Drei Selektor-/Baseline-
	 * Defekte repariert, die der Test selbst nie grün machen konnte — Assertion (±1px gegen
	 * `.settings-page`) unverändert:
	 * 1. KoliBri 4.3.0 `KolTabs` benennt die slot-Attribute der Host-Kinder zur Laufzeit um:
	 *    JSX `slot="tab-1"` → DOM `slot="tabpanel-slot-1"` (shadow.tsx, setAttribute).
	 * 2. `getByText('Säulen')` löste strict-mode violation aus (matchte zusätzlich das
	 *    Panel-Heading „Säulen-Gewichtung“) → `getByRole('tab', …)` (pierct Shadow-DOM).
	 * 3. Spiegel als Bounding-Box-Insets statt computed Padding: `.settings-page` ist
	 *    max-width 800px und zentriert — der Viewport-Inset enthält bei >832px (Playwright-
	 *    Default 1280) den Zentrier-Margin (256 statt 16). Vom Border-Box-Inset wird das
	 *    computed Padding abgezogen (Content-Box-Inset), weil die Tab-Panels im
	 *    Content-Bereich von `.settings-page` liegen.
	 */
	test('AK4: Insets der Tabs „Säulen“ und „LLM“ entsprechen unverändert den .settings-page-Insets', async ({
		page,
	}) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const pageInsets = await page
			.locator('.settings-page')
			.first()
			.evaluate((el) => {
				const box = el.getBoundingClientRect();
				const cs = window.getComputedStyle(el);
				return {
					left: box.x + parseFloat(cs.paddingLeft),
					right: window.innerWidth - box.right + parseFloat(cs.paddingRight),
				};
			});

		for (const tab of ['tabpanel-slot-1', 'tabpanel-slot-2']) {
			const label = tab === 'tabpanel-slot-1' ? 'Säulen' : 'KI-Provider';
			const trigger = page.locator('.settings-tabs').getByRole('tab', { name: label });
			await trigger.click();

			const panel = page.locator(`[slot="${tab}"]`);
			await expect(panel).toBeVisible();

			const box = await panel.boundingBox();
			expect(box).toBeTruthy();

			const viewportWidth = page.viewportSize()?.width ?? 0;
			const leftInset = box!.x;
			const rightInset = viewportWidth - (box!.x + box!.width);

			// Insets der Tabs folgen allein den `.settings-page`-Insets (±1px Rundung)
			expect(Math.abs(leftInset - pageInsets.left)).toBeLessThanOrEqual(1);
			expect(Math.abs(rightInset - pageInsets.right)).toBeLessThanOrEqual(1);
		}
	});
});
