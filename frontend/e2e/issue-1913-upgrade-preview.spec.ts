import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * Rote Spec-e2e für #1913 (Spec docs/spec/issue-1913.md AK4/AK5) — der Wechsel-Dialog zeigt vor
 * dem Bestätigen Guthaben und fälligen Betrag. Zahlungsanbieter und Sitzung lassen sich im Test
 * nicht echt herstellen, daher `/plans`, `/auth/me`, Rechnungen und die Vorschau per `page.route`
 * (Muster `billing.spec.ts`). Die Server-Rechnung selbst deckt `billing-subscriptions.test.ts` ab.
 */

const CATALOG = {
	features: [],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		plus: { monthly: 499, quarterly: 1347, yearly: 4790 },
		pro: { monthly: 999, quarterly: 2697, yearly: 9590 },
	},
};

const USER = {
	id: 1,
	displayName: 'Test User',
	email: 'test@example.com',
	plan: 'plus',
	entitlements: {},
	subscription: {
		provider: 'paypal',
		plan: 'plus',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: '2026-10-15T00:00:00.000Z',
		pendingPlan: null,
		pendingPlanEffectiveAt: null,
		graceUntil: null,
	},
};

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const openChangeDialog = async (page: Page, preview: { creditCents: number; dueCents: number; immediate: boolean }) => {
	await page.route('**/api/v1/plans', (route: Route) => route.fulfill(json(CATALOG)));
	await page.route('**/auth/me', (route: Route) => route.fulfill(json(USER)));
	await page.route('**/api/v1/billing/invoices', (route: Route) => route.fulfill(json([])));
	await page.route('**/api/v1/billing/subscriptions/change/preview', (route: Route) => route.fulfill(json(preview)));
	await page.goto('/app/settings/pakete');
	await expect(page.getByTestId('plans-section')).toBeVisible();
	await page.getByTestId('change-plan-pro-monthly').click();
	// `KolDialog` projiziert den Inhalt per Slot — Scoping auf den Host-Tag (Muster billing.spec.ts).
	return page.locator('kol-dialog');
};

test.describe('Balamentum — #1913: Betragsvorschau im Wechsel-Dialog', () => {
	test('AK4: Dialog zeigt Guthaben und fälligen Betrag, bevor „Wechseln bestätigen“ aktiv ist', async ({ page }) => {
		const dialog = await openChangeDialog(page, { creditCents: 249, dueCents: 750, immediate: true });

		await expect(dialog).toContainText('7,50 €');
		await expect(dialog).toContainText('2,49 €');
		await expect(dialog.getByRole('button', { name: /Wechseln bestätigen/ })).toBeEnabled();
	});

	test('AK5: bei 375 px liegen Betrag und Guthaben vollständig im Viewport (Bounding-Box)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const dialog = await openChangeDialog(page, { creditCents: 249, dueCents: 750, immediate: true });
		await expect(dialog).toContainText('7,50 €');

		for (const text of ['7,50 €', '2,49 €']) {
			const box = await dialog.getByText(text).first().boundingBox();
			expect(box, `${text} muss gerendert sein`).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		}
	});
});
