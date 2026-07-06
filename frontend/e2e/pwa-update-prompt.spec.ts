import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * E2E-Smoke-Test (#353) für den PWA-Update-Prompt — Mobile-First (375px).
 *
 * **Warum kein echter SW-Update-Zyklus getestet wird:** Der Update-Fluss (registerType: 'prompt')
 * hängt an einem echten Service-Worker-Lebenszyklus: Ein neuer SW muss gebaut, installiert und in
 * den `waiting`-Zustand versetzt werden, damit `needRefresh` true wird. In Playwright ist das weder
 * deterministisch noch stabil reproduzierbar (Build-Hash-Wechsel, Registrierungs-Timing, Caching).
 * Der reale Update-Zyklus wird daher in den Vitest-Unit-Tests (UpdatePrompt.test.tsx) über den
 * gemockten `useRegisterSW`-Hook abgedeckt. Hier verifizieren wir stattdessen die Mobile-First-
 * Anforderung visuell: Die App lädt bei 375px ohne horizontalen Overflow.
 */

/** Antwortet auf `GET /auth/me` mit 200 + User → die App zeigt die Haupt-App. */
const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, name: 'Test User', email: 'test@example.com' }),
		}),
	);
};

test.describe('Priority Pilot — PWA Update-Prompt Mobile-First (#353)', () => {
	// AK6 — Mobile-First (375px): kein horizontaler Overflow.
	test('AK6: App lädt bei 375px ohne horizontalen Overflow', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		// Sicherstellen, dass die Haupt-App gerendert ist, bevor wir die Layout-Breite prüfen.
		await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toBeVisible();

		// Bei 375px darf das Dokument nicht breiter als der Viewport sein (kein horizontaler Scroll).
		const { scrollWidth, clientWidth } = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
		}));

		expect(clientWidth).toBeLessThanOrEqual(375);
		// Kleine Toleranz (1px) gegen Sub-Pixel-Rundung; echter Overflow wäre deutlich größer.
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
	});
});
