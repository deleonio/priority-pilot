import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Rote Spec-Tests für Issue 697: Auth Field-Mismatch zwischen AuthUser.name und API displayName.
 *
 * Spec: docs/spec/issue-697.md
 * Akzeptanzkriterium: Header zeigt nach Login den korrekten User-Namen an, Field-Name konsistent.
 *
 * Hintergrund: Die echte API /auth/me liefert `displayName`, aber Frontend-Interface verwendet `name`.
 * Dieser Test mockt die ECHTE API-Response (mit displayName) → Test wird rot bis zum Fix.
 */

/**
 * Mock der echten /auth/me Response mit displayName (so wie die API tatsächlich liefert).
 * Dieser Mock verwendet displayName statt name → macht App.tsx rot, das user.name erwartet.
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
		// Dieser Test wird rot, weil App.tsx user.name erwartet (leer) statt user.displayName
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
		// Dieser Test wird rot, weil AuthUser.name existiert, aber API displayName liefert
		await expect(page.getByText('Test User')).toBeVisible();
	});
});
