import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Rote Spec-e2e für #2307 (Spec docs/spec/issue-2307.md) — Widerrufsbelehrung und Zustimmung vor
 * dem Erstkauf. `/auth/me`, Katalog und Billing sind gemockt (Muster `billing.spec.ts`); es
 * findet kein PayPal-Aufruf statt.
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

const json = (body: unknown) => (route: Route) =>
	route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test('AK2/AK3/AK5: Hinweis, Checkbox und Knopf bei 375 px sichtbar; Knopf erst nach der Zustimmung aktiv', async ({
	page,
}) => {
	let checkoutCalls = 0;
	await page.route('**/auth/me', json(USER));
	await page.route('**/api/v1/plans', json(CATALOG));
	await page.route('**/api/v1/billing/invoices', json([]));
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

	const link = page.locator('a[href="/widerruf/"]');
	const checkbox = page.getByRole('checkbox');
	const book = page.getByTestId('book-pro-monthly');
	await expect(link).toBeVisible();
	await expect(checkbox).toBeVisible();
	await expect(book).toContainText('Zahlungspflichtig bestellen');
	// Test-Pflege #2307: `disabled` trägt der innere Button im Shadow-DOM, nicht der kol-button-Host.
	const bookButton = book.getByRole('button');
	await expect(bookButton).toBeDisabled();

	// Bounding-Box statt scrollWidth: die App-Shell clippt overflow-x.
	for (const element of [link, checkbox, book]) {
		await element.scrollIntoViewIfNeeded();
		const box = await element.boundingBox();
		expect(box, 'Element hat eine Bounding-Box').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	}

	await book.click({ force: true });
	expect(checkoutCalls, 'ohne Zustimmung kein Checkout').toBe(0);

	await checkbox.check();
	await expect(bookButton).toBeEnabled();
	await book.click();
	await expect.poll(() => checkoutCalls).toBe(1);
	await expect(page).toHaveURL(/paypal\.example\/approve\/abc/);
});
