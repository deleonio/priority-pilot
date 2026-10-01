import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * e2e für #2048 AK1+AK7 (Spec docs/spec/issue-2048.md) — Reiter „Pakete & Abo" bei 375 px:
 * gekündigtes PayPal-Abo zeigt den Gekündigt-Hinweis mit Enddatum, keinen Kündigen-Schalter,
 * und nichts wird am Viewport geclippt (Bounding-Box). Muster `issue-1529-pakete-abo.spec.ts`
 * (mock `/auth/me` + Plans + Invoices). Rot, bis die Impl-Phase den Zustand umsetzt.
 * KEIN Produktivcode.
 */

const USER_CANCELLED = {
	id: 1,
	displayName: 'Test User 2048',
	email: 'user-2048@example.com',
	plan: 'pro',
	entitlements: {},
	subscription: {
		provider: 'paypal',
		plan: 'pro',
		period: 'monthly',
		status: 'cancelled',
		currentPeriodEnd: '2027-01-15T00:00:00.000Z',
		pendingPlan: null,
		pendingPlanEffectiveAt: null,
		graceUntil: null,
	},
};

const VIEWPORT = { width: 375, height: 720 };

test.describe('Balamentum — #2048: gekündigtes Abo im Reiter „Pakete & Abo"', () => {
	test('AK1+AK7: Gekündigt-Hinweis sichtbar mit Enddatum, kein Kündigen-Schalter, nichts bei 375 px geclippt', async ({
		page,
	}: {
		page: Page;
	}) => {
		await page.route('**/api/v1/plans', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ features: [], prices: {} }),
			}),
		);
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER_CANCELLED) }),
		);
		await page.route('**/api/v1/billing/invoices', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
		);

		await page.setViewportSize(VIEWPORT);
		await page.goto('/app/settings/abo');

		const hint = page.getByTestId('subscription-cancelled');
		await expect(hint).toBeVisible();
		await expect(hint).toContainText('Gekündigt');
		await expect(hint).toContainText(/15\.1?\.2027/);
		await expect(hint).toContainText('Free');
		await expect(page.getByTestId('cancel-subscription')).toHaveCount(0);

		// AK7: nichts geclippt — Bounding-Box innerhalb des Viewports (scrollWidth ist wegen
		// overflow-x: hidden der App-Shell ungeeignet, MEMORY 2026-08-24). Nachmessen statt
		// einmalig greifen (MEMORY 2026-09-14).
		await expect
			.poll(async () => {
				const box = await hint.boundingBox();
				return box === null ? Number.POSITIVE_INFINITY : box.x + box.width;
			})
			.toBeLessThanOrEqual(VIEWPORT.width + 0.5);
	});
});
