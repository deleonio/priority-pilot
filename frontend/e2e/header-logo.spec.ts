import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #395 „Klickbare Bild-Marke im Header (Link zum Dashboard)"
 * (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel: Im Header erscheint links oben ein Logo-Bild als barrierefreier Button „Zum Dashboard".
 * Ein Klick darauf aktiviert den Dashboard-Tab (Index 0). Die bestehende H1 „Priority Pilot" bleibt
 * erhalten. Auf 375px-Viewport kein horizontaler Overflow.
 *
 * Diese Tests sind **rot**, bis App.tsx das Logo ergänzt und die KolTabs kontrolliert macht
 * (`_selected={activeTab}`). Sie prüfen reines UI-Verhalten gegen das echte Backend.
 */
test.describe('#395 Header – Logo-Button', () => {
	/**
	 * AK1 — Logo sichtbar, links oben: Im Header-Banner ist ein Button „Zum Dashboard"
	 * mit Logo-Bild sichtbar.
	 */
	test('AK1: Logo-Button ist im Header sichtbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();

		// Der Logo-Button muss im Header vorhanden und sichtbar sein.
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		// Das Logo-Bild ist ein Kind des Buttons.
		const logoImg = logoBtn.locator('img');
		await expect(logoImg).toBeVisible();
	});

	/**
	 * AK2 — Klick führt zum Dashboard: Beim Klick auf den Logo-Button wird der Dashboard-Tab
	 * (Index 0) aktiviert und der Dashboard-Inhalt sichtbar.
	 */
	test('AK2: Logo-Klick aktiviert den Dashboard-Tab', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		// Zuerst einen anderen Tab wählen (Aufgaben, Index 1), um die Umschaltung zu prüfen.
		// Exact-Match nötig: /Aufgaben/i würde auch "Aufgabenwald" und "Erledigte Aufgaben" treffen.
		const aufgabenTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await aufgabenTab.click();
		await expect(aufgabenTab).toHaveAttribute('aria-selected', 'true');

		// Logo-Button klicken.
		const header = page.getByRole('banner');
		await header.getByRole('button', { name: /Zum Dashboard/i }).click();

		// Dashboard-Tab muss aktiv sein.
		const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
		await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
	});

	/**
	 * AK3 — Barrierefrei bedienbar: Der Logo-Button ist fokussierbar und hat einen sprechenden
	 * Accessible Name. Er ist per Enter/Space-Taste auslösbar.
	 */
	test('AK3: Logo-Button ist barrierefrei bedienbar (Accessible Name + Tastatur)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });

		// Accessible Name vorhanden.
		await expect(logoBtn).toBeVisible();
		await expect(logoBtn).toHaveAccessibleName(/Zum Dashboard/i);

		// Tastatur: Tab bis zum Logo-Button und Enter drücken.
		// Zuerst anderen Tab wählen, damit der Klick merklich umschaltet.
		// Exact-Match nötig: /Aufgaben/i würde auch "Aufgabenwald" und "Erledigte Aufgaben" treffen.
		const aufgabenTab = page.getByRole('tab', { name: 'Aufgaben', exact: true });
		await aufgabenTab.click();

		await logoBtn.focus();
		await expect(logoBtn).toBeFocused();
		await page.keyboard.press('Enter');

		// Dashboard-Tab ist nach Tastatureingabe aktiv.
		const dashboardTab = page.getByRole('tab', { name: /Dashboard/i });
		await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
	});

	/**
	 * AK4 — Keine Regression der H1: Die Ebene-1-Überschrift „Priority Pilot" bleibt sichtbar.
	 * Deckt helpers.ts `waitForStableView`, login.spec.ts und smoke.spec.ts ab.
	 */
	test('AK4: H1 „Priority Pilot" bleibt sichtbar (keine Regression)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('heading', { name: 'Priority Pilot', level: 1 })).toBeVisible();
	});

	/**
	 * AK5 — Mobile-First (375px): Bei 375px-Viewport ist das Logo sichtbar und es entsteht
	 * kein horizontales Scrollen.
	 */
	test('AK5: Logo sichtbar und kein horizontaler Overflow bei 375px-Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await waitForStableView(page);

		const header = page.getByRole('banner');
		const logoBtn = header.getByRole('button', { name: /Zum Dashboard/i });
		await expect(logoBtn).toBeVisible();

		// Kein horizontaler Overflow.
		const overflowsHorizontally = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(overflowsHorizontally, 'Kein horizontaler Overflow auf 375px').toBe(false);
	});
});
