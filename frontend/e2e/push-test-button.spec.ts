import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #386 „Push-Test-Button mit rotierenden Zitaten" — AK1 (Button „Push testen" nur
 * bei aktivierter Push) und AK5 (Mobile-First, kein horizontales Scrollen bei 375 px).
 *
 * Der Button existiert noch nicht → der Sichtbar-Fall (AK1) ist rot, bis der Produktivcode ihn im
 * „Allgemein"-Tab der Einstellungen rendert. `/auth/me` wird durch die Fixture authentifiziert.
 *
 * Push-Aktivierung im Browser: `usePushSubscription()` meldet `enabled=true`, sobald eine aktive
 * Subscription besteht (`serviceWorker.ready` → `pushManager.getSubscription()`). Im Playwright-Browser
 * ist ohne registrierten Service Worker keine Subscription vorhanden; für den Sichtbar-Fall wird der
 * Service Worker daher über ein Init-Script durch eine Fake-Registrierung mit aktiver Subscription
 * ersetzt (läuft vor dem App-Code). Für den Nicht-Sichtbar-Fall bleibt es beim Default (keine Subscription).
 */

/** Init-Script: ersetzt `navigator.serviceWorker` durch eine Fake-Registrierung mit aktiver Subscription. */
const ACTIVE_PUSH_INIT_SCRIPT = `
	(() => {
		const fakeSubscription = {
			endpoint: 'https://push.example.com/fake-386',
			expirationTime: null,
			unsubscribe: () => Promise.resolve(true),
			toJSON: () => ({
				endpoint: 'https://push.example.com/fake-386',
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

test.describe('#386 „Push testen"-Button', () => {
	/**
	 * AK1 (rot): Bei aktivierter Push (aktive Subscription vorhanden) ist der Button „Push testen"
	 * im „Allgemein"-Tab der Einstellungen sichtbar.
	 */
	test('AK1: Button „Push testen" ist sichtbar, wenn Push aktiviert ist', async ({ page }) => {
		await page.addInitScript(ACTIVE_PUSH_INIT_SCRIPT);
		await page.route('**/push/vapid-public-key', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ publicKey: 'test-public-key' }),
			}),
		);

		await page.goto('/settings/general');
		await waitForStableView(page);
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		await expect(page.getByRole('button', { name: /Push testen/i })).toBeVisible();
	});

	/**
	 * AK1: Bei nicht konfiguriertem/nicht aktiviertem Push (kein Init-Script-Fake, VAPID-Key liefert 503)
	 * ist der Button „Push testen" NICHT sichtbar.
	 */
	test('AK1: Button „Push testen" ist nicht sichtbar, wenn Push nicht aktiviert ist', async ({ page }) => {
		await page.route('**/push/vapid-public-key', (route) =>
			route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Web-Push ist nicht konfiguriert (VAPID-Schlüssel fehlen).' }),
			}),
		);

		await page.goto('/settings/general');
		await waitForStableView(page);
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		await expect(page.getByRole('button', { name: /Push testen/i })).toHaveCount(0);
	});

	/**
	 * AK5 (Mobile-First): `/settings/general` erzeugt auf einem 375-px-Viewport kein horizontales
	 * Scrollen — auch mit dem neuen „Push testen"-Button.
	 */
	test('AK5: /settings/general erzeugt bei 375 px kein horizontales Scrollen', async ({ page }) => {
		await page.addInitScript(ACTIVE_PUSH_INIT_SCRIPT);
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/settings/general');
		await waitForStableView(page);
		await expect(page.getByRole('tab', { name: 'Allgemein', exact: true })).toHaveAttribute('aria-selected', 'true');

		const hasNoHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(hasNoHorizontalOverflow).toBe(true);
	});
});
