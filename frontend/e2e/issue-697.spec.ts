import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { onboardingDismissKey } from '../src/lib/onboardingPreferences';

/**
 * Rote Spec-Tests für Issue 697: Auth Field-Mismatch zwischen AuthUser.name und API displayName.
 *
 * Spec: docs/spec/issue-697.md
 * Akzeptanzkriterium: Header zeigt nach Login den korrekten User-Namen an, Field-Name konsistent.
 *
 * Hintergrund: Die echte API /auth/me liefert `displayName`; das Frontend-Interface
 * wurde entsprechend angepasst, sodass diese Tests den Fix absichern.
 */

/**
 * Mock der echten /auth/me Response mit displayName (so wie die API tatsächlich liefert).
 */
const mockMeWithDisplayName = async (
	page: Page,
	user: { id: number; displayName: string; email: string },
): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(user),
		}),
	);
};

test.describe('Issue 697 — Auth Field-Mismatch (Spec: issue-697.md)', () => {
	test.beforeEach(async ({ page }) => {
		// Onboarding vorab als beendet markieren (#2580-Muster): Der Willkommens-Dialog
		// würde sonst den Klick auf den Menü-Trigger abfangen.
		await page.addInitScript((key: string) => {
			try {
				localStorage.setItem(key, 'true');
			} catch {
				/* ignore */
			}
		}, onboardingDismissKey(1));
	});

	test('AK1: Header zeigt User-Namen aus displayName (nicht aus name)', async ({ page }) => {
		// Mock der echten API-Response: displayName statt name
		await mockMeWithDisplayName(page, {
			id: 1,
			displayName: 'Max Mustermann',
			email: 'max@example.com',
		});
		await page.goto('/app/');

		// #2741: Der Name steht im Benutzermenü (der Trigger zeigt nur Initialen) — Menü öffnen und
		// den Namen gescoped auf seinen Textknoten prüfen (der Panel-Avatar trägt ihn ebenfalls).
		await page.locator('.app-header__user button').first().click();
		const menuName = page.locator('.app-header__user-menu-name');
		await expect(menuName).toBeVisible();
		await expect(menuName).toHaveText('Max Mustermann');
	});

	test('AK2: AuthUser-Interface matcht API-Response displayName', async ({ page }) => {
		// Mock der echten API-Response mit displayName
		await mockMeWithDisplayName(page, {
			id: 1,
			displayName: 'Test User',
			email: 'test@example.com',
		});
		await page.goto('/app/');

		// #2741: Field-Name konsistent — geprüft im Benutzermenü (siehe AK1).
		await page.locator('.app-header__user button').first().click();
		const menuName = page.locator('.app-header__user-menu-name');
		await expect(menuName).toBeVisible();
		await expect(menuName).toHaveText('Test User');
	});
});
