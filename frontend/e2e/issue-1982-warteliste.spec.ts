import type { Page, Route } from '@playwright/test';
import { baseTest as test, expect } from './fixtures';

/**
 * Rote Spec-Tests Warteliste mit Referral-Rang (#1982, Spec docs/spec/issue-1982.md).
 * Nur das Auth-Gate wird gemockt (Muster `login.spec.ts` — echter Google-OAuth-Flow ist in der
 * E2E-Umgebung nicht durchlaufbar); `POST /auth/waitlist` läuft gegen das echte Backend.
 */

const mockUnauthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'Unauthorized' }),
		}),
	);
};

/** `boundingBox()` misst einmalig und wartet nicht nach — in kurzer Schleife nachmessen (MEMORY 2026-09-14). */
const boundingBoxWhenLaidOut = async (page: Page, selector: string): Promise<{ width: number } | null> => {
	for (let i = 0; i < 30; i++) {
		const box = await page.locator(selector).first().boundingBox();
		if (box) {
			return box;
		}
		await page.waitForTimeout(100);
	}
	return null;
};

const eintragen = async (page: Page, email: string): Promise<void> => {
	await page.getByLabel('Auf die Warteliste per E-Mail').fill(email);
	await page.getByRole('button', { name: /Warteliste/ }).click();
};

test.describe('Warteliste (#1982)', () => {
	test('AK5: Eintrag zeigt Position und kopierbaren Empfehlungs-Link', async ({ page }) => {
		await mockUnauthenticated(page);
		await page.goto('/app/');
		await eintragen(page, `warteliste-${Date.now()}@example.com`);

		const status = page.getByRole('status');
		await expect(status).toContainText(/Position \d+/);
		// Empfehlungs-Link ist lesbar sichtbar (nicht nur im Clipboard).
		await expect(status).toContainText(/ref=/);
	});

	test('AK2: über den Empfehlungs-Link geworbene Anmeldung verbessert die Position', async ({ page }) => {
		await mockUnauthenticated(page);
		const stamp = Date.now();
		const werber = `werber-${stamp}@example.com`;
		const gast = `gast-${stamp}@example.com`;

		await page.goto('/app/');
		await eintragen(page, werber);
		const status = page.getByRole('status');
		await expect(status).toContainText(/Position \d+/);
		const vorher = Number((await status.textContent())?.match(/Position (\d+)/)?.[1]);
		const code = (await status.textContent())?.match(/ref=([A-Za-z0-9_-]+)/)?.[1];
		expect(code, 'Empfehlungs-Code im Link lesbar').toBeTruthy();

		// Gast folgt dem persönlichen Link — der Code wird aus der URL übernommen.
		await page.goto(`/app/?ref=${code}`);
		await eintragen(page, gast);
		await expect(page.getByRole('status')).toContainText(/Position \d+/);

		await page.goto('/app/');
		await eintragen(page, werber);
		await expect(status).toContainText(/Position \d+/);
		const nachher = Number((await status.textContent())?.match(/Position (\d+)/)?.[1]);
		expect(nachher, 'Werbende rücken durch die geworbene Anmeldung nach vorn').toBeLessThan(vorher);
	});

	test('AK6: 375 px — Ergebnisblock bricht um statt horizontal zu scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await mockUnauthenticated(page);
		await page.goto('/app/');
		await eintragen(page, `mobil-${Date.now()}@example.com`);

		await expect(page.getByRole('status')).toContainText(/Position \d+/);
		const box = await boundingBoxWhenLaidOut(page, '[role="status"]');
		expect(box, 'Ergebnisblock muss sichtbar vermessen sein').toBeTruthy();
		expect(box!.width, 'kein horizontales Überlaufen des 375px-Viewports').toBeLessThanOrEqual(375);
	});
});
