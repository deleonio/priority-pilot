import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Vertrag für die Bildwahl „Bild der Lebensbalance" — die Zifferblatt-Varianten der Startseite
 * (`BALANCE_VARIANTS` in `lib/balanceVariant.ts`, localStorage-Key `pp-balance-variant`).
 *
 * Der Bildmacher `zifferblatt-shots.spec.ts` läuft bewusst nur mit `SHOTS` und nur im Desktop-
 * Viewport; dieser Spec prüft den Umschalter selbst — im Mobile-Leitfall des Projekts (375 px),
 * weil die Optionsliste mit „Blüte" und „Kristall" auf sieben Einträge gewachsen ist und der
 * Hinweistext länger wurde (mobile-ui-rules.md).
 */

/** localStorage-Schlüssel der Bildwahl — muss mit `balanceVariant.ts` übereinstimmen. */
const VARIANT_STORAGE_KEY = 'pp-balance-variant';

/** Alle sieben Bilder in Einstellungs-Reihenfolge (`BALANCE_VARIANTS`). */
const VARIANTEN = ['Herz', 'Blasen', 'Scheiben', 'Ringe', 'Strahlen', 'Blüte', 'Kristall'] as const;

/** Die Radiogroup im Allgemein-Tab — Accessible Name „Bild der Lebensbalance" (Rolle je nach KoliBri-Version `group` oder `radiogroup`). */
const variantGroup = (page: Page): Locator =>
	page
		.getByRole('radiogroup', { name: /Bild der Lebensbalance/i })
		.or(page.getByRole('group', { name: /Bild der Lebensbalance/i }));

/** Eine wählbare Option der Gruppe, unabhängig von der konkreten Rolle (radio/option/button). */
const variantOption = (page: Page, label: string): Locator =>
	variantGroup(page)
		.getByRole('radio', { name: label, exact: true })
		.or(variantGroup(page).getByRole('option', { name: label, exact: true }))
		.or(variantGroup(page).getByRole('button', { name: label, exact: true }));

test.describe('Bild der Lebensbalance – Umschalter im Allgemein-Tab', () => {
	test('375px: Alle sieben Bilder wählbar, „Blüte" erscheint auf dem Dashboard', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Die Gruppe mit allen sieben Optionen ist sichtbar, jede Option interaktiv.
		await expect(variantGroup(page)).toBeVisible();
		for (const label of VARIANTEN) {
			await expect(variantOption(page, label)).toBeEnabled();
		}

		// Der längere Hinweis darf den schmalen Viewport nicht horizontal überlaufen lassen.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);

		// „Blüte" wählen — Persistenz wie beim Theme: reine localStorage-Wahl, kein Schreibrequest.
		await variantOption(page, 'Blüte').click();
		const stored = await page.evaluate((key) => localStorage.getItem(key), VARIANT_STORAGE_KEY);
		expect(stored).toBe('bluete');

		// Das Dashboard zeigt das gewählte Bild: Figur sichtbar (Glas oder SVG-Rückfall) und die
		// Bühne trägt die Variante. Ohne Säulen entfällt die Karte — die Fixture liefert welche.
		await page.goto('/');
		await waitForStableView(page);
		await expect(page.getByTestId(/heart-balance-(canvas|svg)/)).toBeVisible();
		await expect(page.locator('.heart-balance-stage')).toHaveAttribute('data-variante', 'bluete');
	});
});
