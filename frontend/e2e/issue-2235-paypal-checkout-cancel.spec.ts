import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Rote Spec-e2e für #2235 AK7 (Spec docs/spec/issue-2235.md) — Rückkehr vom abgebrochenen
 * PayPal-Checkout. `/auth/me` und die Billing-Routen sind gemockt (Muster `billing.spec.ts`);
 * es findet kein PayPal-Aufruf statt.
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

const user = (subscription: unknown) => ({
	id: 1,
	displayName: 'Test User',
	email: 'test@example.com',
	plan: 'free',
	entitlements: {},
	subscription,
});

const PENDING = {
	provider: 'paypal',
	plan: 'plus',
	period: 'monthly',
	status: 'approval_pending',
	currentPeriodEnd: '2099-01-15T00:00:00.000Z',
	pendingPlan: null,
	pendingPlanEffectiveAt: null,
	graceUntil: null,
};

test('AK7: ?billing=cancelled löst genau einen Cancel-Aufruf aus, danach ist „Buchen" verfügbar', async ({ page }) => {
	let cancelCalls = 0;
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(user(cancelCalls > 0 ? null : PENDING)),
		}),
	);
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
	await page.route('**/api/v1/billing/invoices', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
	await page.route('**/api/v1/billing/subscriptions/cancel', (route: Route) => {
		cancelCalls += 1;
		return route.fulfill({ status: 204 });
	});

	await page.goto('/app/settings?billing=cancelled');
	await expect.poll(() => cancelCalls, { message: 'genau ein POST /billing/subscriptions/cancel' }).toBe(1);
	await expect(page).not.toHaveURL(/billing=cancelled/);

	await page.goto('/app/settings/pakete');
	await expect(page.getByTestId('book-plus-monthly')).toBeVisible();
	expect(cancelCalls).toBe(1);
});
