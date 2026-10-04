import { expect, test } from './fixtures';
import { waitForStableBox } from './helpers';

/**
 * Rote Spec-e2e für #2015 — „Einstellungen: zweite Ebene ausschließlich Details-Blöcke“
 * (Spec docs/spec/issue-2015.md, AK4/TF4).
 *
 * Ein geöffnetes KolDetails zweiter Ebene („Reichweite und Intervall“ im Tab „Standort“) ist
 * ein Block über die volle Zeilenbreite: bei 375 px entspricht seine Bounding-Box der
 * Panel-Breite. Bounding-Box-Assert statt scrollWidth — die App-Shell clippt
 * overflow-x:hidden, ein Scroll-Überhang wäre dort unsichtbar.
 *
 * Gegen das echte Backend (Vite-Proxy, Muster issue-1098-geo-settings.spec.ts); Expertenmodus
 * und Standorterfassung kommen per localStorage-Seed vor dem Seitenaufbau (#1984/#1098).
 */
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Balamentum — #2015: Details-Blöcke über die volle Zeilenbreite', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('pp-expert-mode', 'true');
			localStorage.setItem('pp-geolocation-enabled', 'true');
		});
	});

	test('AK4: geöffnetes „Reichweite und Intervall“ füllt bei 375 px die Panel-Breite', async ({ page }) => {
		await page.goto('/app/settings/standort');

		// Rot heute: der Block ist noch ein eigenständiges kol-accordion, kein kol-details.
		const details = page.locator('kol-details[_label="Reichweite und Intervall"]');
		await expect(details).toBeVisible();

		const panel = page.locator('[slot="tab-3"]');
		await waitForStableBox(page, details);
		const box = (await details.boundingBox())!;
		const panelBox = (await panel.boundingBox())!;
		expect(box.width, 'Block über die volle Zeilenbreite, nicht Inhaltsbreite').toBeGreaterThanOrEqual(
			panelBox.width - 1,
		);
		expect(Math.abs(box.width - panelBox.width), 'Breite entspricht der Panel-Breite').toBeLessThanOrEqual(1);
	});
});
