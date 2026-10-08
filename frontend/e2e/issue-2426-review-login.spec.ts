import { expect, test, type Page } from '@playwright/test';

/**
 * Rote End-to-End-Spec für #2426 — Prüfzugang für Google Play (AK6, AK7, AK8).
 * Vertrag: docs/spec/issue-2426.md. Echtes Backend mit `PLAY_REVIEW_PASSWORD` (playwright.config.ts);
 * nur `/auth/me` wird bis zum erfolgreichen Prüf-Login als 401 gemockt, weil das E2E-Backend im
 * Pass-Through-Modus sonst jeden Besucher als angemeldet meldet.
 * Inhalte des Dialogs über den `kol-dialog`-Host: Der native `<dialog>` liegt im Shadow-DOM, die
 * geslotteten Felder sind keine Nachfahren davon; Sichtbarkeit und Maße am nativen `dialog[open]`.
 */
const PASSWORD = 'e2e-review-secret';

test.describe('Balamentum — Prüfzugang Google Play (#2426)', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	const gotoLogin = async (page: Page): Promise<void> => {
		let loggedIn = false;
		page.on('response', (response) => {
			if (response.url().includes('/auth/review-login') && response.ok()) {
				loggedIn = true;
			}
		});
		await page.route('**/auth/me', (route) =>
			loggedIn
				? route.continue()
				: route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
		);
		await page.goto('/app/');
		await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
	};

	const tapLogo = async (page: Page, times: number): Promise<void> => {
		for (let i = 0; i < times; i += 1) {
			await page.getByAltText('Balamentum').click();
		}
	};

	test('AK6: 6 Taps öffnen nichts, 7 Taps öffnen den Dialog mit genau einem Passwortfeld', async ({ page }) => {
		await gotoLogin(page);
		await expect(page.locator('input[type="password"]')).toHaveCount(0);

		await tapLogo(page, 6);
		await expect(page.locator('dialog[open]')).toHaveCount(0);

		await tapLogo(page, 1);
		await expect(page.locator('dialog[open]')).toBeVisible();
		await expect(page.locator('kol-dialog input[type="password"]')).toHaveCount(1);
	});

	test('AK7: falsches Passwort zeigt Fehler im Dialog, korrektes führt ins Dashboard', async ({ page }) => {
		await gotoLogin(page);
		await tapLogo(page, 7);
		const password = page.locator('kol-dialog input[type="password"]');

		await password.fill('falsch');
		await page.locator('kol-dialog').getByRole('button', { name: 'Anmelden' }).click();
		await expect(page.locator('kol-dialog [role="alert"]')).toBeVisible();

		await password.fill(PASSWORD);
		await page.locator('kol-dialog').getByRole('button', { name: 'Anmelden' }).click();
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	});

	test('AK8: bei 375 px ist der Dialog vollständig sichtbar, Touch-Targets ≥ 44 px', async ({ page }) => {
		await gotoLogin(page);
		await tapLogo(page, 7);
		const dialog = page.locator('dialog[open]');
		await expect(dialog).toBeVisible();

		const box = await dialog.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);

		const content = page.locator('kol-dialog');
		for (const target of [
			content.locator('input[type="password"]'),
			content.getByRole('button', { name: 'Anmelden' }),
		]) {
			const targetBox = await target.boundingBox();
			expect(targetBox).not.toBeNull();
			expect(targetBox!.height).toBeGreaterThanOrEqual(44);
			expect(targetBox!.x + targetBox!.width).toBeLessThanOrEqual(375);
		}
	});
});
