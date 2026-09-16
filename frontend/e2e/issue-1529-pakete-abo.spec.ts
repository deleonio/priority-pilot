import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import {
	headerCellMetrics,
	measureHorizontalScroll,
	scrollMatrixAndMeasureFirstCell,
	waitForStableView,
} from './helpers';

/**
 * Rote Spec-e2e für #1529 (Spec docs/spec/issue-1529.md AK1/AK2/AK4/AK5/AK6/AK7) — eigene
 * Settings-Reiter „Pakete“/„Abo“ statt der Karte „Pakete“ im Allgemein-Tab, Preis-Matrix als
 * `KolTableStateful` mit seitlich scrollendem Container (375px) statt Seiten-Overflow.
 *
 * AK3 (Matrix-Datenvertrag) und AK8 (unverändertes Buchungsverhalten, umgezogene Tests) liegen in
 * `PlansSection.test.tsx` bzw. `billing.spec.ts`/`issue-1484-plan-badges.spec.ts` — hier nur die
 * Routen-/Layout-Akzeptanzkriterien.
 *
 * `KolTableStateful` rendert als `<kol-table-stateful>`-Host mit eigenem Shadow-DOM (Vorbild
 * `CompletedTasksTable`/`completed-tasks.spec.ts`) — rohe CSS-Selektoren wie `table`/`th`/`td`
 * finden dort nichts. AK4/AK5/AK6 lesen deshalb entweder über Playwright-Rollen-Locators (die
 * pierct nativ durch offene Shadow-Roots) oder über eine schließungsfreie, rekursive
 * `evaluate`-Durchquerung (Muster `measureHorizontalScroll`, `helpers.ts`, #824-Guard).
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

const activeSubscription = {
	plan: 'pro',
	period: 'monthly',
	status: 'active',
	currentPeriodEnd: '2026-10-15T00:00:00.000Z',
	pendingPlan: null,
	pendingPlanEffectiveAt: null,
	graceUntil: null,
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

test.describe('Priority Pilot — #1529: Pakete/Abo als eigene Settings-Reiter', () => {
	test('AK1: /settings/pakete zeigt die Matrix, /settings/abo die Rechnungsliste, Reiterwechsel schreibt die URL', async ({
		page,
	}) => {
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });

		await page.goto('/settings/pakete');
		await expect(page.getByTestId('plans-section')).toBeVisible();

		await page.goto('/settings/abo');
		await expect(page.getByTestId('billing-invoices')).toBeVisible();
		await waitForStableView(page, 'Allgemein');

		// Reiterwechsel Abo → Pakete schreibt das Segment zurück in die URL.
		await page.getByRole('tab', { name: 'Pakete', exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/pakete$/);
		await expect(page.getByTestId('plans-section')).toBeVisible();

		await page.getByRole('tab', { name: 'Abo', exact: true }).click();
		await expect(page).toHaveURL(/\/settings\/abo$/);
		await expect(page.getByTestId('billing-invoices')).toBeVisible();
	});

	test('AK2: /settings/general zeigt keine Pakete-Karte mehr, übrige Segmente wählen weiter ihren Reiter', async ({
		page,
	}) => {
		await mockPlans(page, USER_NO_SUBSCRIPTION);

		await page.goto('/settings/general');
		await expect(page.getByTestId('plans-section')).toHaveCount(0);

		await page.goto('/settings/kategorien');
		await expect(page.getByRole('tab', { name: 'Kategorien', exact: true })).toHaveAttribute('aria-selected', 'true');

		await page.goto('/settings/zugriff');
		await expect(page.getByRole('tab', { name: 'Zugriff', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	test('AK4: bei 375px scrollt der Matrix-Container seitlich, die Seite selbst scrollt nicht mit', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });

		await page.goto('/settings/pakete');
		const host = page.locator('[data-testid="plans-section"] kol-table-stateful');
		await expect(host).toBeVisible();

		const { scroller } = await host.evaluate(measureHorizontalScroll);
		expect(scroller, 'Matrix-Container muss einen scrollbaren Container mit echtem Überlauf haben').not.toBeNull();
		expect(scroller!.scrollWidth, 'Tabellen-Container muss seitlich scrollbar sein').toBeGreaterThan(
			scroller!.clientWidth,
		);

		const pageOverflow = await page.evaluate(() => {
			const el = document.scrollingElement;
			return { scrollWidth: el?.scrollWidth ?? 0, clientWidth: el?.clientWidth ?? 0 };
		});
		expect(pageOverflow.scrollWidth, 'die Seite selbst darf nicht horizontal überlaufen').toBeLessThanOrEqual(
			pageOverflow.clientWidth + 1,
		);
	});

	test('AK5: bei 375px bleibt die Funktionsspalte nach seitlichem Scrollen sichtbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });

		await page.goto('/settings/pakete');
		const host = page.locator('[data-testid="plans-section"] kol-table-stateful');
		await expect(host).toBeVisible();

		const measured = await host.evaluate(scrollMatrixAndMeasureFirstCell);
		expect(measured, 'Matrix-Container muss scrollbar sein und eine erste Spaltenzelle haben').not.toBeNull();
		expect(
			measured!.firstCell.left,
			'Funktionsspalte muss nach dem Scrollen innerhalb des Containers stehen',
		).toBeGreaterThanOrEqual(measured!.container.left);
		expect(
			measured!.firstCell.left,
			'Funktionsspalte darf nicht rechts aus dem Container herausgescrollt sein',
		).toBeLessThan(measured!.container.right);
	});

	for (const viewport of [
		{ width: 375, height: 812, label: '375px' },
		{ width: 1280, height: 900, label: '1280px' },
	]) {
		test(`AK6: bei ${viewport.label} bricht keine Kopfzelle auf mehr als zwei Zeilen um`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await mockPlans(page, { ...USER_NO_SUBSCRIPTION, plan: 'pro', subscription: activeSubscription });

			await page.goto('/settings/pakete');
			const host = page.locator('[data-testid="plans-section"] kol-table-stateful');
			await expect(host).toBeVisible();

			const metrics = await host.evaluate(headerCellMetrics);
			// All-Quantor-Schutz (Muster `completed-tasks.spec.ts:289`): ohne gefundene Kopfzellen wäre
			// die Schleife unten leer-mengen-grün.
			expect(metrics.length, 'Matrix muss Kopfzellen haben').toBeGreaterThan(0);
			metrics.forEach((cell, i) => {
				const maxHeight = cell.lineHeight * 2 + cell.paddingTop + cell.paddingBottom;
				expect(cell.height, `Kopfzelle ${i} darf nicht auf mehr als zwei Zeilen umbrechen`).toBeLessThanOrEqual(
					maxHeight + 1,
				);
			});
		});
	}

	test('AK7: /settings/abo ohne laufendes Abo zeigt einen Hinweis mit Bedienmöglichkeit zu Pakete, kein Status/Kündigen im DOM', async ({
		page,
	}) => {
		await mockPlans(page, USER_NO_SUBSCRIPTION);

		await page.goto('/settings/abo');
		await waitForStableView(page, 'Allgemein');
		await expect(page.getByTestId('subscription-status')).toHaveCount(0);
		await expect(page.getByTestId('cancel-subscription')).toHaveCount(0);

		const gotoPlans = page.getByRole('button', { name: /Pakete ansehen/i });
		await expect(gotoPlans).toBeVisible();
		await gotoPlans.click();

		await expect(page).toHaveURL(/\/settings\/pakete$/);
		await expect(page.getByTestId('plans-section')).toBeVisible();
	});
});
