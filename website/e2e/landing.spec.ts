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

	test('zeigt alle drei Pakete mit Preisen', async ({ page }) => {
		await page.goto('/');
		const pricing = page.locator('#pricing');
		for (const name of ['Free', 'Plus', 'Pro']) {
			await expect(pricing.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
		}
		await expect(pricing.getByText('4,99 €')).toBeVisible();
	});

	test('Preiskarten zeigen Monat, Quartal und Jahr ohne Überlauf (#1786)', async ({ page }) => {
		await page.goto('/');
		const pricing = page.locator('#pricing');
		await pricing.scrollIntoViewIfNeeded();
		await expect(pricing.locator('[data-plan]')).toHaveCount(3);
		for (const price of ['4,99 €', '13,47 €', '47,90 €', '9,99 €', '26,97 €', '95,90 €']) {
			await expect(pricing.getByText(price).first()).toBeVisible();
		}
		const viewport = page.viewportSize()?.width ?? 0;
		for (const card of await pricing.locator('[data-plan]').all()) {
			const box = await card.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(viewport);
		}
	});

	test('Plus/Pro zeigen das Monatsäquivalent der Jahreszahlung ohne Überlauf, Free nicht (#1898)', async ({ page }) => {
		await page.goto('/');
		const pricing = page.locator('#pricing');
		await pricing.scrollIntoViewIfNeeded();
		await expect(pricing.locator('[data-plan="free"]').getByText(/3,99|7,99/)).toHaveCount(0);
		const viewport = page.viewportSize()?.width ?? 0;
		for (const [plan, amount] of [
			['plus', '3,99 €'],
			['pro', '7,99 €'],
		]) {
			const hint = pricing.locator(`[data-plan="${plan}"]`).getByText(amount);
			await expect(hint).toBeVisible();
			const box = await hint.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(viewport);
		}
	});

	test('Sprachwahl im Kopf führt in alle zehn Sprachen', async ({ page }) => {
		const header = page.getByRole('banner');
		await page.goto('/');
		const menu = header.locator('.lang-menu summary');
		await menu.click();
		await expect(header.locator('.lang-menu__list').getByRole('link')).toHaveCount(10);
		await header.getByRole('link', { name: 'Français' }).click();
		await expect(page).toHaveURL(/\/fr\/$/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
		await menu.click();
		await header.getByRole('link', { name: 'English' }).click();
		await expect(page).toHaveURL(/\/en\/$/);
		await expect(page.getByRole('link', { name: 'Start with Google' }).first()).toBeVisible();
		await page.getByRole('contentinfo').getByRole('link', { name: 'Deutsch' }).click();
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

	test('Konto löschen ist aus dem Footer erreichbar (#1681)', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('contentinfo').getByRole('link', { name: 'Konto löschen' }).click();
		await expect(page).toHaveURL(/\/konto-loeschen\/$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Konto löschen' })).toBeVisible();
	});

	test('Datenschutz ist aus dem Footer erreichbar (#1672)', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('contentinfo').getByRole('link', { name: 'Datenschutz' }).click();
		await expect(page).toHaveURL(/\/datenschutz\/$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeVisible();
	});

	test('Nutzungsbedingungen: Footer-Link auf 375 px sichtbar, antippbar und erreichbar (#1891)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await page.goto('/');
		const link = page.getByRole('contentinfo').getByRole('link', { name: 'Nutzungsbedingungen' });
		await link.scrollIntoViewIfNeeded();
		const box = await link.boundingBox();
		expect(box, 'Bounding-Box').not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		expect(box!.height).toBeGreaterThanOrEqual(24);
		await link.click();
		await expect(page).toHaveURL(/\/nutzungsbedingungen\/$/);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('kein horizontales Scrollen', async ({ page }) => {
		for (const path of [
			'/',
			'/en/',
			'/es/',
			'/fr/',
			'/it/',
			'/nl/',
			'/pl/',
			'/pt/',
			'/ru/',
			'/sv/',
			'/impressum/',
			'/konto-loeschen/',
			'/datenschutz/',
			'/nutzungsbedingungen/',
			'/ru/delete-account/',
		]) {
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
