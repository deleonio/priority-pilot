import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1017 „Buttons ‚Push testen' + ‚Standort ermitteln' vereinheitlichen".
 *
 * Spec-Bezug: docs/spec/issue-1017.md — Erwartetes Ergebnis AK2, AK3, AK4, AK5.
 *
 * Die beiden sekundären Aktions-Buttons im Tab „Allgemein" sollen ein einheitliches responsives
 * Breiten-Layout bekommen: mobil (<768px) füllen sie die Container-Innenbreite je in eigener
 * Zeile, desktop (≥768px) sind sie inhaltsbreit linksbündig. Status quo: „Push testen" trägt
 * `.push-test-btn { align-self: flex-start }` (#932) und ist in ALLEN Viewports inhaltsbreit,
 * „Standort ermitteln" hat keine Layout-Klasse und füllt immer die volle Zeile.
 * → AK2 (Push-Button mobil) und AK3 (Geo-Button desktop) sind rot, bis die gemeinsame Regel existiert.
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

/** Öffnet `/settings/general` mit sichtbarem Push- UND Geo-Button und verifiziert die Szene. */
async function openSettingsWithBothButtons(page: import('@playwright/test').Page): Promise<void> {
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

	await page.goto('/settings/general');
	await waitForStableView(page, 'Priority Pilot');
	await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

	// Szene-Verifikation: Ohne sichtbare Buttons messen die Geometrie-Assertions über eine leere
	// Menge und blieben dauerhaft grün (All-Quantor-Falle).
	await expect(page.getByRole('button', { name: 'Push testen' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Standort ermitteln' })).toBeVisible();
}

/** Container-Geometrie aus dem gerenderten Style: Innenbreite + linker Innenrand (nicht hartkodiert). */
async function containerMetrics(
	page: import('@playwright/test').Page,
): Promise<{ innerLeft: number; innerWidth: number }> {
	return page
		.locator('.settings-general')
		.first()
		.evaluate((el) => {
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

/** Host-Buttons im „Allgemein"-Tab — bei aktiviertem Push + Geo exakt die beiden #1017-Buttons. */
const actionButtonHosts = (page: import('@playwright/test').Page) => page.locator('.settings-general > kol-button');

test.describe('#1017 Aktions-Buttons vereinheitlichen', () => {
	/**
	 * AK2 (rot): Mobil (<768px) füllen BEIDE Buttons je ≥90 % der Container-Innenbreite und liegen
	 * in getrennten Zeilen (Geo-Button beginnt unterhalb des Push-Buttons inkl. Gap).
	 */
	test('AK2: mobil (375px) füllen beide Buttons die Container-Innenbreite in getrennten Zeilen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openSettingsWithBothButtons(page);

		expect(await actionButtonHosts(page).count()).toBe(2);
		const { innerWidth } = await containerMetrics(page);
		const [pushBox, geoBox] = await Promise.all([
			actionButtonHosts(page).nth(0).boundingBox(),
			actionButtonHosts(page).nth(1).boundingBox(),
		]);
		expect(pushBox).toBeTruthy();
		expect(geoBox).toBeTruthy();

		// Beide Buttons nahe Container-Innenbreite (≥90 %) — der Push-Button ist heute
		// inhaltsbreit (`align-self: flex-start` ohne Mobile-Ausnahme) und macht den Test rot.
		expect(pushBox!.width).toBeGreaterThanOrEqual(0.9 * innerWidth);
		expect(geoBox!.width).toBeGreaterThanOrEqual(0.9 * innerWidth);

		// Getrennte Zeilen: Der Geo-Button beginnt erst NACH dem Push-Button samt Gap (>0 Abstand).
		expect(geoBox!.y).toBeGreaterThanOrEqual(pushBox!.y + pushBox!.height + 1);
	});

	/**
	 * AK3 (rot): Desktop (≥768px) sind BEIDE Buttons inhaltsbreit (<90 % Container-Innenbreite)
	 * und linksbündig am Container-Innenrand (±8px). Der Geo-Button füllt heute die volle
	 * Flex-Breite und macht den Test rot; zugleich deckt das die #932-Desktop-Bedingung (AK4).
	 */
	test('AK3: desktop (1280px) sind beide Buttons inhaltsbreit und linksbündig', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openSettingsWithBothButtons(page);

		expect(await actionButtonHosts(page).count()).toBe(2);
		const { innerLeft, innerWidth } = await containerMetrics(page);
		for (let i = 0; i < 2; i++) {
			const box = await actionButtonHosts(page).nth(i).boundingBox();
			expect(box).toBeTruthy();
			expect(box!.width).toBeLessThan(0.9 * innerWidth); // inhaltsbreit statt volle Flex-Breite
			expect(Math.abs(box!.x - innerLeft)).toBeLessThanOrEqual(8); // linksbündig am Innenrand
		}
	});

	/**
	 * AK4 (invarianter Schutz, heute grün): Die Touch-Targets beider Buttons bleiben ≥44px hoch —
	 * die Breitenschaltung darf KoliBri-Default-Paddings/Höhen nicht reduzieren und `_inline`
	 * bleibt verboten (Mobile-UI-Regel 2). Geprüft im mobil gestreckten Zustand, wo eine
	 * Höhenänderung am ehesten schleichend passiert.
	 */
	test('AK4: Touch-Target beider Buttons bleibt ≥44px hoch (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openSettingsWithBothButtons(page);

		expect(await actionButtonHosts(page).count()).toBe(2);
		for (let i = 0; i < 2; i++) {
			const box = await actionButtonHosts(page).nth(i).boundingBox();
			expect(box).toBeTruthy();
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});

	/**
	 * AK5 (Schutz): Bei 320px wird keiner der beiden Buttons horizontal geclippt
	 * (`x + width ≤ viewportWidth`). Bewusst Bounding-Box statt `scrollWidth` — die App-Shell
	 * clippt mit `overflow-x: hidden`, `scrollWidth` bliebe strukturell klein. 320px ist der
	 * Biss: Die mobile Vollbreite (AK2) könnte am schmalen Viewport überlaufen, 375px nicht.
	 */
	test('AK5: kein horizontales Clipping der Buttons bei 320px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await openSettingsWithBothButtons(page);

		expect(await actionButtonHosts(page).count()).toBe(2);
		const viewportWidth = page.viewportSize()?.width ?? 0;
		for (let i = 0; i < 2; i++) {
			const box = await actionButtonHosts(page).nth(i).boundingBox();
			expect(box).toBeTruthy();
			expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
		}
	});
});
