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
 * - Test 3 → Spec Schritt 4 / AK4: Insets der Tabs „Säulen“/„LLM“ entsprechen unverändert dem `.settings-page`-Padding
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
	 * Ihre horizontalen Insets müssen weiterhin exakt dem computed Padding von `.settings-page`
	 * entsprechen (Spiegel: Sollwert aus der führenden Quelle `.settings-page` gelesen, nicht
	 * als Literal im Test) — der Fix darf nur auf `.settings-general` wirken.
	 */
	test('AK4: Insets der Tabs „Säulen“ und „LLM“ entsprechen unverändert dem .settings-page-Padding', async ({
		page,
	}) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const pagePadding = await page
			.locator('.settings-page')
			.first()
			.evaluate((el) => {
				const styles = window.getComputedStyle(el);
				return {
					left: parseFloat(styles.paddingLeft),
					right: parseFloat(styles.paddingRight),
				};
			});

		for (const tab of ['tab-1', 'tab-2']) {
			const trigger = page.locator('.settings-tabs').getByText(tab === 'tab-1' ? 'Säulen' : 'LLM');
			await trigger.click();

			const panel = page.locator(`[slot="${tab}"]`);
			await expect(panel).toBeVisible();

			const box = await panel.boundingBox();
			expect(box).toBeTruthy();

			const viewportWidth = page.viewportSize()?.width ?? 0;
			const leftInset = box!.x;
			const rightInset = viewportWidth - (box!.x + box!.width);

			// Insets der Tabs folgen allein dem `.settings-page`-Padding (±1px Rundung)
			expect(Math.abs(leftInset - pagePadding.left)).toBeLessThanOrEqual(1);
			expect(Math.abs(rightInset - pagePadding.right)).toBeLessThanOrEqual(1);
		}
	});
});
