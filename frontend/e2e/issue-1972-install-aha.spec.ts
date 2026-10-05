import { expect, test, type Page } from './fixtures';

/**
 * Rote Spec-e2e für #1972 — Install-Aha-Gate + PWA-Grenzen-Hinweis (Spec docs/spec/issue-1972.md).
 *
 * - AK4: Bei 375px (und ergänzend 320px, KI-UX-Empfehlung) erscheint nach dem Aktivieren des
 *   Schalters „Standort erfassen“ der PWA-Grenzen-Hinweis, vollständig im Viewport — geprüft
 *   über die Bounding-Box, weil die App-Shell mit `overflow-x: hidden` clippt (Memory 2026-08-24).
 * - AK1 (e2e-Spiegel): erster Load ohne erledigte Aufgabe zeigt keinen Install-Alert.
 *
 * navigator.geolocation wird per addInitScript gemockt (Muster issue-1098-geo-settings.spec.ts,
 * geolocation.spec.ts); das echte Backend läuft (Vite-Proxy).
 */

const GEO_MOCK = `
  (() => {
    const mock = {
      getCurrentPosition: (success) => {
        setTimeout(() => success({ coords: { latitude: 52.5219, longitude: 13.4132 }, timestamp: Date.now() }), 50);
      },
      watchPosition: () => 1,
      clearWatch: () => {},
    };
    Object.defineProperty(navigator, 'geolocation', { value: mock, writable: true });
  })();`;

/** Standort-Switch (Rolle checkbox/switch, Muster geolocation.spec.ts). */
const geoSwitch = (page: Page) =>
	page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));

test.describe('Balamentum — #1972: Install-Aha-Gate + PWA-Grenzen-Hinweis', () => {
	test('AK4 — 375px: nach Aktivierung der Standorterfassung ist der Hinweis sichtbar und im Viewport', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.addInitScript(GEO_MOCK);
		await page.goto('/app/settings/ortung');
		await expect(geoSwitch(page)).toBeVisible();

		await geoSwitch(page).click();

		const hint = page.locator('kol-alert[_label="Nähe-Alarm nur bei geöffneter App"]');
		await expect(hint).toBeVisible(); // ROT: der Hinweis existiert noch nicht
		const box = await hint.boundingBox();
		expect(box, 'Hinweis hat eine Bounding-Box').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375.5);
	});

	test('AK4 — 320px: derselbe Check bei schmalen Geräten (KI-UX-Ergänzung)', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await page.addInitScript(GEO_MOCK);
		await page.goto('/app/settings/ortung');
		await expect(geoSwitch(page)).toBeVisible();

		await geoSwitch(page).click();

		const hint = page.locator('kol-alert[_label="Nähe-Alarm nur bei geöffneter App"]');
		await expect(hint).toBeVisible(); // ROT: der Hinweis existiert noch nicht
		const box = await hint.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(320.5);
	});

	test('AK1 — erster Load ohne erledigte Aufgabe zeigt keinen Install-Alert', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/app/');
		await expect(page.locator('kol-alert[_label="App installieren"]')).toHaveCount(0);
	});
});
