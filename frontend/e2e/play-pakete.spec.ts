import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * #1674/#1692: Im Kanal `play` kauft die Paketansicht über Google Play, nie über PayPal und ohne
 * Verweis auf den Web-Kauf (ADR 0016). Der Kanal wird über `__PP_CHANNEL__` gesetzt
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
	await expect(page.locator('[data-testid="plans-section"] kol-table-stateful')).toBeVisible();
};

test.describe('Balamentum — #1674/#1692: Paketansicht im Kanal play', () => {
	test('Web-Gegenprobe: ohne Abo bietet die Matrix „Buchen" zu den Katalogpreisen an', async ({ page }) => {
		await openPlans(page);

		await expect(page.getByRole('button', { name: 'Buchen' }).first()).toBeVisible();
		await expect(page.getByRole('cell', { name: '7,99 €' })).toBeVisible();
	});

	test('play ohne Store-Plugin: Pakete sichtbar, kein Kauf-Button, Hinweis', async ({ page }) => {
		await openPlans(page, 'play');

		await expect(page.getByRole('cell', { name: '7,99 €' })).toBeVisible();
		await expect(page.getByText('Google Play nicht erreichbar')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buchen' })).toHaveCount(0);
	});

	test('play bei 375 px: Store-Preise, Kauf-Buttons ≥ 44 px, kein Link, kein Überlauf', async ({ page }) => {
		await mockPlayStore(page);
		await openPlans(page, 'play');

		await expect(page.getByRole('cell', { name: '9,49 €' }).first()).toBeVisible();
		await expect(page.getByRole('cell', { name: '7,99 €' })).toHaveCount(0);
		const buy = page.getByRole('button', { name: 'Buchen' }).first();
		await expect(buy).toBeVisible();
		expect((await buy.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
		await expect(page.getByTestId('plans-section').getByRole('link')).toHaveCount(0);

		const overflow = await page.evaluate(() => {
			const el = document.scrollingElement;
			return { scrollWidth: el?.scrollWidth ?? 0, clientWidth: el?.clientWidth ?? 0 };
		});
		expect(overflow.scrollWidth, 'die Seite darf nicht horizontal überlaufen').toBeLessThanOrEqual(
			overflow.clientWidth + 1,
		);
	});
});
