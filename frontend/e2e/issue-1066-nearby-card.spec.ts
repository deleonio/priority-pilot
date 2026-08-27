import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1066 „Dashboard-Card „In der Nähe““ (Spec docs/spec/issue-1066.md).
 *
 * Vertrag: Das Dashboard zeigt unter „Was ist jetzt dran?“ die Card „In der Nähe“ (max. 10 offene
 * Tasks aufsteigend nach Geo-Distanz, Distanz in km mit einer Nachkommastelle). Die Card kennt
 * vier gestaltete Zustände (KI-UX, Regel 7): Erfolg, Leer (AK9), Browser verweigert (AK4) und
 * Präferenz aus (AK8) — alles Text-Zustände, kein Fehlerzustand. Test-Anker sind die
 * `data-testid`s `nearby-card` / `nearby-item` / `nearby-empty` / `nearby-denied` /
 * `nearby-preference-off`.
 *
 * Wie crud.spec.ts laufen diese Specs gegen das echte Backend (In-Memory-DB, Vite-Proxy); Tasks
 * werden direkt über die API angelegt (Koordinaten setzt #1066 erst — Rot-Grund) und abgeräumt.
 * navigator.geolocation wird per addInitScript gemockt (Muster geolocation.spec.ts).
 */

const GEO_INIT = (permission: 'granted' | 'denied', geoEnabled: boolean) => `
  (() => {
    window.__geoCalls = 0;
    const mock = {
      getCurrentPosition: (success, error) => {
        window.__geoCalls += 1;
        if (${permission === 'granted'}) {
          setTimeout(() => success({ coords: { latitude: 52.5219, longitude: 13.4132 }, timestamp: Date.now() }), 50);
        } else {
          setTimeout(() => error({ code: 1, message: 'Permission denied' }), 50);
        }
      },
      watchPosition: () => 1,
      clearWatch: () => {},
    };
    Object.defineProperty(navigator, 'geolocation', { value: mock, writable: true });
    localStorage.setItem('pp-geolocation-enabled', String(${geoEnabled}));
  })();`;

/** Legt einen Task optional mit Koordinaten über die echte API an; gibt die `id` zurück. */
const createTaskViaApi = async (
	page: Page,
	title: string,
	coords?: { latitude: number; longitude: number },
): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title, ...(coords ?? {}) },
	});
	expect(response.ok()).toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	for (const task of (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

test.describe('Priority Pilot — #1066: Dashboard-Card „In der Nähe“', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK8 — Präferenz aus (Default): Hinweis statt Positionsabholung', async ({ page }) => {
		await page.addInitScript(GEO_INIT('granted', false));
		await page.goto('/');
		await waitForStableView(page);

		const hint = page.getByTestId('nearby-preference-off');
		await expect(hint).toBeVisible({ timeout: 5000 });
		const hint2 = await hint.textContent();
		expect(hint2?.toLowerCase()).toContain('einstellung');
		const calls = await page.evaluate(() => (window as { __geoCalls?: number }).__geoCalls);
		expect(calls, 'Präferenz aus → keine Positionsabholung').toBe(0);
	});

	test('AK4 — Browser verweigert Freigabe: Hinweis, Rest-Dashboard voll nutzbar', async ({ page }) => {
		await page.addInitScript(GEO_INIT('denied', true));
		await page.goto('/');
		await waitForStableView(page);

		const denied = page.getByTestId('nearby-denied');
		await expect(denied).toBeVisible({ timeout: 5000 });
		// Rest-Dashboard bleibt unbeeinträchtigt
		await expect(page.getByRole('region', { name: /jetzt dran|nächste aufgabe/i })).toBeVisible();
	});

	test('AK9 — keine Tasks mit Koordinaten: klare Leer-Aussage statt Fehler', async ({ page }) => {
		await page.addInitScript(GEO_INIT('granted', true));
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByTestId('nearby-empty')).toBeVisible({ timeout: 5000 });
		await expect(page.getByTestId('nearby-item')).toHaveCount(0);
	});

	test('AK2/AK3 — offene Tasks aufsteigend nach Distanz, Distanz in km mit einer Nachkommastelle', async ({
		page,
	}) => {
		await page.addInitScript(GEO_INIT('granted', true));
		await createTaskViaApi(page, 'E2E 1066 weit', { latitude: 53.5511, longitude: 9.9937 }); // Hamburg
		await createTaskViaApi(page, 'E2E 1066 nah', { latitude: 52.3906, longitude: 13.0645 }); // Potsdam
		await page.goto('/');
		await waitForStableView(page);

		const card = page.getByTestId('nearby-card');
		await expect(card).toBeVisible({ timeout: 5000 });
		const items = page.getByTestId('nearby-item');
		await expect(items).toHaveCount(2, { timeout: 5000 });

		const titles = await items.allTextContents();
		const indexOf = (needle: string) => titles.findIndex((t) => t.includes(needle));
		expect(indexOf('nah'), 'nächster Task zuerst').toBeLessThan(indexOf('weit'));
		for (const text of titles) {
			expect(text).toMatch(/,\d km/);
		}
	});

	test('AK5 — bei 375px kein Layoutbruch: Card und Einträge bleiben im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.addInitScript(GEO_INIT('granted', true));
		await createTaskViaApi(page, 'E2E 1066 mobil', { latitude: 52.52, longitude: 13.405 });
		await page.goto('/');
		await waitForStableView(page);

		const card = page.getByTestId('nearby-card');
		await expect(card).toBeVisible({ timeout: 5000 });
		const box = await card.boundingBox();
		expect(box, 'Card rendert messbar').not.toBeNull();
		expect(box!.x + box!.width, 'nichts ragt rechts über den 375px-Viewport hinaus').toBeLessThanOrEqual(375);
	});

	test('AK11 — GeoBadge mit Coordinates-only: keine Rohkoordinaten im aria-label', async ({ page }) => {
		await page.route('**/api/v1/reverse-geocode*', (route) => route.fulfill({ status: 500, body: '{}' }));
		const id = await createTaskViaApi(page, 'E2E 1066 badge', { latitude: 52.5200066, longitude: 13.4049541 });
		await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
		await page.goto('/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: /erledigt/i }).click();

		const badge = page.getByTestId('geo-badge').first();
		await expect(badge).toBeVisible({ timeout: 5000 });
		const label = (await badge.getAttribute('aria-label')) ?? '';
		expect(label).not.toMatch(/52[.,]/, 'Latitude-Rohwert darf nicht im Label landen');
		expect(label).not.toMatch(/13[.,]/, 'Longitude-Rohwert darf nicht im Label landen');
	});
});
