import { expect, test } from './fixtures';
import { waitForStableBox } from './helpers';

/**
 * Rote Spec-e2e für #2015 — „Einstellungen: zweite Ebene ausschließlich Details-Blöcke“
 * (Spec docs/spec/issue-2015.md, AK4/TF4).
 *
 * Ein geöffnetes KolAccordion („Reichweite und Intervall“ im Tab „Ortung“) ist
 * ein Block über die volle Zeilenbreite: bei 375 px entspricht seine Bounding-Box der
 * vollen Zeilenbreite der Details-Blöcke. Bounding-Box-Assert statt scrollWidth — die
 * App-Shell clippt
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

	test('AK4: geöffnetes „Reichweite und Intervall“ füllt bei 375 px die volle Zeilenbreite', async ({ page }) => {
		await page.goto('/app/settings/ortung');

		const details = page.locator('kol-accordion[_label="Reichweite und Intervall"]');
		await expect(details).toBeVisible();

		// KoliBri-KolTabs benennt die Slot-Attribute seiner Light-DOM-Kinder zur Laufzeit um
		// („tab-3“ → „tabpanel-slot-3“, vgl. MEMORY 2026-08-23) — deshalb der Laufzeit-Slot.
		const panel = page.locator('[slot="tabpanel-slot-3"]');
		await waitForStableBox(page, details);
		const box = (await details.boundingBox())!;
		// Das Akkordeon liegt als Geschwister unter der Karte „Standorterfassung“: gleiche Breite und Kante.
		const cardBox = (await panel.locator('kol-card').first().boundingBox())!;
		expect(Math.abs(box.width - cardBox.width), 'Akkordeon so breit wie die Karte').toBeLessThanOrEqual(1);
		expect(Math.abs(box.x - cardBox.x), 'Akkordeon bündig mit der Karte').toBeLessThanOrEqual(1);
	});
});
