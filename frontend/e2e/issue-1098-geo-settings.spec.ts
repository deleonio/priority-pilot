import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1098 — Geo-Einstellungen (Spec docs/spec/issue-1098.md).
 *
 * - AK4: Standort aus → das Dashboard rendert die NearbyCard gar nicht (heute: bedingungslos,
 *   mit `nearby-preference-off`-Hinweis) und die Fußzeile zeigt weder Adresse noch Koordinaten.
 * - AK6: Distanz in Klammern am Eintrag („(2,4 km)"), nur Tasks innerhalb der gespeicherten
 *   Anzeige-Entfernung (Server-Filter).
 * - AK1/AK3: Bei 375px sind die drei Regler im Settings-Tab „Allgemein" bedienbar, im Viewport
 *   und mindestens 44px hoch; bei ausgeschaltetem Standort `_disabled`.
 * - AK7: ein geänderter Wert überlebt den Reload (serverseitig pro User, kein localStorage).
 *
 * Wie issue-1066-nearby-card.spec.ts gegen das echte Backend (Vite-Proxy); navigator.geolocation
 * wird per addInitScript gemockt (Muster geolocation.spec.ts).
 */

const GEO_INIT = (geoEnabled: boolean) => `
  (() => {
    window.__geoCalls = 0;
    const mock = {
      getCurrentPosition: (success) => {
        window.__geoCalls += 1;
        setTimeout(() => success({ coords: { latitude: 52.5219, longitude: 13.4132 }, timestamp: Date.now() }), 50);
      },
      watchPosition: () => 1,
      clearWatch: () => {},
    };
    Object.defineProperty(navigator, 'geolocation', { value: mock, writable: true });
    localStorage.setItem('pp-geolocation-enabled', String(${geoEnabled}));
  })();`;

/** Legt einen Task mit Koordinaten über die echte API an (~3 km / ~26 km von Berlin). */
const createNearbyTask = async (page: Page, title: string, latitude: number, longitude: number): Promise<void> => {
	const response = await page.request.post('/api/v1/tasks', { data: { title, latitude, longitude } });
	expect(response.ok()).toBeTruthy();
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

/** Innere Range-Input eines KolInputRange anhand des Labels (Shadow-DOM, offenes Element). */
const rangeInput = (page: Page, label: string) =>
	page.locator(`kol-input-range[_label="${label}"] input[type="range"]`);

/** Standort-Switch (Rolle checkbox/switch, Muster geolocation.spec.ts). */
const geoSwitch = (page: Page) =>
	page
		.getByRole('checkbox', { name: /standort erfassen/i })
		.or(page.getByRole('switch', { name: /standort erfassen/i }));

test.describe('Priority Pilot — #1098: Geo-Einstellungen', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK4 — Standort aus: keine NearbyCard, Fußzeile ohne Adresse/Koordinaten', async ({ page }) => {
		await page.addInitScript(GEO_INIT(false));
		await page.goto('/');
		await waitForStableView(page);

		// Rot heute: die Card wird bedingungslos gerendert (mit nearby-preference-off-Hinweis).
		await expect(page.getByTestId('nearby-card')).toHaveCount(0);
		await expect(page.locator('.dashboard-nearby')).toHaveCount(0);

		const footer = page.getByRole('contentinfo');
		await expect(footer).toBeVisible();
		await expect(footer).not.toContainText('° N');
		await expect(footer).not.toContainText('° E');
	});

	test('AK6 — Standort an: Distanz in Klammern, nur Tasks innerhalb der Anzeige-Entfernung', async ({ page }) => {
		await page.addInitScript(GEO_INIT(true));
		// ~3 km (innerhalb des 5-km-Defaults) und ~26 km (außerhalb).
		await createNearbyTask(page, 'E2E 1098 nah', 52.5489, 13.4132);
		await createNearbyTask(page, 'E2E 1098 fern', 52.3906, 13.0645);
		await page.goto('/');
		await waitForStableView(page);

		const items = page.getByTestId('nearby-item');
		await expect(items).toHaveCount(1, { timeout: 5000 });
		const text = (await items.first().textContent()) ?? '';
		expect(text).toContain('E2E 1098 nah');
		// Klammer-Format, deutsch mit einer Nachkommastelle: „(2,9 km)":
		expect(text).toMatch(/\(\d+,\d km\)/);
	});

	test('AK1/AK3 — 375px: Regler bedienbar, Touch-Ziel ≥ 44px, bei Standort aus _disabled', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(GEO_INIT(false));
		await page.goto('/settings/general');
		await waitForStableView(page, 'Allgemein');

		const labels = ['Anzeige-Entfernung (km)', 'Alarm-Entfernung (km)', 'Aktualisierungsintervall (Minuten)'];
		for (const label of labels) {
			const host = page.locator(`kol-input-range[_label="${label}"]`);
			await expect(host, `${label} wird gerendert (nicht versteckt)`).toHaveCount(1);
			const box = await host.boundingBox();
			expect(box, `${label} rendert messbar`).not.toBeNull();
			// Bounding-Box statt scrollWidth (App-Shell clippt mit overflow-x:hidden):
			expect(box!.x).toBeGreaterThanOrEqual(-1);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
			expect(box!.height, `${label} Touch-Ziel ≥ 44px`).toBeGreaterThanOrEqual(44);
			// AK3: Standort aus → alle drei Felder deaktiviert, Werte bleiben sichtbar.
			await expect(host, `${label} bei Standort aus deaktiviert`).toHaveAttribute('_disabled', /.*/);
		}

		// AK3 live: Einschalten hebt die Deaktivierung auf (key-Remount-Mechanik).
		await geoSwitch(page).click();
		await expect(page.locator('kol-input-range[_label="Anzeige-Entfernung (km)"]')).not.toHaveAttribute('_disabled');
	});

	test('AK7 — geänderter Anzeige-Wert überlebt den Reload (serverseitig gespeichert)', async ({ page }) => {
		await page.addInitScript(GEO_INIT(true));
		await page.goto('/settings/general');
		await waitForStableView(page, 'Allgemein');

		const input = rangeInput(page, 'Anzeige-Entfernung (km)');
		// Pfeiltasten bewegen um genau einen Step (Muster #287): 5 km → 6 km. Kein Klick vorher —
		// der springt den Thumb auf die Klickposition (≈ Mitte der Skala) und macht den Wert davon
		// abhängig, wo der Regler im Viewport liegt.
		await input.press('ArrowRight');
		const afterChange = await input.inputValue();
		expect(Number(afterChange)).toBeGreaterThan(5);

		// Das PUT je Änderung ist Best-Effort und async: Ein sofortiger Reload bricht die
		// in-flight-Request ab und der Wert geht verloren (CI-Flake, lokal meist schnell genug).
		// Erst warten, bis der Server den neuen Wert zurückmeldet — dann ist der Reload ein
		// echter Persistenz-Beweis (AK7: serverseitig, kein localStorage).
		await expect
			.poll(
				async () => {
					const response = await page.request.get('/api/v1/geo-config');
					if (!response.ok()) return undefined;
					return ((await response.json()) as { displayDistanceKm?: number }).displayDistanceKm;
				},
				{ timeout: 10_000 },
			)
			.toBe(Number(afterChange));

		await page.reload();
		await waitForStableView(page, 'Allgemein');
		await expect(input).toHaveValue(afterChange);
	});
});
