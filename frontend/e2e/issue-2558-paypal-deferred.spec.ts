import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * E2E für #2558 AK1 — nach einem vorgemerkten Wechsel (Vorschau `immediate: false`, Change-POST ohne
 * `approvalUrl`) zeigt die Paketseite den Info-Alert „Wechsel vorgemerkt“ bei 375 px. PayPal und
 * Sitzung lassen sich im Test nicht echt herstellen, daher Routen per `page.route`
 * (Muster `issue-2324-change-dialog.spec.ts`).
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
	plan: 'pro',
	entitlements: {},
	subscription: {
		provider: 'paypal',
		plan: 'pro',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: '2099-10-15T00:00:00.000Z',
		pendingPlan: null,
		pendingPlanEffectiveAt: null,
		graceUntil: null,
	},
};

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const DOWNGRADE = {
	priceCents: 499,
	creditCents: 0,
	dueCents: 0,
	immediate: false,
	startsAt: '2026-10-15T00:00:00.000Z',
	currentPlan: 'pro',
	currentPeriod: 'monthly',
};

test('AK1: vorgemerkter Wechsel zeigt den Info-Alert „Wechsel vorgemerkt“ bei 375 px', async ({ page }) => {
	await page.route('**/api/v1/plans', (route: Route) => route.fulfill(json(CATALOG)));
	await page.route('**/auth/me', (route: Route) => route.fulfill(json(USER)));
	await page.route('**/api/v1/billing/invoices', (route: Route) => route.fulfill(json([])));
	await page.route('**/api/v1/billing/subscriptions/change/preview', (route: Route) => route.fulfill(json(DOWNGRADE)));
	// Antwort ohne `approvalUrl` — genau der Fall, der den deferred-Wartezustand auslöst.
	await page.route('**/api/v1/billing/subscriptions/change', (route: Route) => route.fulfill(json({})));
	await page.goto('/app/settings/pakete');
	await page.getByTestId('change-plan-plus-monthly').click();

	const confirm = page.getByRole('button', { name: 'Wechseln bestätigen' });
	await expect(confirm).toBeVisible();
	await confirm.click();

	// Echtes kol-alert trägt das Label als Inhalt, nicht als AccName (a11y-Snapshot) — deshalb Textfilter.
	await expect(page.locator('kol-alert').filter({ hasText: 'Wechsel vorgemerkt' })).toBeVisible();
});
