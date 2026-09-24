import { expect, test } from '@playwright/test';

test.describe('Öffentliche Website', () => {
	test('Startseite führt mit einem Klick in den Google-Login', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Woran solltest du als Nächstes arbeiten?');
		const cta = page.getByRole('link', { name: 'Mit Google starten' }).first();
		await expect(cta).toBeVisible();
		await expect(cta).toHaveAttribute('href', '/auth/google');
		await expect(page.getByRole('link', { name: 'Schon dabei? App öffnen' })).toHaveAttribute('href', '/app/');
		await expect(page.getByRole('link', { name: 'Mit E-Mail anmelden' })).toHaveAttribute('href', '/app/?login=email');
	});

	test('zeigt alle vier Pakete mit Preisen', async ({ page }) => {
		await page.goto('/');
		const pricing = page.locator('#pricing');
		for (const name of ['Free', 'Pro', 'Max', 'Ultimate']) {
			await expect(pricing.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
		}
		await expect(pricing.getByText('7,99 €')).toBeVisible();
	});

	test('Sprachumschalter wechselt zwischen Deutsch und Englisch', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Switch to English' }).click();
		await expect(page).toHaveURL(/\/en\/$/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByRole('link', { name: 'Start with Google' }).first()).toBeVisible();
		await page.getByRole('link', { name: 'Auf Deutsch wechseln' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	});

	test('FAQ klappt ohne JavaScript-Framework auf', async ({ page }) => {
		await page.goto('/');
		const answer = page.getByText('Nur deinen Namen, deine E-Mail-Adresse und dein Profilbild.');
		await expect(answer).toBeHidden();
		await page.getByText('Welche Daten bekommt die App von Google?').click();
		await expect(answer).toBeVisible();
	});

	test('Impressum ist aus dem Footer erreichbar', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('contentinfo').getByRole('link', { name: 'Impressum' }).click();
		await expect(page).toHaveURL(/\/impressum\/$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
	});

	test('kein horizontales Scrollen', async ({ page }) => {
		for (const path of ['/', '/en/', '/impressum/']) {
			await page.goto(path);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
			expect(overflow, path).toBeLessThanOrEqual(0);
		}
	});
});

test.describe('Angemeldete Nutzer', () => {
	test('ohne Merk-Cookie bleibt die Startseite stehen', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Woran solltest du als Nächstes arbeiten?');
	});

	test('mit Merk-Cookie geht es von der Startseite direkt in die App, mit ?web nicht', async ({
		page,
		context,
		baseURL,
	}) => {
		await context.addCookies([{ name: 'bm_signed_in', value: '1', url: baseURL! }]);
		await page.goto('/en/');
		await expect(page).toHaveURL(/\/app\/$/);
		await page.goto('/?web');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Woran solltest du als Nächstes arbeiten?');
	});
});
