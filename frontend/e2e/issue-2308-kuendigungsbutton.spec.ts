import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * e2e für #2308 AK1/AK2/AK4/AK8 (Spec docs/spec/issue-2308.md) — Button „Verträge hier kündigen"
 * ohne Aufklappen und erweiterter Bestätigungsschritt bei 375 px. Muster `issue-2048-abo-gekundigt.spec.ts`
 * (mock `/auth/me` + Plans + Invoices, PayPal-Cancel gemockt). Rot, bis die Impl-Phase den Dialog umsetzt.
 * KEIN Produktivcode.
 */

const USER = {
	id: 1,
	displayName: 'Test User 2308',
	email: 'user-2308@example.com',
	plan: 'pro',
	entitlements: {},
	subscription: {
		provider: 'paypal',
		plan: 'pro',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: '2027-01-15T00:00:00.000Z',
		pendingPlan: null,
		pendingPlanEffectiveAt: null,
		graceUntil: null,
	},
};

const VIEWPORT = { width: 375, height: 720 };

const mockBase = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [], prices: {} }) }),
	);
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }),
	);
	await page.route('**/api/v1/billing/invoices', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
	);
};

test.describe('Balamentum — #2308: Verträge hier kündigen', () => {
	test('AK1+AK2+AK4+AK8: Button ohne Aufklappen, Dialog mit vorbelegter E-Mail, Body mit Art/E-Mail, bei 375 px vollständig sichtbar', async ({
		page,
	}: {
		page: Page;
	}) => {
		await mockBase(page);
		let body: unknown = null;
		await page.route('**/api/v1/billing/subscriptions/cancel', (route: Route) => {
			body = route.request().postDataJSON();
			return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});

		await page.setViewportSize(VIEWPORT);
		await page.goto('/app/settings/abo');

		const button = page.getByRole('button', { name: 'Verträge hier kündigen' });
		await expect(button).toBeVisible();
		await button.click();

		const dialog = page.locator('kol-dialog');
		await expect(dialog).toContainText('zum Ende der Laufzeit');
		await expect(dialog).toContainText(/15\.1?\.2027/);
		await expect(dialog.locator('kol-input-email input')).toHaveValue('user-2308@example.com');

		// AK8: Dialog-Buttons und Felder liegen im Viewport (Bounding-Box; scrollWidth ist wegen overflow-x: hidden ungeeignet).
		const confirm = dialog.getByRole('button', { name: 'Jetzt kündigen' });
		await confirm.scrollIntoViewIfNeeded();
		await expect
			.poll(async () => {
				const box = await confirm.boundingBox();
				return box === null ? Number.POSITIVE_INFINITY : box.x + box.width;
			})
			.toBeLessThanOrEqual(VIEWPORT.width + 0.5);

		await confirm.click();
		await expect.poll(() => body).toEqual({ kind: 'ordinary', email: 'user-2308@example.com' });
		await expect(page.getByTestId('subscription-cancelled')).toBeVisible();
	});
});
