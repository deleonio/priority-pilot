import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

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
	test('AK1: Header zeigt User-Namen aus displayName (nicht aus name)', async ({ page }) => {
		// Mock der echten API-Response: displayName statt name
		await mockMeWithDisplayName(page, {
			id: 1,
			displayName: 'Max Mustermann',
			email: 'max@example.com',
		});
		await page.goto('/');

		// Spec-Beitrag: Header zeigt den korrekten User-Namen an
		await expect(page.getByText('Max Mustermann')).toBeVisible();
	});

	test('AK2: AuthUser-Interface matcht API-Response displayName', async ({ page }) => {
		// Mock der echten API-Response mit displayName
		await mockMeWithDisplayName(page, {
			id: 1,
			displayName: 'Test User',
			email: 'test@example.com',
		});
		await page.goto('/');

		// Spec-Beitrag: Field-Name konsistent zwischen Interface und Rendering
		await expect(page.getByText('Test User')).toBeVisible();
	});
});
