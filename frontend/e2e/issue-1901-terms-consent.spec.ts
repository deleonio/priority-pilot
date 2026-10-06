import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Zustimmungsschritt nach dem Login (#1901, docs/spec/issue-1901.md). Gemockt sind nur `/auth/me`
 * (Login ist in der E2E-Umgebung nicht durchlaufbar) und `POST /auth/terms`; der Zustand
 * `termsAccepted` wird wie im Server nach dem Speichern umgeschaltet.
 */

const USER = { id: 1, displayName: 'Test User', email: 'test@example.com', plan: 'free' };

/** Liefert `{ accepted }`-Zustand und zählt Speicheraufrufe; Neukonto und Bestandskonto ohne Zustimmung sind für den Client identisch. */
const mockConsent = async (page: Page): Promise<{ saves: () => number }> => {
	let accepted = false;
	let saves = 0;
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ ...USER, termsAccepted: accepted }),
		}),
	);
	await page.route('**/auth/terms', (route: Route) => {
		saves += 1;
		accepted = true;
		return route.fulfill({ status: 204 });
	});
	return { saves: () => saves };
};

test.describe('#1901 — Zustimmungsschritt', () => {
	test('AK4/AK6: Schritt vor dem Dashboard, „Weiter“ erst mit beiden Haken, danach nie wieder', async ({ page }) => {
		const mock = await mockConsent(page);
		await page.goto('/app/');

		const weiter = page.getByRole('button', { name: 'Weiter' });
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeHidden();
		await expect(weiter).toBeDisabled();

		const boxes = page.getByRole('checkbox');
		await boxes.nth(0).check();
		await expect(weiter).toBeDisabled();
		await boxes.nth(1).check();
		await expect(weiter).toBeEnabled();
		await weiter.click();

		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		expect(mock.saves()).toBe(1);

		await page.reload();
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Weiter' })).toBeHidden();
	});

	test('AK5: Links führen zu /nutzungsbedingungen/ und /datenschutz/', async ({ page }) => {
		await mockConsent(page);
		await page.goto('/app/');
		await expect(page.getByRole('link', { name: /Nutzungsbedingungen/ })).toHaveAttribute(
			'href',
			'/nutzungsbedingungen/',
		);
		await expect(page.getByRole('link', { name: /Datenschutzerklärung/ })).toHaveAttribute('href', '/datenschutz/');
	});

	test('AK7: bei 375 px ohne Scrollen sichtbar und per Tastatur bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockConsent(page);
		await page.goto('/app/');

		const boxes = page.getByRole('checkbox');
		const weiter = page.getByRole('button', { name: 'Weiter' });
		await expect(weiter).toBeVisible();
		for (const el of [boxes.nth(0), boxes.nth(1), weiter]) {
			const box = await el.boundingBox();
			expect(box, 'Element muss ein Layout haben').not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
			expect(box!.y + box!.height).toBeLessThanOrEqual(812);
		}

		// Tab-Reihenfolge erreicht Haken 1, Haken 2 und „Weiter“; Leertaste toggelt, Enter löst aus.
		await boxes.nth(0).focus();
		await page.keyboard.press('Space');
		await boxes.nth(1).focus();
		await page.keyboard.press('Space');
		await expect(boxes.nth(0)).toBeChecked();
		await expect(boxes.nth(1)).toBeChecked();
		await weiter.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	});

	test('#2226 AK3/AK6: englische Sprache zeigt den Rechtstext-Hinweis bei 375 px ohne Überlauf', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockConsent(page);
		await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
		await page.goto('/app/');
		const hint = page.getByText(/only (available )?in German|German version/i).first();
		await expect(hint).toBeVisible();
		const box = await hint.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		for (const link of await page.getByRole('link').all()) await expect(link).toHaveAttribute('hreflang', 'de');
	});
});
