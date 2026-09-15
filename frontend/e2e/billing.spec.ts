import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * Rote Spec-e2e für #1496 (T6c, Spec docs/spec/issue-1496.md AK1/AK3/AK5/AK6/AK7) — Buchungs- und
 * Verwaltungsflow in den Einstellungen. `/auth/me` und die Billing-Routen werden per `page.route`
 * gemockt (Muster `fixtures.ts` + `crud.spec.ts`); Navigation zur `approvalUrl` wird abgefangen,
 * es findet kein echter PayPal-Aufruf statt.
 */

const CATALOG = {
	features: [],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		pro: { monthly: 799, quarterly: 2157, yearly: 7670 },
		max: { monthly: 1499, quarterly: 4047, yearly: 14390 },
		ultimate: { monthly: 2499, quarterly: 6747, yearly: 23990 },
	},
};

const USER_NO_SUBSCRIPTION = {
	id: 1,
	displayName: 'Test User',
	email: 'test@example.com',
	plan: 'free',
	entitlements: {},
	subscription: null,
};

const activeSubscription = (overrides: Record<string, unknown> = {}) => ({
	plan: 'pro',
	period: 'monthly',
	status: 'active',
	currentPeriodEnd: '2026-10-15T00:00:00.000Z',
	pendingPlan: null,
	pendingPlanEffectiveAt: null,
	graceUntil: null,
	...overrides,
});

const mockCatalog = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
};

const mockAuthMe = async (page: Page, user: Record<string, unknown>): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

const mockEmptyInvoices = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/billing/invoices', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
	);
};

const gotoSettings = async (page: Page): Promise<void> => {
	await page.goto('/settings');
	await expect(page.getByTestId('plans-section')).toBeVisible();
};

test.describe('Priority Pilot — #1496: Buchungs- und Verwaltungsflow', () => {
	test('AK1: Buchen ruft POST /billing/subscriptions und navigiert zur approvalUrl', async ({ page }) => {
		await mockCatalog(page);
		await mockAuthMe(page, USER_NO_SUBSCRIPTION);
		await mockEmptyInvoices(page);

		let capturedBody: unknown;
		await page.route('**/api/v1/billing/subscriptions', (route: Route) => {
			capturedBody = route.request().postDataJSON();
			return route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ approvalUrl: 'https://paypal.example/approve/abc' }),
			});
		});

		await gotoSettings(page);
		await page.getByTestId('book-pro-monthly').click();

		await expect
			.poll(() => capturedBody, { message: 'POST /billing/subscriptions muss plan+period senden' })
			.toEqual({ plan: 'pro', period: 'monthly' });
		await expect(page).toHaveURL(/paypal\.example\/approve\/abc/);
	});

	test('AK3: Wechsel zeigt Bestätigungsdialog mit Anrechnungs-Hinweis und ruft /billing/subscriptions/change', async ({
		page,
	}) => {
		await mockCatalog(page);
		await mockAuthMe(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription() });
		await mockEmptyInvoices(page);

		let capturedBody: unknown;
		await page.route('**/api/v1/billing/subscriptions/change', (route: Route) => {
			capturedBody = route.request().postDataJSON();
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
		});

		await gotoSettings(page);
		await page.getByTestId('change-plan-max-monthly').click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText(/Restbetrag/);
		await expect(dialog).toContainText(/angerechnet/);

		await dialog.getByRole('button', { name: /bestätigen|wechseln/i }).click();

		await expect
			.poll(() => capturedBody, { message: 'POST /billing/subscriptions/change muss plan+period senden' })
			.toEqual({ plan: 'max', period: 'monthly' });
		// Ohne approvalUrl bleibt die Oberfläche im Wartezustand (AK3/AK4) — Plan ändert sich nicht
		// sofort, weil /auth/me hier weiterhin "pro" liefert.
		await expect(page.getByText(/Zahlung wird bestätigt/i)).toBeVisible();
	});

	test('AK3: Kündigung zeigt destruktiven Bestätigungsdialog und ruft /billing/subscriptions/cancel', async ({
		page,
	}) => {
		await mockCatalog(page);
		await mockAuthMe(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription() });
		await mockEmptyInvoices(page);

		let cancelCalled = false;
		await page.route('**/api/v1/billing/subscriptions/cancel', (route: Route) => {
			cancelCalled = true;
			return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
		});

		await gotoSettings(page);
		await page.getByTestId('cancel-subscription').click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		const dangerButton = dialog.getByRole('button', { name: /kündigen/i });
		await expect(dangerButton).toHaveAttribute('data-variant', 'danger');
		await dangerButton.click();

		await expect.poll(() => cancelCalled).toBe(true);
	});

	test('AK5: Rechnungsliste zeigt Nummer, Zeitraum, Betrag; leere Liste zeigt Leerzustand', async ({ page }) => {
		await mockCatalog(page);
		await mockAuthMe(page, USER_NO_SUBSCRIPTION);
		await mockEmptyInvoices(page);

		await gotoSettings(page);
		await expect(page.getByTestId('invoices-empty')).toBeVisible();
	});

	test('AK5: gefüllte Rechnungsliste zeigt jede Rechnung', async ({ page }) => {
		await mockCatalog(page);
		await mockAuthMe(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription() });
		await page.route('**/api/v1/billing/invoices', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 1,
						number: 'INV-2026-000001',
						periodStart: '2026-08-15T00:00:00.000Z',
						periodEnd: '2026-09-15T00:00:00.000Z',
						amountCents: 799,
						taxNote: '§19 UStG',
					},
				]),
			}),
		);

		await gotoSettings(page);
		await expect(page.getByText('INV-2026-000001')).toBeVisible();
		await expect(page.getByText('7,99 €')).toBeVisible();
		await expect(page.getByTestId('invoices-empty')).toHaveCount(0);
	});

	test('AK6: Abo-Status zeigt gesetzte Felder inklusive pendingPlan und graceUntil', async ({ page }) => {
		await mockCatalog(page);
		await mockAuthMe(page, {
			...USER_NO_SUBSCRIPTION,
			plan: 'pro',
			subscription: activeSubscription({
				pendingPlan: 'max',
				pendingPlanEffectiveAt: '2026-11-15T00:00:00.000Z',
				graceUntil: '2026-09-20T00:00:00.000Z',
			}),
		});
		await mockEmptyInvoices(page);

		await gotoSettings(page);
		await expect(page.getByTestId('subscription-status')).toBeVisible();
		await expect(page.getByTestId('subscription-status')).toContainText(/max/i);
		await expect(page.getByTestId('subscription-status')).toContainText(/2026/);
	});

	test('AK6: ungesetzte Felder (kein pendingPlan, kein graceUntil) fehlen im DOM', async ({ page }) => {
		await mockCatalog(page);
		await mockAuthMe(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription() });
		await mockEmptyInvoices(page);

		await gotoSettings(page);
		await expect(page.getByTestId('subscription-pending-plan')).toHaveCount(0);
		await expect(page.getByTestId('subscription-grace-until')).toHaveCount(0);
	});

	test('AK7: Bei 375px kein horizontaler Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockCatalog(page);
		await mockAuthMe(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription() });
		await mockEmptyInvoices(page);

		await gotoSettings(page);

		const box = await page.getByTestId('plans-section').boundingBox();
		expect(box, 'plans-section muss eine Bounding-Box haben').not.toBeNull();
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
	});
});
