import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #1017 „Buttons ‚Push testen' + ‚Standort ermitteln' vereinheitlichen".
 *
 * Spec-Bezug: docs/spec/issue-1017.md — Erwartetes Ergebnis AK2, AK3, AK4, AK5.
 *
 * Beide sekundären Aktions-Buttons bekommen ein einheitliches responsives Breiten-Layout:
 * mobil (<768px) füllen sie die Container-Innenbreite je in eigener Zeile, desktop (≥768px)
 * sind sie inhaltsbreit linksbündig.
 *
 * #1151: „Standort ermitteln" ist in den eigenen Tab „Standort" (`/settings/standort`, Panel
 * `.settings-geo`) umgezogen; „Push testen" bleibt im Tab „Allgemein" (`.settings-general`).
 * Die gemeinsame Zwei-Buttons-Szene existiert damit nicht mehr — jede Messung läuft im Tab des
 * jeweiligen Buttons (Split nach Tab), die AKs werden je Button geprüft.
 *
 * Gemessen wird das HOST-Element `kol-button` (Repo-Konvention wie in issue-843.spec.ts —
 * `align-self` wirkt auf den Host, nicht auf das Shadow-DOM-Innere). Die Container-Innenbreite
 * wird aus dem gerenderten Computed Style gelesen, nicht hartkodiert.
 *
 * Szene: Beide Buttons sind bedingt gerendert (`pushEnabled`/`geoEnabled`) und brauchen deshalb
 * Init-Script-Fakes — Fake-ServiceWorker mit aktiver Subscription (Muster push-test-button.spec.ts)
 * bzw. granted-Geolocation + localStorage-Wahl (Muster geolocation.spec.ts, Hook liest beim Mount).
 */

/** Init-Script: ersetzt `navigator.serviceWorker` durch eine Fake-Registrierung mit aktiver Subscription. */
const ACTIVE_PUSH_INIT_SCRIPT = `
	(() => {
		const fakeSubscription = {
			endpoint: 'https://push.example.com/fake-1017',
			expirationTime: null,
			unsubscribe: () => Promise.resolve(true),
			toJSON: () => ({
				endpoint: 'https://push.example.com/fake-1017',
				expirationTime: null,
				keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
			}),
		};
		const fakeRegistration = {
			pushManager: {
				getSubscription: () => Promise.resolve(fakeSubscription),
				subscribe: () => Promise.resolve(fakeSubscription),
			},
		};
		Object.defineProperty(navigator, 'serviceWorker', {
			configurable: true,
			get: () => ({
				ready: Promise.resolve(fakeRegistration),
				register: () => Promise.resolve(fakeRegistration),
				getRegistration: () => Promise.resolve(fakeRegistration),
				addEventListener: () => {},
			}),
		});
	})();
`;

/** Init-Script: granted-Geolocation + gespeicherte Aktivierung → `geoEnabled=true` ab Mount. */
const GEO_ENABLED_INIT_SCRIPT = `
	(() => {
		localStorage.setItem('pp-geolocation-enabled', 'true');
		const mockGeolocation = {
			getCurrentPosition: (success) => {
				setTimeout(() => {
					success({ coords: { latitude: 52.52, longitude: 13.405 }, timestamp: Date.now() });
				}, 50);
			},
			watchPosition: () => 1,
			clearWatch: () => {},
		};
		Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, writable: true });
	})();
`;

/** Routed/Faked die Szene (Push-Subscription + Geo aktiv) — nötig für BEIDE Tabs. */
async function fakeActionButtonsScene(page: import('@playwright/test').Page): Promise<void> {
	await page.addInitScript(ACTIVE_PUSH_INIT_SCRIPT);
	await page.addInitScript(GEO_ENABLED_INIT_SCRIPT);
	await page.route('**/push/vapid-public-key', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ publicKey: 'test-public-key' }),
		}),
	);
	await page.route('**/reverse-geocode*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ address: 'Musterstraße 1, 10117 Berlin' }),
		}),
	);
}

/** Öffnet den Tab „Allgemein" mit sichtbarem Push-Button und verifiziert die Szene. */
async function openGeneral(page: import('@playwright/test').Page): Promise<void> {
	await fakeActionButtonsScene(page);
	await page.goto('/settings/general');
	await waitForStableView(page, 'Priority Pilot');
	await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

	// Szene-Verifikation: Ohne sichtbaren Button messen die Geometrie-Assertions über eine leere
	// Menge und blieben dauerhaft grün (All-Quantor-Falle).
	await expect(page.getByRole('button', { name: 'Push testen' })).toBeVisible();
}

/** Öffnet den Tab „Standort" (#1151) mit sichtbarem Geo-Button und verifiziert die Szene. */
async function openStandort(page: import('@playwright/test').Page): Promise<void> {
	await fakeActionButtonsScene(page);
	await page.goto('/settings/standort');
	await waitForStableView(page, 'Priority Pilot');
	await expect(page.getByRole('tab', { name: 'Standort', exact: true })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('button', { name: 'Standort ermitteln' })).toBeVisible();
}

