import type { Route } from '@playwright/test';
import { expect, test, type Locator, type Page } from './fixtures';

/**
 * e2e für #2048 AK1+AK7 (Spec docs/spec/issue-2048.md) — Reiter „Pakete & Abo" bei 375 px:
 * gekündigtes PayPal-Abo zeigt den Gekündigt-Hinweis mit Enddatum, keinen Kündigen-Schalter,
 * und nichts wird am Viewport geclippt (Bounding-Box). Muster `issue-1529-pakete-abo.spec.ts`
 * (mock `/auth/me` + Plans + Invoices). Rot, bis die Impl-Phase den Zustand umsetzt.
 * KEIN Produktivcode.
 */

const USER_CANCELLED = {
	id: 1,
	displayName: 'Test User 2048',
	email: 'user-2048@example.com',
	plan: 'pro',
	entitlements: {},
	subscription: {
		provider: 'paypal',
		plan: 'pro',
		period: 'monthly',
		status: 'cancelled',
		currentPeriodEnd: '2099-01-15T00:00:00.000Z',
		pendingPlan: null,
		pendingPlanEffectiveAt: null,
		graceUntil: null,
	},
};

const VIEWPORT = { width: 375, height: 720 };

test.describe('Balamentum — #2048: gekündigtes Abo im Reiter „Pakete & Abo"', () => {
	test('AK1+AK7: Gekündigt-Hinweis sichtbar mit Enddatum, kein Kündigen-Schalter, nichts bei 375 px geclippt', async ({
		page,
	}: {
		page: Page;
	}) => {
		await page.route('**/api/v1/plans', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ features: [], prices: {} }),
			}),
		);
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER_CANCELLED) }),
		);
		await page.route('**/api/v1/billing/invoices', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
		);

		await page.setViewportSize(VIEWPORT);
		await page.goto('/app/settings/abo');

		const hint = page.getByTestId('subscription-cancelled');
		await expect(hint).toBeVisible();
		await expect(hint).toContainText('Gekündigt');
		await expect(hint).toContainText(/15\.1?\.2099/);
		await expect(hint).toContainText('Free');
		await expect(page.getByTestId('cancel-subscription')).toHaveCount(0);

		// AK7: nichts geclippt — Bounding-Box innerhalb des Viewports (scrollWidth ist wegen
		// overflow-x: hidden der App-Shell ungeeignet, MEMORY 2026-08-24). Nachmessen statt
		// einmalig greifen (MEMORY 2026-09-14).
		await expect
			.poll(async () => {
				const box = await hint.boundingBox();
				return box === null ? Number.POSITIVE_INFINITY : box.x + box.width;
			})
			.toBeLessThanOrEqual(VIEWPORT.width + 0.5);
	});
});

/** #2745: gekündigtes Jahresabo ab der zweiten Laufzeit — Ende einen Monat nach Kündigung gekürzt. */
const USER_CANCELLED_SHORTENED = {
	...USER_CANCELLED,
	period: 'yearly',
	subscription: {
		...USER_CANCELLED.subscription,
		period: 'yearly',
		currentPeriodEnd: '2099-12-15T00:00:00.000Z',
		pendingPlan: 'free',
		pendingPlanEffectiveAt: '2099-01-15T00:00:00.000Z',
		contractEndsAt: '2099-01-15T00:00:00.000Z',
	},
};

/** Aktiv ab der zweiten Laufzeit: der Bestätigungsschritt zeigt das gekürzte Ende VOR dem Klick. */
const USER_ACTIVE_SHORTENED = {
	...USER_CANCELLED,
	period: 'yearly',
	subscription: {
		...USER_CANCELLED.subscription,
		status: 'active',
		period: 'yearly',
		currentPeriodEnd: '2099-12-15T00:00:00.000Z',
		pendingPlan: null,
		contractEndsAt: '2099-01-15T00:00:00.000Z',
	},
};

test.describe('Balamentum — #2745: gekürztes Ende bei Quartals-/Jahresabo (AK7)', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		await page.route('**/api/v1/plans', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ features: [], prices: {} }),
			}),
		);
		await page.route('**/api/v1/billing/invoices', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
		);
		await page.setViewportSize(VIEWPORT);
	});

	/** Bounding-Box-Messung (MEMORY 2026-08-24): `scrollWidth` ist wegen `overflow-x: hidden` ungeeignet. */
	const assertNoOverflow = async (page: Page, element: Locator): Promise<void> => {
		await expect
			.poll(async () => {
				const box = await element.boundingBox();
				return box === null ? Number.POSITIVE_INFINITY : box.x + box.width;
			})
			.toBeLessThanOrEqual(VIEWPORT.width + 0.5);
	};

	test('AK7: Gekündigt-Hinweis nennt das gekürzte Ende, kein Überlauf bei 375 px', async ({ page }: { page: Page }) => {
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER_CANCELLED_SHORTENED) }),
		);
		await page.goto('/app/settings/abo');

		const hint = page.getByTestId('subscription-cancelled');
		await expect(hint).toContainText(/15\.1?\.2099/);
		await assertNoOverflow(page, hint);
	});

	test('AK7: Bestätigungsschritt zeigt gekürztes Ende und Erstattungshinweis, kein Überlauf bei 375 px', async ({
		page,
	}: {
		page: Page;
	}) => {
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER_ACTIVE_SHORTENED) }),
		);
		await page.goto('/app/settings/abo');

		await page.getByRole('button', { name: 'Verträge hier kündigen' }).click();
		// KoliBri slot't den Inhalt in den Shadow-DOM — Text nur über SEITENWEITE piercende Locators
		// suchen: ein unter getByRole('dialog') verketteter Text-Engine sieht geslotetten Inhalt nicht
		// (MEMORY 2026-10-19). Beide Texte kommen nur im Dialog vor (aktives Abo, kein Gekündigt-Hinweis).
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByText(/15\.1?\.2099/)).toBeVisible();
		await expect(page.getByText(/erstatten wir anteilig/)).toBeVisible();
		await assertNoOverflow(page, page.getByRole('dialog'));
	});
});
