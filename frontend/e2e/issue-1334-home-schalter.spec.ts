import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #1334 „Home-Schalter zum Dashboard" (Vertrag: `docs/spec/issue-1334.md`, inzwischen
 * per Notiz superseded).
 *
 * Ziel: Aus jeder Ansicht (Aufgaben, Serien, Wald, Einstellungen) führt ein eindeutig als
 * „Home/Dashboard" erkennbares Bedienelement mit einem Klick zurück zum Dashboard (`/`). Der
 * Home-Schalter ist der **erste Button der Kopf-Aktionen-Toolbar** (nicht mehr implizit am
 * Logo, siehe `header-logo.spec.ts`) und trägt ein Home-Icon (`fa-solid fa-house`).
 */

/** Home-Schalter: erster Button der Kopf-Aktionen-Toolbar mit Accessible Name „…Dashboard…" (AK2). */
const homeSwitch = (page: import('@playwright/test').Page) =>
	page
		.getByRole('banner')
		.getByRole('toolbar', { name: /Kopf-Aktionen/i })
		.getByRole('button', { name: /Dashboard/i });

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
	 * AK2 (Tastatur) — der Home-Schalter ist als erster Toolbar-Button auch per Tastatur (Enter)
	 * auslösbar; das Logo selbst bietet inzwischen (wieder) eine gleichwertige Klick-Route zum
	 * Dashboard (siehe `header-logo.spec.ts`), zusätzlich zu diesem Home-Schalter.
	 */
	test('AK2: Home-Schalter navigiert per Enter-Taste zum Dashboard', async ({ page }) => {
		await page.goto('/aufgaben');
		await waitForStableView(page);

		await homeSwitch(page).focus();
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/$/);
		const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
		await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
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
