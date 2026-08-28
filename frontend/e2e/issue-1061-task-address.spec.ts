import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Layout-Tests für #1061 „Adressfeld mit Forward Geocoding im Task-Formular".
 *
 * Ziel: Die neue `KolCombobox` „Adresse (optional)" samt aufklappbarer Vorschlagsliste bricht auf
 * dem 375px-Mobil-Viewport nicht aus dem Viewport aus — Nominatim-`display_name`-Einträge sind
 * lang („Musterstraße 1, 12345 Musterstadt, Brandenburg, Deutschland") und genau der Überlauf-
 * Kandidat. Die jsdom-Tests in `TaskForm.test.tsx` können das nicht sehen: dort ist `KolCombobox`
 * durch ein natives `<input>` ersetzt, die Liste wird nie gerendert.
 *
 * Nominatim wird per `page.route` gestubbt (kein echter Netzcall, deterministisch). Gemessen wird
 * per Bounding-Box — nicht per `scrollWidth`, da die App-Shell mit `overflow-x: hidden` clippt
 * und `scrollWidth` strukturell ≤ Viewport bleibt (der Test hätte sonst keinen Biss).
 */

/** Fünf bewusst lange `display_name`-Einträge, wie Nominatim sie liefert. */
const SUGGESTIONS = [
	'Musterstraße 1, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
	'Musterstraße 12, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
	'Musterstraße 123, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
	'Musterstraße 1a, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
	'Musterstraße 1b, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
].map((address, index) => ({ address, lat: 52.5 + index / 100, lon: 13.4 + index / 100 }));

/** #1083: Photon-/Nominatim-Treffer für die Tippfehler-Query „munchen" — kein Treffer enthält den Query-Substring. */
const MUNICH_SUGGESTIONS = [
	'München Hauptbahnhof, Bahnhofplatz 1, 80331 München, Bayern, Deutschland',
	'München Ost, Orleanstraße 3, 81667 München, Bayern, Deutschland',
	'München Marienplatz, Marienplatz 1, 80331 München, Bayern, Deutschland',
].map((address, index) => ({ address, lat: 48.13 + index / 100, lon: 11.57 + index / 100 }));

/** Öffnet das TaskForm (QuickCapture-Schritt übersprungen) und liefert das Adressfeld. */
const openFormWithAddressField = async (page: Page) => {
	await page.goto('/');
	await waitForStableView(page);

	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await page.getByRole('button', { name: /überspringen/i }).click();
	await waitForStableView(page);

	const addressInput = page.getByLabel('Adresse (optional)');
	await expect(addressInput).toBeVisible();
	return addressInput;
};

test.describe('#1061 Adress-Combobox im TaskForm', () => {
	test('375px: Adressfeld bleibt im Viewport, Vorschlagsliste fließt nicht heraus', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.route('**/api/v1/geocode-search*', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(SUGGESTIONS),
			}),
		);

		const addressInput = await openFormWithAddressField(page);

		// Das Feld selbst liegt vollständig im Viewport (nichts geclippt).
		const fieldBox = await addressInput.boundingBox();
		expect(fieldBox).not.toBeNull();
		expect(fieldBox!.x).toBeGreaterThanOrEqual(0);
		expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(375);

		// Eingabe triggert (nach 400 ms Debounce) die gestubbte Suche …
		await addressInput.fill('Musterstraße 1');
		// … und die Vorschlagsliste klappt auf: erster Eintrag sichtbar und erreichbar.
		const firstOption = page.getByRole('option', { name: /Musterstraße 1, 12345/i }).first();
		await expect(firstOption).toBeVisible({ timeout: 5000 });

		// Auch die geöffnete Liste mit den langen Einträgen läuft nicht horizontal aus dem Viewport.
		const optionBox = await firstOption.boundingBox();
		expect(optionBox).not.toBeNull();
		expect(optionBox!.x).toBeGreaterThanOrEqual(0);
		expect(optionBox!.x + optionBox!.width).toBeLessThanOrEqual(375);
	});

	// #1083: Die eigene Vorschlagsliste zeigt ALLE Server-Treffer — KolCombobox filtert intern per
	// `includes`, deshalb bleibt „munchen" (kein Substring der München-Treffer) heute leer. Die
	// Liste muss als In-Flow-Block unter dem Feld im Viewport bleiben (#1061-Messmethode).
	test('375px: fuzzy „munchen" zeigt alle Server-Treffer ohne Substring-Gate, Liste bleibt im Viewport', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.route('**/api/v1/geocode-search*', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(MUNICH_SUGGESTIONS),
			}),
		);

		const addressInput = await openFormWithAddressField(page);
		// „munchen" ist in keinem der Treffer-Strings enthalten — ein clientseitiges Substring-Gate
		// würde die Liste leer lassen (rot bis die eigene Liste steht).
		await addressInput.fill('munchen');

		const options = page.getByRole('option');
		await expect(options).toHaveCount(MUNICH_SUGGESTIONS.length, { timeout: 5000 });

		for (let index = 0; index < MUNICH_SUGGESTIONS.length; index += 1) {
			const option = options.nth(index);
			await expect(option).toBeVisible();
			const box = await option.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
			// Touch-Ziel (mobile-ui-rules Regel 2): ganze Zeile klickbar, mindestens 44 px hoch.
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});
});
