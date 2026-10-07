import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Rote Spec-e2e für #2324 AK5 (Spec docs/spec/issue-2324.md) — Paketwechsel-Dialog bei 375 px ohne
 * Überlauf, Upgrade und Downgrade. Zahlungsanbieter und Sitzung lassen sich im Test nicht echt
 * herstellen, daher `/plans`, `/auth/me`, Rechnungen und die Vorschau per `page.route`
 * (Muster `issue-1913-upgrade-preview.spec.ts`).
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
		currentPeriodEnd: '2026-10-15T00:00:00.000Z',
		pendingPlan: null,
		pendingPlanEffectiveAt: null,
		graceUntil: null,
	},
};

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const PREVIEWS = {
	upgrade: { priceCents: 1347, creditCents: 499, dueCents: 848, immediate: true, startsAt: '2026-10-07T00:00:00.000Z' },
	downgrade: {
		priceCents: 499,
		creditCents: 0,
		dueCents: 0,
		immediate: false,
		startsAt: '2026-10-15T00:00:00.000Z',
		currentPlan: 'pro',
		currentPeriod: 'monthly',
	},
};

for (const [name, preview, button] of [
	['Upgrade', PREVIEWS.upgrade, 'change-plan-plus-quarterly'],
	['Downgrade', PREVIEWS.downgrade, 'change-plan-plus-monthly'],
] as const) {
	test(`AK5: ${name}-Dialog bei 375 px — alle Zeilen liegen vollständig im Viewport`, async ({ page }) => {
		await page.route('**/api/v1/plans', (route: Route) => route.fulfill(json(CATALOG)));
		await page.route('**/auth/me', (route: Route) => route.fulfill(json(USER)));
		await page.route('**/api/v1/billing/invoices', (route: Route) => route.fulfill(json([])));
		await page.route('**/api/v1/billing/subscriptions/change/preview', (route: Route) => route.fulfill(json(preview)));
		await page.goto('/app/settings/pakete');
		await page.getByTestId(button).click();

		const dialog = page.locator('kol-dialog');
		await expect(dialog).toContainText(name === 'Upgrade' ? 'Preis Plus' : 'Aktuelles Paket bis');
		const rows = dialog.locator('.change-preview > div');
		expect(await rows.count()).toBeGreaterThanOrEqual(3);

		for (const row of await rows.all()) {
			const box = await row.boundingBox();
			expect(box, 'Zeile muss gerendert sein').not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
	});
}
