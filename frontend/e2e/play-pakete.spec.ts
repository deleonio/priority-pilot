import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

/**
 * #1674: Im Kanal `play` zeigt die Paketansicht Pakete und Preise, aber keinen Kauf und keinen
 * Verweis auf den Web-Kauf (ADR 0016). Der Kanal wird über `__PP_CHANNEL__` gesetzt
 * (`lib/platform.ts`), der Paketkatalog kommt vom echten Backend. Der Nutzer hat kein Abo, im Web
 * stünde also in jeder Paket-Spalte „Buchen" — die Web-Gegenprobe zeigt, dass die Prüfung greift.
 */

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
			}),
		}),
	);
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/app/settings/pakete');
	await expect(page.locator('[data-testid="plans-section"] kol-table-stateful')).toBeVisible();
};

test.describe('Balamentum — #1674: Paketansicht im Kanal play', () => {
	test('Web-Gegenprobe: ohne Abo bietet die Matrix „Buchen" an', async ({ page }) => {
		await openPlans(page);

		await expect(page.getByRole('button', { name: 'Buchen' }).first()).toBeVisible();
		await expect(page.getByText('Kauf in der App folgt')).toHaveCount(0);
	});

	test('play bei 375 px: Pakete sichtbar, kein Kauf-Button, kein Link, Hinweis sichtbar', async ({ page }) => {
		await openPlans(page, 'play');

		await expect(page.getByRole('cell', { name: '7,99 €' })).toBeVisible();
		await expect(page.getByText('Kauf in der App folgt')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buchen' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Wechseln' })).toHaveCount(0);
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
