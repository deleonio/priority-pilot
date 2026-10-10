import { expect, test, type Page } from '@playwright/test';
import { dismissOnboardingDialog } from './fixtures';

/**
 * Rote End-to-End-Spec für #2471 — Demo-Hinweis für das Play-Prüfkonto (AK3–AK6).
 * Vertrag: docs/spec/issue-2471.md. Prüf-Login nach dem Muster issue-2426-review-login.spec.ts
 * (7 Logo-Taps + Passwort); `/auth/me` wird bis zum erfolgreichen Prüf-Login als 401 gemockt
 * (das E2E-Backend läuft im Pass-Through-Modus und meldet sonst jeden Besucher als angemeldet)
 * und danach unverändert durchgereicht — `demoHint` kommt live aus dem E2E-Backend
 * (`DEMO_HINT_ENABLED=true` in playwright.config.ts; Test-Pflege lt. Spec-Doku).
 */
const PASSWORD = 'e2e-review-secret';
const MARKER = 'pp_demo_hint_dismissed';

test.describe('Balamentum — Demo-Hinweis Play-Prüfkonto (#2471)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	const gotoLogin = async (page: Page): Promise<void> => {
		let loggedIn = false;
		page.on('response', (response) => {
			if (response.url().includes('/auth/review-login') && response.ok()) {
				loggedIn = true;
			}
			// Test-Pflege (Impl): nach dem Logout (AK4) meldet das Pass-Through-Backend ohne Mock 200
			// („Lokaler Modus") statt 401 — der Mock muss wieder greifen, sonst erscheint keine
			// Login-Seite und der erneute Prüf-Login ist unmöglich.
			if (response.url().includes('/auth/logout')) {
				loggedIn = false;
			}
		});
		await page.route('**/auth/me', async (route) => {
			if (!loggedIn) {
				await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' });
				return;
			}
			// Nach dem Prüf-Login: echte Antwort durchreichen (demoHint aus dem E2E-Backend).
			await route.fallback();
		});
		await page.goto('/app/');
		await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
	};

	// Test-Pflege (Impl, erstmaliger Live-Lauf): der Willkommens-Dialog sperrt als Modal alle
	// Klicks auf die Card dahinter — Repo-Muster `dismissOnboardingDialog` (Präzedenz
	// groups-foreign-task.spec.ts) schließt ihn per Init-Skript, sobald er aufgeht.
	const reviewLogin = async (page: Page): Promise<void> => {
		await dismissOnboardingDialog(page);
		for (let i = 0; i < 7; i += 1) {
			await page.getByAltText('Balamentum').click();
		}
		await page.locator('kol-dialog input[type="password"]').fill(PASSWORD);
		await page.locator('kol-dialog').getByRole('button', { name: 'Anmelden' }).click();
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	};

	test('AK3/AK4/AK5: X blendet bis zum Session-Ende aus, neuer Prüf-Login zeigt die Card wieder', async ({ page }) => {
		await gotoLogin(page);
		await reviewLogin(page);
		const card = page.getByTestId('demo-hint');
		await expect(card).toBeVisible();

		await card.getByRole('button', { name: 'Schließen' }).click();
		await expect(page.getByTestId('demo-hint')).toHaveCount(0);
		expect(await page.evaluate((key) => sessionStorage.getItem(key), MARKER)).toBe('1');

		await page.reload();
		await expect(page.getByTestId('demo-hint')).toHaveCount(0);

		const demoLocalKeys = await page.evaluate(() =>
			Object.keys(localStorage).filter((key) => key.toLowerCase().includes('demo')),
		);
		expect(demoLocalKeys).toEqual([]);

		await page.getByRole('button', { name: 'Abmelden' }).click();
		await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
		await reviewLogin(page);
		await expect(page.getByTestId('demo-hint')).toBeVisible();
	});

	test('AK6: bei 375 px vollständig sichtbar, X ≥ 44 px Touch-Target', async ({ page }) => {
		await gotoLogin(page);
		await reviewLogin(page);
		const card = page.getByTestId('demo-hint');
		await expect(card).toBeVisible();

		const box = await card.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		const closeBox = await card.getByRole('button', { name: 'Schließen' }).boundingBox();
		expect(closeBox).not.toBeNull();
		expect(closeBox!.height).toBeGreaterThanOrEqual(44);
		expect(closeBox!.width).toBeGreaterThanOrEqual(44);
	});
});
