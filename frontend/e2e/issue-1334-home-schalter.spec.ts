import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1334 „Home-Schalter zum Dashboard" (Vertrag: `docs/spec/issue-1334.md`).
 *
 * Ziel: Aus jeder Ansicht (Aufgaben, Serien, Wald, Einstellungen) führt ein eindeutig als
 * „Home/Dashboard" erkennbares Bedienelement mit einem Klick zurück zum Dashboard (`/`). Der
 * bestehende Logo-Button (`.logo-btn`, `App.tsx:723`) bleibt Träger der Funktion, wird aber um
 * ein Home-Icon (`fa-solid fa-house`) ergänzt, damit er kein reines Markenlogo mehr ist (AK2).
 *
 * Diese Tests sind **rot**, bis `App.tsx` den Home-Icon-Baustein ergänzt — der Locator
 * `homeSwitch()` verlangt genau dieses Icon-Element und findet vor der Implementierung nichts.
 */

/** Home-Schalter: Button „…Dashboard" im Banner, der zusätzlich ein Home-Icon trägt (AK2). */
const homeSwitch = (page: import('@playwright/test').Page) =>
	page
		.getByRole('banner')
		.getByRole('button', { name: /Dashboard/i })
		.filter({ has: page.locator('.fa-house, [class*="fa-house"], kol-icon[_icons*="house"]') });

test.describe('#1334 Home-Schalter zum Dashboard', () => {
	/**
	 * AK1 — Von Aufgaben/Serien/Wald/Einstellungen führt genau ein Klick auf den Home-Schalter
	 * nach `/`; danach ist der Dashboard-Tab aktiv.
	 */
	for (const path of ['/aufgaben', '/serien', '/wald', '/settings/allgemein']) {
		test(`AK1: Home-Schalter navigiert von ${path} zum Dashboard`, async ({ page }) => {
			await page.goto(path);
			await waitForStableView(page, path.startsWith('/settings') ? 'Einstellungen' : undefined);

			await homeSwitch(page).click();

			await expect(page).toHaveURL(/\/$/);
			const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
			await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
		});
	}

	/**
	 * AK2 — Der Home-Schalter ist über Rolle `button` mit Accessible Name „…Dashboard…"
	 * erreichbar und trägt ein Home-Icon (kein reines Markenlogo mehr).
	 */
	test('AK2: Home-Schalter ist sichtbar, benannt und trägt ein Home-Icon', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const el = homeSwitch(page);
		await expect(el).toBeVisible();
		await expect(el).toHaveAccessibleName(/Dashboard/i);
	});

	/**
	 * AK3 — Mobile-First (375px): der Home-Schalter bleibt >= 44x44 CSS-Pixel groß, die
	 * Kopfzeile bleibt einzeilig, kein horizontaler Overflow.
	 */
	test('AK3: Home-Schalter erfüllt Touch-Target-Maß, Kopfzeile bleibt einzeilig (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const el = homeSwitch(page);
		await expect(el).toBeVisible();

		const box = await el.boundingBox();
		expect(box).not.toBeNull();
		if (box === null) return;
		expect(box.width, 'Home-Schalter Trefferbereich >= 44px breit').toBeGreaterThanOrEqual(44);
		expect(box.height, 'Home-Schalter Trefferbereich >= 44px hoch').toBeGreaterThanOrEqual(44);

		const header = page.locator('.app-header');
		const headerBox = await header.boundingBox();
		expect(headerBox).not.toBeNull();
		if (headerBox === null) return;
		expect(headerBox.height, 'Kopfzeile darf auf 375px nicht umbrechen').toBeLessThanOrEqual(64);

		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);
	});
});
