import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * e2e für #1955 AK5 (Spec docs/spec/issue-1955.md) — je Rechnungszeile eine PDF-Download-Aktion,
 * verdrahtet mit dem PDF-Endpunkt; bei 375 px ohne horizontalen Overflow. Das echte Backend kann
 * hier keine Rechnung mit gespeicherten PDF-Bytes stellen (Rechnungen entstehen nur aus
 * PayPal-Zahlungen) — die Liste/der Download sind gemockt (Muster `billing.spec.ts`, #1529).
 */

const CATALOG = {
	features: [] as { feature: string; allowedPlans: string[] }[],
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

const INVOICE = {
	id: 7,
	number: 'INV-2026-100001',
	periodStart: '2026-02-01T00:00:00.000Z',
	periodEnd: '2026-03-01T00:00:00.000Z',
	amountCents: 799,
	taxNote: '§19 UStG',
};

const mockPlans = async (page: Page, user: Record<string, unknown>): Promise<void> => {
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
	await page.route('**/api/v1/billing/invoices', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([INVOICE]) }),
	);
};

const openInvoices = async (page: Page): Promise<void> => {
	await page.goto('/app/settings/abo');
	await expect(page.getByTestId('subscription-section')).toBeVisible();
	await page.getByText('Rechnungen und Kündigung', { exact: true }).click();
	await expect(page.getByTestId('billing-invoices')).toBeVisible();
};

test.describe('Balamentum — #1955: PDF-Download je Rechnung', () => {
	test('AK5: je Rechnungszeile eine Download-Aktion, Dateiname aus der Rechnungsnummer', async ({ page }) => {
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });
		await page.route('**/api/v1/billing/invoices/7/pdf', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/pdf',
				headers: { 'content-disposition': 'attachment; filename="INV-2026-100001.pdf"' },
				body: Buffer.from('%PDF-1.4 test'),
			}),
		);

		await openInvoices(page);
		const row = page.locator('.billing-invoices__item').filter({ hasText: 'INV-2026-100001' });
		const downloadButton = row.getByTestId('invoice-download');
		await expect(downloadButton).toBeVisible();

		const downloadPromise = page.waitForEvent('download');
		await downloadButton.click();
		const download = await downloadPromise;
		expect(download.suggestedFilename(), 'Der Download muss unter der Rechnungsnummer abgelegt werden').toContain(
			'INV-2026-100001',
		);
	});

	test('AK5: bei 375px kein horizontaler Überlauf der Rechnungsliste', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });

		await openInvoices(page);
		const items = page.locator('.billing-invoices__item');
		await expect(items.first()).toBeVisible();
		await expect(items.getByTestId('invoice-download').first()).toBeVisible();

		// App-Shell clippt overflow-x: Bounding-Boxen statt scrollWidth (Muster billing.spec.ts).
		await expect
			.poll(async () => {
				const boxes = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
				return Math.max(...boxes);
			})
			.toBeLessThanOrEqual(375);
	});

	// #2031 AK2/AK3 — längere Button-Namen (Rechnungsnummer im zugänglichen Namen) dürfen bei 375 px
	// nicht überlaufen; mind. zwei Zeilen mit unterschiedlichen Nummern.
	test('#2031: längere Download-Namen — zugänglicher Name mit Nummer, 375px ohne Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });
		await page.route('**/api/v1/billing/invoices', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([INVOICE, { ...INVOICE, id: 8, number: 'INV-2026-100002' }]),
			}),
		);

		await openInvoices(page);
		const items = page.locator('.billing-invoices__item');
		await expect(items).toHaveCount(2);
		const buttons = items.getByTestId('invoice-download');
		await expect(buttons.nth(0)).toHaveAccessibleName('PDF INV-2026-100001 herunterladen');
		await expect(buttons.nth(1)).toHaveAccessibleName('PDF INV-2026-100002 herunterladen');

		// App-Shell clippt overflow-x: Bounding-Boxen statt scrollWidth (Muster oben).
		await expect
			.poll(async () => {
				const boxes = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
				return Math.max(...boxes);
			})
			.toBeLessThanOrEqual(375);
	});
});
