import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1902 (Spec docs/spec/issue-1902.md AK4/AK6/AK8) — „Pakete & Abo“ als ein
 * Reiter. AK1/AK2/AK3/AK7 (Tab-Labels, Karten, Verschachtelung) liegen in `SettingsPage.test.tsx`,
 * AK5 (unveränderte API-Aufrufe) in `billing.spec.ts`. `/plans`, `/auth/me` und Rechnungen sind
 * gemockt (Zahlungsanbieter/Sitzung lassen sich im Test nicht echt herstellen).
 */

const CATALOG = {
	features: [{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] }],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		pro: { monthly: 799, quarterly: 2157, yearly: 7670 },
		max: { monthly: 1499, quarterly: 4047, yearly: 14390 },
		ultimate: { monthly: 2499, quarterly: 6747, yearly: 23990 },
	},
};

const USER = {
	id: 1,
	displayName: 'Test User',
	email: 'test@example.com',
	plan: 'free',
	entitlements: {},
	subscription: null,
};

const mockBilling = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/plans', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }),
	);
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }),
	);
	await page.route('**/api/v1/billing/invoices', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
	);
};

test.describe('Balamentum — #1902: Reiter „Pakete & Abo“', () => {
	for (const segment of ['pakete', 'abo']) {
		test(`AK6: /settings/${segment} öffnet den Reiter „Pakete & Abo“`, async ({ page }) => {
			await mockBilling(page);
			await page.goto(`/app/settings/${segment}`);
			await waitForStableView(page, 'Allgemein');

			await expect(page.getByRole('tab', { name: 'Pakete & Abo', exact: true })).toHaveAttribute(
				'aria-selected',
				'true',
			);
			await expect(page.getByTestId('plans-section')).toBeVisible();
		});
	}

	// Test-Pflege #1903: der Reiter „Access-Token" ist im Tab „KI" aufgegangen.
	test('AK6: /settings/zugriff öffnet weiterhin die Access-Token (Tab „KI“)', async ({ page }) => {
		await mockBilling(page);
		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		await expect(page.getByRole('tab', { name: 'KI', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	// AK4/AK8 nach #1902 angepasst: wieder Matrix, die seitlich IN der Tabelle scrollt (ADR 0014 Entscheidung 6).
	test('AK4/AK8: bei 375 px zeigt der Reiter die Paket-Matrix ohne Seiten-Scroll, Buchen bedienbar', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockBilling(page);
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Allgemein');

		await expect(page.getByTestId('plans-section')).toBeVisible();
		const matrix = page.getByTestId('plans-section').locator('kol-table-stateful');
		await expect(matrix).toBeVisible();
		// Bounding-Box statt scrollWidth: die App-Shell clippt overflow-x (Memory 2026-08-24).
		const matrixBox = await matrix.boundingBox();
		expect(matrixBox, 'Matrix hat ein Layout').not.toBeNull();
		expect(matrixBox!.x + matrixBox!.width).toBeLessThanOrEqual(375 + 1);

		const book = page.getByRole('button', { name: /Zahlungspflichtig bestellen/ }).first();
		await book.scrollIntoViewIfNeeded();
		await expect(book).toBeVisible();
		const box = await book.boundingBox();
		expect(box, 'Buchen-Aktion hat ein Layout').not.toBeNull();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});
});
