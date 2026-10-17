import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * #1674/#1692/#2492: Im Kanal `play` zeigt die Paketansicht die Katalogpreise ohne Kaufweg und mit
 * dem Hinweis „Kauf in der App folgt“ (ADR 0016 Nachtrag), nie PayPal und ohne Verweis auf den Web-Kauf. Der Kanal wird über `__PP_CHANNEL__` gesetzt
 * (`lib/platform.ts`), `cordova-plugin-purchase` als globales `CdvPurchase` gemockt; der
 * Paketkatalog kommt vom echten Backend. Der Nutzer hat kein Abo.
 */

/** Store-Attrappe: jedes Paket mit drei Base Plans zum Store-Preis „9,49 €“. */
const mockPlayStore = (page: Page) =>
	page.addInitScript(() => {
		(window as { CdvPurchase?: unknown }).CdvPurchase = {
			store: {
				register: () => undefined,
				when: () => ({ approved: () => undefined }),
				initialize: () => Promise.resolve(),
				get: (id: string) => ({
					offers: ['monthly', 'quarterly', 'yearly'].map((period) => ({
						id: `${id}@${period}`,
						pricingPhases: [{ price: '9,49 €' }],
						order: () => Promise.resolve(undefined),
					})),
				}),
			},
		};
	});

const openPlans = async (page: Page, channel?: 'play'): Promise<void> => {
	if (channel !== undefined) {
		await page.addInitScript((value) => {
			(window as { __PP_CHANNEL__?: string }).__PP_CHANNEL__ = value;
		}, channel);
	}
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				id: 1,
				displayName: 'Test User',
				email: 'test@example.com',
				plan: 'free',
				entitlements: {},
				subscription: null,
				playAccountId: 'acc-1',
			}),
		}),
	);
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/app/settings/pakete');
	await expect(page.getByTestId('plans-section')).toBeVisible();
};

test.describe('Balamentum — #1674/#1692: Paketansicht im Kanal play', () => {
	test('Web-Gegenprobe: ohne Abo bietet die Matrix „Bestellen" zu den Katalogpreisen an', async ({ page }) => {
		await openPlans(page);

		// Test-Pflege #2661: Paket-Knopf heißt „Bestellen“.
		await expect(page.getByRole('button', { name: 'Bestellen' }).first()).toBeVisible();
		await expect(page.getByRole('cell', { name: /^4,99 €/ })).toBeVisible();
	});

	test('play bei 375 px: Katalogpreise, Hinweis „Kauf in der App folgt", kein Kaufweg, kein PayPal (#2492)', async ({
		page,
	}) => {
		await mockPlayStore(page);
		await openPlans(page, 'play');

		await expect(page.getByRole('cell', { name: /^4,99 €/ })).toBeVisible();
		await expect(page.getByRole('cell', { name: /^9,49 €/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Buchen' })).toHaveCount(0);
		const notice = page.getByTestId('store-purchase-notice');
		await expect(notice).toBeVisible();
		await expect(notice).toContainText('Kauf in der App folgt');
		const plans = page.getByTestId('plans-section');
		await expect(plans.getByRole('link')).toHaveCount(0);
		await expect(plans).not.toContainText(/PayPal/i);

		// Bounding-Box statt scrollWidth: die App-Shell clippt overflow-x.
		const box = await notice.boundingBox();
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
	});
});