/** Container-Geometrie aus dem gerenderten Style: Innenbreite + linker Innenrand (nicht hartkodiert). */
async function containerMetrics(
	page: import('@playwright/test').Page,
	panelSelector: '.settings-general' | '.settings-geo',
): Promise<{ innerLeft: number; innerWidth: number }> {
	return page.locator(panelSelector).evaluate((el) => {
		const rect = el.getBoundingClientRect();
		const style = window.getComputedStyle(el);
		const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(style.paddingRight) || 0;
		return {
			innerLeft: rect.x + paddingLeft,
			innerWidth: rect.width - paddingLeft - paddingRight,
		};
	});
}

/** Host-Buttons je Tab: „Push testen" in „Allgemein", „Standort ermitteln" in „Standort" (#1151). */
const pushButtonHost = (page: import('@playwright/test').Page) => page.locator('.settings-general > kol-button');
const geoButtonHost = (page: import('@playwright/test').Page) => page.locator('.settings-geo > kol-button');

test.describe('#1017 Aktions-Buttons vereinheitlichen', () => {
	/**
	 * AK2 (rot): Mobil (<768px) füllt jeder Button ≥90 % der Container-Innenbreite. #1151: in
	 * getrennten Tabs — die frühere Zeilen-Trennung (Geo-Button unterhalb des Push-Buttons) ist
	 * durch die Tab-Trennung ersetzt und wird in settings-tabs.spec.ts (#1151 AK4) geschützt.
	 */
	test('AK2: mobil (375px) füllt jeder Button die Container-Innenbreite (je Tab)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await openGeneral(page);
		const pushBox = await pushButtonHost(page).boundingBox();
		expect(pushBox).toBeTruthy();
		const generalMetrics = await containerMetrics(page, '.settings-general');
		expect(pushBox!.width).toBeGreaterThanOrEqual(0.9 * generalMetrics.innerWidth);

		await openStandort(page);
		const geoBox = await geoButtonHost(page).boundingBox();
		expect(geoBox).toBeTruthy();
		const geoMetrics = await containerMetrics(page, '.settings-geo');
		expect(geoBox!.width).toBeGreaterThanOrEqual(0.9 * geoMetrics.innerWidth);
	});

	/**
	 * AK3 (rot): Desktop (≥768px) ist jeder Button inhaltsbreit (<90 % Container-Innenbreite)
	 * und linksbündig am Container-Innenrand (±8px) — je im eigenen Tab (#1151). Der Geo-Button
	 * füllt heute die volle Flex-Breite und macht den Test rot; zugleich deckt das die
	 * #932-Desktop-Bedingung (AK4).
	 */
	test('AK3: desktop (1280px) sind beide Buttons inhaltsbreit und linksbündig', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });

		await openGeneral(page);
		const pushBox = await pushButtonHost(page).boundingBox();
		expect(pushBox).toBeTruthy();
		const generalMetrics = await containerMetrics(page, '.settings-general');
		expect(pushBox!.width).toBeLessThan(0.9 * generalMetrics.innerWidth);
		expect(Math.abs(pushBox!.x - generalMetrics.innerLeft)).toBeLessThanOrEqual(8);

		await openStandort(page);
		const geoBox = await geoButtonHost(page).boundingBox();
		expect(geoBox).toBeTruthy();
		const geoMetrics = await containerMetrics(page, '.settings-geo');
		expect(geoBox!.width).toBeLessThan(0.9 * geoMetrics.innerWidth);
		expect(Math.abs(geoBox!.x - geoMetrics.innerLeft)).toBeLessThanOrEqual(8);
	});

	/**
	 * AK4 (invarianter Schutz, heute grün): Die Touch-Targets beider Buttons bleiben ≥44px hoch —
	 * die Breitenschaltung darf KoliBri-Default-Paddings/Höhen nicht reduzieren und `_inline`
	 * bleibt verboten (Mobile-UI-Regel 2). Geprüft im mobil gestreckten Zustand, wo eine
	 * Höhenänderung am ehesten schleichend passiert.
	 */
	test('AK4: Touch-Target beider Buttons bleibt ≥44px hoch (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await openGeneral(page);
		const pushBox = await pushButtonHost(page).boundingBox();
		expect(pushBox).toBeTruthy();
		expect(pushBox!.height).toBeGreaterThanOrEqual(44);

		await openStandort(page);
		const geoBox = await geoButtonHost(page).boundingBox();
		expect(geoBox).toBeTruthy();
		expect(geoBox!.height).toBeGreaterThanOrEqual(44);
	});

	/**
	 * AK5 (Schutz): Bei 320px wird keiner der beiden Buttons horizontal geclippt
	 * (`x + width ≤ viewportWidth`). Bewusst Bounding-Box statt `scrollWidth` — die App-Shell
	 * clippt mit `overflow-x: hidden`, `scrollWidth` bliebe strukturell klein. 320px ist der
	 * Biss: Die mobile Vollbreite (AK2) könnte am schmalen Viewport überlaufen, 375px nicht.
	 */
	test('AK5: kein horizontales Clipping der Buttons bei 320px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		const viewportWidth = page.viewportSize()?.width ?? 0;

		await openGeneral(page);
		const pushBox = await pushButtonHost(page).boundingBox();
		expect(pushBox).toBeTruthy();
		expect(pushBox!.x + pushBox!.width).toBeLessThanOrEqual(viewportWidth);

		await openStandort(page);
		const geoBox = await geoButtonHost(page).boundingBox();
		expect(geoBox).toBeTruthy();
		expect(geoBox!.x + geoBox!.width).toBeLessThanOrEqual(viewportWidth);
	});
});
