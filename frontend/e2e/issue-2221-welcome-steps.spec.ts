import type { Route } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2221 (docs/spec/issue-2221.md): Einstieg „Erste Schritte“ im Dashboard
 * nach dem Onboarding-Flow. Eigene Session je Test (Shard-sicher), echtes Backend.
 */

const STEPS = '[data-testid="welcome-steps"]';

/** Frischer Nutzer, der den Onboarding-Flow mit „Später“ abschließt (ai_assist freigeschaltet wie onboarding-flow.spec.ts). */
const finishOnboarding = async (page: Page): Promise<void> => {
	await registerOwnSession(page, 'welcome-2221');
	await page.unroute('**/auth/me');
	await page.route('**/auth/me', async (route: Route) => {
		const response = await route.fetch();
		const user = (await response.json()) as { entitlements?: Record<string, unknown> };
		await route.fulfill({
			response,
			json: { ...user, entitlements: { ...user.entitlements, ai_assist: { allowed: true, requiredPlan: 'pro' } } },
		});
	});
	await page.goto('/app/');
	await waitForStableView(page);
	await page.locator('.onboarding-flow').getByRole('button', { name: 'Später' }).click();
};

test.describe('#2221 Einstieg Erste Schritte', () => {
	test('AK1+AK3: nach dem Onboarding sichtbar, nach Schließen und Reload nicht mehr', async ({ page }) => {
		await finishOnboarding(page);
		const steps = page.locator(STEPS);
		await expect(steps).toBeVisible();
		expect(await steps.locator('li[data-step]').count()).toBeGreaterThanOrEqual(2);
		await steps.getByRole('button', { name: /Einstieg schließen/i }).click();
		await expect(steps).toHaveCount(0);
		await page.reload();
		await waitForStableView(page);
		await expect(page.locator(STEPS)).toHaveCount(0);
	});

	test('AK4: Konto mit Aufgaben ohne Onboarding sieht den Einstieg nicht', async ({ page }) => {
		await registerOwnSession(page, 'welcome-2221-alt');
		const created = await page.request.post('/api/v1/tasks', { data: { title: 'Bestandsaufgabe' } });
		expect(created.ok()).toBe(true);
		await page.goto('/app/');
		await waitForStableView(page);
		await expect(page.locator(STEPS)).toHaveCount(0);
	});

	test('AK5: bei 375px vollständig im Viewport, Schließen ≥ 44 px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await finishOnboarding(page);
		const steps = page.locator(STEPS);
		await expect(steps).toBeVisible();
		const box = await steps.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		const close = await steps.getByRole('button', { name: /Einstieg schließen/i }).boundingBox();
		expect(close!.height).toBeGreaterThanOrEqual(44);
	});
});
