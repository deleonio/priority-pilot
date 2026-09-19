import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1555 — „Hinweis bei stark unausgewogener Säulen-Gewichtung"
 * (Spec: docs/spec/issue-1555.md).
 *
 * Gegen das echte Backend: Default-Säulen sind ausgewogen (5 × 20 %) → kein Hinweis. Wird ein
 * Regler auf das Maximum gezogen (100 %), erscheint der Warn-Alert live; kehrt die Verteilung auf
 * Gleichverteilung zurück, verschwindet er. Speichern bleibt trotz Hinweis möglich (nicht
 * blockierend). AK5 prüft die mobile Lesbarkeit bei 375px per Bounding-Box — `scrollWidth` ist
 * unbrauchbar, da die App-Shell `overflow-x: hidden` clippt (siehe Erinnerung zu früheren Specs).
 *
 * Slider-Lokatoren sind auf `.pillar-weights-grid` gescoped: seit #1098 stehen im (mitgemounteten,
 * ausgeblendeten) Allgemein-Panel weitere Range-Regler früher in der Dokumentreihenfolge
 * (Muster crud.spec.ts:151–159).
 */
test.use({ viewport: { width: 375, height: 800 } });

test.describe('#1555 Säulen-Gewichtung: Hinweis bei Unaustariertheit', () => {
	/**
	 * AK1 + AK2 + AK5: Ausgangsverteilung ausgewogen → kein Alert; ein Reglerzug auf das Maximum
	 * (100 % > 2 × 20 %) zeigt den Warn-Alert live; Rückkehr auf Gleichverteilung entfernt ihn.
	 * Der Alert läuft bei 375px nicht horizontal aus dem Viewport.
	 */
	test('AK1+AK2+AK5: Warn-Alert schaltet live mit der Verteilung und läuft bei 375px nicht über', async ({ page }) => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const alert = page.locator('.settings-pillars kol-alert');
		await expect(alert).toHaveCount(0);

		// Erste Säule auf Maximum (`End` setzt den nativen Range-Input zuverlässig, kein `fill`).
		const sliders = page.locator('.pillar-weights-grid input[type="range"]');
		const sliderCount = await sliders.count();
		expect(sliderCount).toBeGreaterThan(1);
		await sliders.first().press('End');

		await expect(alert, 'Warn-Alert fehlt nach Reglerzug auf ungleiche Verteilung').toBeVisible();

		// AK5: Der Hinweis bleibt in der Karte lesbar — nichts ragt horizontal aus dem Viewport.
		const box = await alert.boundingBox();
		expect(box, 'Alert hat keine Bounding-Box').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		// Übergang unausgewogen → ausgewogen: alle Regler auf dasselbe Maximum (n × 100 % ≡
		// Gleichverteilung) → der Hinweis verschwindet.
		for (let index = 1; index < sliderCount; index += 1) {
			await sliders.nth(index).press('End');
		}
		await expect(alert, 'Alert verschwindet nicht bei Rückkehr zur Gleichverteilung').toHaveCount(0);
	});

	/**
	 * AK4: Trotz sichtbarem Hinweis bleibt Speichern möglich — seit #1574 über das
	 * Bestätigungs-Modal („Trotzdem speichern"); der Speicher-Fluss schließt erfolgreich ab
	 * (Karte/Ansicht verlässt den Editierzustand, Muster crud.spec.ts:161–162).
	 *
	 * Verteilung bewusst NICHT mehr per `End`/`Home` (100 % vs. 0 %): Solche Extremverteilungen
	 * blockiert #1574 (AK4) vollständig. Stattdessen unausgewogen ohne Extremanteil: erste Säule
	 * 0,2 → 0,6, übrige → 0,1 (Summe 1,0 → Normierung ist die Identität).
	 */
	test('AK4: Speichern einer ungleichen Verteilung bleibt trotz Hinweis möglich (via Bestätigung)', async ({
		page,
	}) => {
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		// Ungleich ohne Extremanteil: erste Säule 0,6 (60 % > 2 × 20 %), übrige je 0,1.
		const sliders = page.locator('.pillar-weights-grid input[type="range"]');
		const sliderCount = await sliders.count();
		for (let press = 0; press < 4; press += 1) {
			await sliders.first().press('ArrowRight');
		}
		for (let index = 1; index < sliderCount; index += 1) {
			await sliders.nth(index).press('ArrowLeft');
		}
		await expect(page.locator('.settings-pillars kol-alert')).toBeVisible();

		const save = page.locator('.settings-pillars kol-button[_label="Speichern"]');
		await expect(save).not.toHaveAttribute('_disabled', 'true');
		await save.click();

		// #1574: Bei aktiver Warnung fragt das Bestätigungs-Modal nach (Spec docs/spec/issue-1574.md).
		await page.getByRole('button', { name: 'Trotzdem speichern' }).click();

		// Erfolg des Speicherns: die Karte verlässt den Editierzustand (Heading verschwindet,
		// identisch zum Persistenz-Test in crud.spec.ts).
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden({ timeout: 10_000 });
	});
});
