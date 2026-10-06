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

/** Website-Seite der Rechtstexte; im E2E-Setup wird sie nicht ausgeliefert (statischer Inhalt, kein App-Endpunkt). */
const mockLegalPage = (page: Page, pattern: string, body: string): Promise<unknown> =>
	page.route(pattern, (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'text/html',
			body: `<html><body><header>Website-Kopf</header><main id="main"><h1>Titel</h1>${body}</main></body></html>`,
		}),
	);

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

	test('#2227 AK1/AK4: Rechtstext im Schritt lesen, ohne neuen Tab, Einwilligung wie bisher', async ({
		page,
		context,
	}) => {
		const mock = await mockConsent(page);
		await mockLegalPage(page, '**/nutzungsbedingungen/', '<p>Konto-Text der Nutzungsbedingungen</p>');
		let newPages = 0;
		context.on('page', () => (newPages += 1));
		await page.goto('/app/');

		await page.getByText('Nutzungsbedingungen lesen').click();
		await expect(page.getByText('Konto-Text der Nutzungsbedingungen')).toBeVisible();
		expect(newPages).toBe(0);
		await expect(page.locator('a[target="_blank"]')).toHaveCount(0);

		await page.getByRole('checkbox').nth(0).check();
		await page.getByRole('checkbox').nth(1).check();
		await page.getByText('Nutzungsbedingungen lesen').click();
		await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
		await page.getByRole('button', { name: 'Weiter' }).click();
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		expect(mock.saves()).toBe(1);
		expect(newPages).toBe(0);
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

	test('#2227 AK5: bei 375 px kein horizontaler Überlauf, „Weiter“ erreichbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await mockConsent(page);
		const long = 'Gesamtbetragsfeststellungsverordnungsdurchführungsbestimmung'.repeat(3);
		await mockLegalPage(
			page,
			'**/nutzungsbedingungen/',
			`<p>${long}</p><table><tr><th>Paket</th><th>Preis</th><th>Laufzeit</th><th>Kuendigung</th><th>Hinweis</th><th>Extra</th></tr><tr><td>Plus monatlich</td><td>4,99 EUR</td><td>1 Monat</td><td>jederzeit</td><td>inklusive Steuern</td><td>keine</td></tr></table>`,
		);
		await page.goto('/app/');
		await page.getByText('Nutzungsbedingungen lesen').click();

		const word = page.getByText(long);
		await expect(word).toBeVisible();
		const inside = async (locator: ReturnType<Page['locator']>): Promise<void> => {
			const box = await locator.boundingBox();
			expect(box, 'Element muss ein Layout haben').not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375);
		};
		await inside(word);
		await inside(page.locator('table').locator('..'));

		const weiter = page.getByRole('button', { name: 'Weiter' });
		await weiter.scrollIntoViewIfNeeded();
		await inside(weiter);
		await inside(page.getByRole('checkbox').nth(0));
		await page.getByRole('checkbox').nth(0).check();
		await page.getByRole('checkbox').nth(1).check();
		await expect(weiter).toBeEnabled();
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
