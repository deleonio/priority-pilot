import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * E2E zum Bestell-Dialog (#2661, löst den Inline-Flow #2307 ab): Der Paket-Knopf heißt
 * „Bestellen“ und öffnet den Dialog mit Rechnungsadresse und Widerrufs-Zustimmung, bevor es
 * zum Zahlungsanbieter geht. `/auth/me`, Katalog, Adresse und Billing sind gemockt (Muster
 * `billing.spec.ts`); es findet kein echter PayPal-Aufruf statt.
 */
test.use({ viewport: { width: 375, height: 812 } });

const CATALOG = {
	features: [],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		plus: { monthly: 499, quarterly: 1347, yearly: 4790 },
		pro: { monthly: 899, quarterly: 2427, yearly: 8630 },
	},
};

const USER = {
	id: 1,
	displayName: 'Test User',
	email: 'test@example.com',
	plan: 'free',
	entitlements: {},
	subscription: null,
};

const ADDRESS = {
	name: 'Max Mustermann',
	street: 'Musterstraße 1',
	zip: '12345',
	city: 'Musterstadt',
	country: 'Deutschland',
};

const json = (body: unknown) => (route: Route) =>
	route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test('AK1-AK3: Paket-Knopf „Bestellen“ öffnet den Dialog; erst Adresse + Zustimmung bestellen', async ({ page }) => {
	let checkoutCalls = 0;
	let addressSaved = false;
	await page.route('**/auth/me', json(USER));
	await page.route('**/api/v1/plans', json(CATALOG));
	await page.route('**/api/v1/billing/invoices', json([]));
	// #2661: erst keine Adresse (`null` je Feld), nach dem Speichern die vollständige.
	await page.route('**/api/v1/billing/address', (route: Route) => {
		if (route.request().method() === 'PUT') {
			addressSaved = true;
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADDRESS) });
		}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(addressSaved ? ADDRESS : { name: null, street: null, zip: null, city: null, country: null }),
		});
	});
	await page.route('**/api/v1/billing/subscriptions', (route: Route) => {
		checkoutCalls += 1;
		return route.fulfill({
			status: 201,
			contentType: 'application/json',
			body: JSON.stringify({ approvalUrl: 'https://paypal.example/approve/abc' }),
		});
	});
	await page.route('https://paypal.example/**', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>PayPal-Sandbox</body></html>' }),
	);
	await page.goto('/app/settings/pakete');
	await expect(page.getByTestId('plans-section')).toBeVisible();

	// AK1: Der Knopf heißt „Bestellen“ und bucht nicht direkt.
	const book = page.getByTestId('book-pro-monthly');
	await expect(book).toContainText('Bestellen');
	await book.click();
	await expect(page.getByRole('checkbox')).toBeVisible();
	expect(checkoutCalls, 'Der Paket-Knopf bucht nicht direkt').toBe(0);

	// AK2: Ohne gespeicherte Adresse ist das Adress-Details offen, der Bestell-Knopf deaktiviert.
	await expect(page.getByText('Rechnungsadresse anlegen')).toBeVisible();
	const submit = page.getByTestId('order-submit').getByRole('button');
	await expect(submit).toBeDisabled();

	// AK3: Widerrufs-Belehrung ist im Dialog verlinkt (375 px ohne Überlauf).
	const link = page.locator('a[href="/widerruf/"]');
	await expect(link).toBeVisible();
	await link.scrollIntoViewIfNeeded();
	const linkBox = await link.boundingBox();
	expect(linkBox, 'Link hat eine Bounding-Box').not.toBeNull();
	expect(linkBox!.x).toBeGreaterThanOrEqual(0);
	expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(375);

	// Adresse ausfüllen und speichern — dann ist nur noch die Zustimmung nötig.
	const fill = async (testId: string, value: string): Promise<void> => {
		const input = page.getByTestId(`billing-address-${testId}`).getByRole('textbox');
		await input.fill(value);
	};
	await fill('name', ADDRESS.name);
	await fill('street', ADDRESS.street);
	await fill('zip', ADDRESS.zip);
	await fill('city', ADDRESS.city);
	await fill('country', ADDRESS.country);
	await page.getByTestId('billing-address-save').getByRole('button').click();
	await expect(submit).toBeDisabled();
	await page.getByRole('checkbox').check();
	await expect(submit).toBeEnabled();
	await submit.click();
	await expect.poll(() => checkoutCalls).toBe(1);
	await expect(page).toHaveURL(/paypal\.example\/approve\/abc/);
});
