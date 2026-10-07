import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * e2e für #1529 AK2 (Spec docs/spec/issue-1529.md) — Pakete/Abo sind kein Teil des Allgemein-Tabs.
 * Test-Pflege #1902: AK1/AK4-AK7 (getrennte Reiter „Pakete“/„Abo“, Matrix als `KolTableStateful`,
 * Button „Pakete ansehen“) entfallen — der gemeinsame Reiter „Pakete & Abo“ steht in
 * `issue-1902-plans-subscription-tab.spec.ts`.
 */

const CATALOG = {
	features: [
		{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] },
		{ feature: 'ai_assist', allowedPlans: ['pro', 'max', 'ultimate'] },
	],
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

const activeSubscription = {
	provider: 'paypal',
	plan: 'pro',
	period: 'monthly',
	status: 'active',
	currentPeriodEnd: '2026-10-15T00:00:00.000Z',
	pendingPlan: null,
	pendingPlanEffectiveAt: null,
	graceUntil: null,
};

const mockPlans = async (page: Page, user: Record<string, unknown>): Promise<void> => {
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
	await page.route('**/api/v1/billing/invoices', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
	);
};

test.describe('Balamentum — #1529: Pakete/Abo als eigene Settings-Reiter', () => {
	test('AK2: /settings/general zeigt keine Pakete-Karte mehr, übrige Segmente wählen weiter ihren Reiter', async ({
		page,
	}) => {
		await mockPlans(page, USER_NO_SUBSCRIPTION);

		await page.goto('/app/settings/general');
		await expect(page.getByTestId('plans-section')).toHaveCount(0);

		await page.goto('/app/settings/kategorien');
		await expect(page.getByRole('tab', { name: 'Kategorien', exact: true })).toHaveAttribute('aria-selected', 'true');

		// Test-Pflege #1903 AK8: `/settings/zugriff` öffnet den Tab „KI" (der Tab „Access-Token" entfällt).
		await page.goto('/app/settings/zugriff');
		await expect(page.getByRole('tab', { name: 'KI', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	test('#1898 AK6: bei 375px ist das Monatsäquivalent in der Matrix sichtbar, die Seite läuft nicht über', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });

		await page.goto('/app/settings/pakete');
		const hint = page.getByText(/6,39\s€\/Monat bei Jahreszahlung/);
		await hint.scrollIntoViewIfNeeded();
		await expect(hint).toBeVisible();

		const pageOverflow = await page.evaluate(() => {
			const el = document.scrollingElement;
			return { scrollWidth: el?.scrollWidth ?? 0, clientWidth: el?.clientWidth ?? 0 };
		});
		expect(pageOverflow.scrollWidth, 'die Seite selbst darf nicht horizontal überlaufen').toBeLessThanOrEqual(
			pageOverflow.clientWidth + 1,
		);
	});
});
