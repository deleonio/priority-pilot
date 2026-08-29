import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1110 — Radius im Nearby-Card-Titel + echte Distanzen
 * (Spec docs/spec/issue-1110.md).
 *
 * - AK1: Card-Titel `In der Nähe (5 km)` mit der gespeicherten `displayDistanceKm` aus
 *   `GET /geo-config` (Default 5) — heute statisch „In der Nähe" → rot.
 * - AK2: Nach Umstellen auf 12 km in den Einstellungen zeigt die Card beim nächsten Laden
 *   `(12 km)` → rot.
 * - AK3: Ein Task exakt an der simulierten Position zeigt `(0,0 km)` — nicht `(0 km)`.
 * - AK4: Ein über die Adresssuche angelegter Task persistiert die Koordinaten des gewählten
 *   Treffers als Zahlen ≠ null und erscheint mit seiner Distanz in der Nearby-Liste.
 *
 * Wie issue-1066/issue-1098 gegen das echte Backend (Vite-Proxy); navigator.geolocation wird per
 * addInitScript gemockt (Muster issue-1098-geo-settings.spec.ts). Die Adresssuche wird per
 * `page.route` gestubbt (Muster issue-1061-task-address.spec.ts), damit der gewählte Treffer
 * eine bekannte Koordinate hat.
 *
 * Preconditions setzt jede Spec selbst: der E2E-User ist gemeinsame Infrastruktur, und Specs wie
 * issue-1098 (AK7) erhöhen die Anzeige-Entfernung, ohne sie zurückzusetzen — je nach Shard- und
 * Spec-Reihenfolge wäre der „Server-Default 5" sonst schon beim Laden dahin.
 */

const LAT = 52.5219;
const LON = 13.4132;

const GEO_INIT = (geoEnabled: boolean) => `
  (() => {
    const mock = {
      getCurrentPosition: (success) => {
        setTimeout(() => success({ coords: { latitude: ${LAT}, longitude: ${LON} }, timestamp: Date.now() }), 50);
      },
      watchPosition: () => 1,
      clearWatch: () => {},
    };
    Object.defineProperty(navigator, 'geolocation', { value: mock, writable: true });
    localStorage.setItem('pp-geolocation-enabled', String(${geoEnabled}));
  })();`;

/** Unabhängiger Haversine-Orakel (km) für die Distanz-Erwartung im Test. */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
	const R = 6371;
	const toRad = (deg: number): number => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

/** Setzt die Anzeige-Entfernung serverseitig (#1098-Schranken: Alarm 1, Intervall 5). */
const setDisplayDistance = async (page: Page, km: number): Promise<void> => {
	const response = await page.request.put('/api/v1/geo-config', {
		data: { displayDistanceKm: km, alarmDistanceKm: 1, intervalMinutes: 5 },
	});
	expect(response.ok(), 'PUT /geo-config muss gelingen').toBeTruthy();
};

/** Der Card-Titel (`_label` wird von KoliBri am Host reflektiert, Muster header-appearance.spec.ts). */
const cardTitle = (page: Page) => page.locator('kol-card[data-testid="nearby-card"]');

test.describe('Priority Pilot — #1110: Nearby-Card Radius + Distanzkette', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		// Keine Spur hinterlassen: auch der Config-Wert wird zurückgesetzt (Muster deleteAllTasks).
		await setDisplayDistance(page, 5);
	});

	test('AK1 — Card-Titel nennt die gespeicherte Anzeige-Entfernung: „In der Nähe (5 km)"', async ({ page }) => {
		await page.addInitScript(GEO_INIT(true));
		await setDisplayDistance(page, 5);
		await page.goto('/');
		await waitForStableView(page);

		await expect(cardTitle(page)).toHaveAttribute('_label', 'In der Nähe (5 km)');
	});

	test('AK2 — nach Umstellen auf 12 km zeigt die Card beim nächsten Laden „(12 km)"', async ({ page }) => {
		await page.addInitScript(GEO_INIT(true));
		await setDisplayDistance(page, 5);
		await page.goto('/');
		await waitForStableView(page);
		await expect(cardTitle(page)).toHaveAttribute('_label', 'In der Nähe (5 km)');

		await setDisplayDistance(page, 12);
		await page.reload();
		await waitForStableView(page);

		await expect(cardTitle(page)).toHaveAttribute('_label', 'In der Nähe (12 km)');
	});

	test('AK3 — Task exakt an der Position zeigt „(0,0 km)"', async ({ page }) => {
		await page.addInitScript(GEO_INIT(true));
		await setDisplayDistance(page, 5);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E 1110 exakt', latitude: LAT, longitude: LON } });
		await page.goto('/');
		await waitForStableView(page);

		const items = page.getByTestId('nearby-item');
		await expect(items).toHaveCount(1, { timeout: 5000 });
		await expect(items.first()).toHaveText(/E2E 1110 exakt/);
		// Deutsch mit einer Nachkommastelle — „(0 km)" ohne Nachkommastelle wäre ein Formatbruch.
		await expect(items.first()).toHaveText(/\(0,0 km\)/);
	});

	test('AK4 — Adresssuche-Task: Koordinaten als Zahlen persistiert, erscheint mit Distanz', async ({ page }) => {
		// Gewählter Treffer ~2,4 km von der simulierten Position (Reihenfolge wie #1061: lat, lon).
		const SUGGESTION = { address: 'Musterstraße 1, 12345 Musterstadt, Deutschland', lat: LAT + 0.0216, lon: LON };
		await page.route('**/api/v1/geocode-search*', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SUGGESTION]) }),
		);

		await page.addInitScript(GEO_INIT(true));
		await setDisplayDistance(page, 5);
		await page.goto('/');
		await waitForStableView(page);

		// Task über die Adresssuche anlegen (QuickCapture-Schritt überspringen, Muster #1061).
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await page.getByRole('button', { name: /überspringen/i }).click();
		const addressInput = page.getByLabel('Adresse (optional)');
		await expect(addressInput).toBeVisible();
		await addressInput.fill('Musterstraße 1');
		await page
			.getByRole('option', { name: /Musterstraße 1/ })
			.first()
			.click();
		await page.getByRole('textbox', { name: 'Titel' }).fill('E2E 1110 Adress-Task');
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
		await waitForStableView(page);

		// Persistenz: lat/lon liegen als Zahlen ≠ null vor — exakt die Koordinaten des Treffers.
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as {
			title: string;
			latitude: number | null;
			longitude: number | null;
		}[];
		const created = tasks.find((t) => t.title === 'E2E 1110 Adress-Task');
		expect(created, 'Adress-Task ist gespeichert').toBeTruthy();
		expect(created!.latitude, 'latitude ist eine Zahl ≠ null').toBe(SUGGESTION.lat);
		expect(created!.longitude, 'longitude ist eine Zahl ≠ null').toBe(SUGGESTION.lon);

		// Die Nearby-Liste zeigt den Task mit der Haversine-Distanz des Treffers — nicht „(0 km)".
		const items = page.getByTestId('nearby-item');
		await expect(items).toHaveCount(1, { timeout: 5000 });
		const text = (await items.first().textContent()) ?? '';
		expect(text).toContain('E2E 1110 Adress-Task');
		const expected = haversineKm(LAT, LON, SUGGESTION.lat, SUGGESTION.lon).toFixed(1).replace('.', ',');
		expect(text).toContain(`(${expected} km)`);
	});
});
