import { expect, test } from './fixtures';
import { registerOwnSession, setEqualPillarWeights, waitForStableView } from './helpers';

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
 * #1573-Test-Pflege: Der Alert-Locator ist auf `_type="warning"` gescoped, seit der Info-Alert
 * „Feste Säulen" (SettingsPage.tsx) im selben Panel steht und `kol-alert` allein zwei Treffer
 * liefert (Strict Mode). Slider-Lokatoren sind auf `.pillar-weights-grid` gescoped: seit #1098 stehen im (mitgemounteten,
 * ausgeblendeten) Allgemein-Panel weitere Range-Regler früher in der Dokumentreihenfolge
 * (Muster crud.spec.ts:151–159).
 */
test.use({ viewport: { width: 375, height: 800 } });

test.describe('#1555 Säulen-Gewichtung: Hinweis bei Unaustariertheit', () => {
	// #1573-Test-Pflege: Beide Tests setzen GENAU FÜNF Säulen voraus. Ohne eigene Session liefert
	// `GET /pillars` den ganzen Säulen-Bestand der Shard-DB — Begründung siehe `registerOwnSession`.
	test.beforeEach(async ({ page }) => {
		await registerOwnSession(page, '1555');
	});

	/**
	 * AK1 + AK2 + AK5: Ausgangsverteilung ausgewogen → kein Alert; ein Reglerzug auf das Maximum
	 * (100 % > 2 × 20 %) zeigt den Warn-Alert live; Rückkehr auf Gleichverteilung entfernt ihn.
	 * Der Alert läuft bei 375px nicht horizontal aus dem Viewport.
	 */
	test('AK1+AK2+AK5: Warn-Alert schaltet live mit der Verteilung und läuft bei 375px nicht über', async ({ page }) => {
		// #1574: Ausgangszustand Gleichverteilung deterministisch herstellen (parallele Specs im
		// Shard teilen die DB) — der Test assertiert „kein Alert bei Start".
		await setEqualPillarWeights(page);
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		const alert = page.locator('.settings-pillars kol-alert[_type="warning"]');
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

		// TEST-PFLEGE #1596: Die Gegenrichtung (zurück zur Gleichverteilung lässt den Hinweis wieder
		// verschwinden) prüft der Komponententest `SettingsPage.test.tsx` (#1555 AK2) — mit
		// gekoppelten Reglern braucht sie exakte Zwischenwerte, die sich per Tastatur nur über
		// viele Einzelschritte herstellen lassen.
	});

	/**
	 * AK4: Trotz sichtbarem Hinweis bleibt Speichern möglich — seit #1574 über das
	 * Bestätigungs-Modal („Trotzdem speichern"); der Speicher-Fluss schließt erfolgreich ab
	 * (Karte/Ansicht verlässt den Editierzustand, Muster crud.spec.ts:161–162).
	 *
	 * TEST-PFLEGE #1596: `End` auf dem ersten Regler ergibt 80 % (die übrigen stehen dann am
	 * Mindestanteil 5 %) — unausgewogen, aber ohne Extremanteil; 0 %/100 % sind nicht mehr
	 * einstellbar.
	 */
	test('AK4: Speichern einer ungleichen Verteilung bleibt trotz Hinweis möglich (via Bestätigung)', async ({
		page,
	}) => {
		// #1574: Regler-Flow geht von 5 × 20 % aus — Gleichverteilung aktiv
		// herstellen, parallele Specs im Shard können eine andere Verteilung hinterlassen haben.
		await setEqualPillarWeights(page);
		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		// Ungleich ohne Extremanteil: erste Säule auf 80 % (> 2 × 20 %), übrige je 5 %.
		const sliders = page.locator('.pillar-weights-grid input[type="range"]');
		expect(await sliders.count()).toBeGreaterThan(1);
		await sliders.first().press('End');
		await expect(page.locator('.settings-pillars kol-alert[_type="warning"]')).toBeVisible();

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
