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

		await page.goto('/app/settings/zugriff');
		await expect(page.getByRole('tab', { name: 'Access-Token', exact: true })).toHaveAttribute('aria-selected', 'true');
	});
});
