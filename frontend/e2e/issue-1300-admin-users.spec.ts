import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { measureHorizontalScroll, waitForStableView } from './helpers';

/**
 * E2E-Spec für das Rollensystem admin/member (Fixup PR #1300, Finding #3): Tab „Nutzerverwaltung"
 * bei 375px — Sichtbarkeit je Rolle und Rollenwechsel-Button ohne horizontalen Überlauf.
 *
 * `/auth/me` und die `/admin/users`-Endpunkte werden gemockt (Muster `fixtures.ts`): Die
 * Backend-Autorisierung selbst deckt `server/src/express/admin.api.test.ts` ab, hier geht es
 * um den Frontend-Vertrag (Tab-Sichtbarkeit, Layout bei 375px).
 */

const MOBILE = { width: 375, height: 812 } as const;

const ADMIN_USER = { id: 1, displayName: 'Anna Admin', email: 'anna@example.com', role: 'admin' as const };
const MEMBER_USER = { id: 2, displayName: 'Test User', email: 'test@example.com', role: 'member' as const };

const mockAuthMe = async (page: Page, user: { id: number; displayName: string; email: string; role: string }) => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
	);
};

const mockAdminUsers = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/admin/users', (route: Route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([
				{ ...ADMIN_USER, createdAt: '2026-01-01T00:00:00Z' },
				{ ...MEMBER_USER, createdAt: '2026-01-02T00:00:00Z' },
			]),
		});
	});
	await page.route('**/api/v1/admin/users/*/role', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ ...MEMBER_USER, role: 'admin', createdAt: '2026-01-02T00:00:00Z' }),
		}),
	);
};

test.describe('#1300 Rollensystem admin/member — Tab „Nutzerverwaltung" bei 375px', () => {
	test('Member sieht den Tab „Nutzerverwaltung" nicht', async ({ page }) => {
		await mockAuthMe(page, MEMBER_USER);
		await page.setViewportSize(MOBILE);
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('tab', { name: 'Nutzerverwaltung' })).toHaveCount(0);
	});

	test('Admin sieht den Tab „Nutzerverwaltung", die Nutzerliste lädt ohne horizontalen Überlauf', async ({ page }) => {
		await mockAuthMe(page, ADMIN_USER);
		await mockAdminUsers(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/settings/nutzer');
		await waitForStableView(page, 'Priority Pilot');

		const tab = page.getByRole('tab', { name: 'Nutzerverwaltung' });
		await expect(tab).toBeVisible();
		await expect(tab).toHaveAttribute('aria-selected', 'true');

		await expect(page.getByText('Anna Admin')).toBeVisible();
		await expect(page.getByText('Test User')).toBeVisible();

		const roleButton = page.getByRole('button', { name: 'Test User zum Administrator machen' });
		await expect(roleButton).toBeVisible();
		const box = await roleButton.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.height, 'Rollenwechsel-Button mindestens 44px hoch (Touch-Target)').toBeGreaterThanOrEqual(44 - 0.5);

		const panel = page.locator('.settings-admin-users');
		const { scroller } = await panel.evaluate(measureHorizontalScroll);
		expect(scroller, 'kein horizontaler Scroll-Container im Nutzerverwaltungs-Panel bei 375px').toBeNull();

		await roleButton.click();
		await expect(page.getByRole('button', { name: 'Test User zur Mitgliedschaft zurückstufen' })).toBeVisible();
	});
});
