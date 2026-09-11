import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests (#1073): Fußzeile zeigt die lesbare Adresse statt der Koordinaten.
 * AK1: Adresse aus Reverse Geocoding wird angezeigt.
 * AK2: Ohne Adresse (null) erscheinen die Koordinaten als Fallback.
 * AK3: Separator " | " zwischen Adresse/Koordinaten und Version.
 * AK6: Mobile-First — Fußzeile bleibt bei 375px Viewport vollständig im Viewport.
 */

const ADDRESS = 'Am langen Gartenweg 123, 14476 Potsdam';
const VERSION_PATTERN = /\d+\.\d+\.\d+/;

const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, displayName: 'Test User', email: 'test@example.com' }),
		}),
	);
};

// Test-Pflege (Impl-Phase, dokumentiert im PR-Body): ohne gespeicherte Präferenz bleibt
// `enabled=false` (Default aus, #845) und der Footer rendert nie position/address.
const enableGeolocationPreference = async (page: Page): Promise<void> => {
	await page.addInitScript(() => localStorage.setItem('pp-geolocation-enabled', 'true'));
};

const mockReverseGeocode = async (page: Page, address: string | null): Promise<void> => {
	await page.route('**/reverse-geocode*', (route: Route) => {
		if (address === null) {
			return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
		}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ address }),
		});
	});
};

// Geolocation-Freigabe + gespeicherte Präferenz, damit der Footer position/address lädt
test.use({
	geolocation: { latitude: 52.52, longitude: 13.405 },
	permissions: ['geolocation'],
});

test.describe('Fußzeile: Adresse statt Koordinaten (#1073)', () => {
	test('AK1 + AK3: zeigt die Adresse, getrennt von der Version mit " | "', async ({ page }) => {
		await mockAuthenticated(page);
		await enableGeolocationPreference(page);
		await mockReverseGeocode(page, ADDRESS);
		await page.goto('/');

		const footer = page.getByRole('contentinfo');
		await expect(footer).toBeVisible();
		await expect(footer).toContainText(ADDRESS);
		await expect(footer).toContainText(VERSION_PATTERN);
		await expect(footer).toContainText(`${ADDRESS} | Version`);
		await expect(footer).not.toContainText('° N');
	});

	test('AK2 + AK3: bei ausbleibender Adresse erscheinen die Koordinaten als Fallback', async ({ page }) => {
		await mockAuthenticated(page);
		await enableGeolocationPreference(page);
		await mockReverseGeocode(page, null);
		await page.goto('/');

		const footer = page.getByRole('contentinfo');
		await expect(footer).toBeVisible();
		await expect(footer).toContainText(/52\.5200° N/);
		await expect(footer).toContainText(/13\.4050° E/);
		await expect(footer).not.toContainText(ADDRESS);
		await expect(footer).toContainText(/° E \| Version/);
	});

	test('AK6: Fußzeile bleibt bei 375px Viewport vollständig im Viewport (lange Adresse)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockAuthenticated(page);
		await enableGeolocationPreference(page);
		await mockReverseGeocode(page, ADDRESS);
		await page.goto('/');

		const footer = page.getByRole('contentinfo');
		await expect(footer).toBeVisible();
		await expect(footer).toContainText(ADDRESS);

		const box = await footer.boundingBox();
		expect(box).not.toBeNull();
		// Nichts darf seitlich aus dem Viewport laufen (scrollWidth ist wegen
		// overflow-x:hidden der App-Shell strukturell zahnlos — daher Bounding-Box).
		expect(box!.x).toBeGreaterThanOrEqual(-1);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});
});
