import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Test für #1111 — Koordinaten-Box „Gespeicherter Ortsbezug" unter dem Adressfeld (AK7).
 *
 * Gemessen wird auf dem 375px-Mobil-Viewport: Die Box muss nach der Treffer-Auswahl sichtbar
 * und **vollständig im Viewport** sein — Bounding-Box statt `scrollWidth`, da die App-Shell mit
 * `overflow-x: hidden` clippt und ein Überlauf sonst unsichtbar, aber die Werte abgeschnitten
 * wären. Die jsdom-Tests in `TaskForm.test.tsx` können das nicht sehen (KoliBri durch natives
 * HTML ersetzt, kein Layout). Die ARIA-Gruppierung (role="group", Name) ist auf Einheitsebene
 * genagelt; hier zusätzlich als Sichtbarkeits-Voraussetzung geprüft.
 *
 * Geocode wird per `page.route` gestubbt (Muster `issue-1061-task-address.spec.ts`) — kein
 * echter Netzcall, keine Nominatim/Photon-Abhängigkeit.
 */

const SUGGESTIONS = [
	'Musterstraße 1, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
	'Musterstraße 12, 12345 Musterstadt, Landkreis Musterhausen, Brandenburg, Deutschland',
].map((address, index) => ({ address, lat: 52.5 + index / 100, lon: 13.4 + index / 100 }));

test.describe('#1111 Koordinaten-Box „Gespeicherter Ortsbezug"', () => {
	test('375px: Box mit den gewählten Koordinaten bleibt vollständig im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.route('**/api/v1/geocode-search*', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(SUGGESTIONS),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		await waitForStableView(page);

		const addressInput = page.getByLabel('Adresse (optional)');
		await expect(addressInput).toBeVisible();

		await addressInput.fill('Musterstraße 1');
		const firstOption = page.getByRole('option', { name: /Musterstraße 1, 12345/i }).first();
		await expect(firstOption).toBeVisible({ timeout: 5000 });
		await firstOption.click();

		const box = page.getByRole('group', { name: 'Gespeicherter Ortsbezug' });
		await expect(box).toBeVisible();
		await expect(box).toContainText(/breitengrad/i);
		await expect(box).toContainText(/längengrad/i);
		// Aufgelöste Adresse des Treffers, nicht der getippte Suchtext.
		await expect(box).toContainText('Musterstraße 1, 12345 Musterstadt');

		// Vollständig im Viewport (nichts geclippt) — die Werte brechen um statt abzuschneiden.
		const box2 = await box.boundingBox();
		expect(box2).not.toBeNull();
		expect(box2!.x).toBeGreaterThanOrEqual(0);
		expect(box2!.x + box2!.width).toBeLessThanOrEqual(375);
	});
});
