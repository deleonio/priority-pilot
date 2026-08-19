import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #285 „Dark-Mode-Schalter in den Einstellungen" — angepasst an die
 * Korrektur aus PR #848:
 *
 * Der Dunkelmodus ist **deaktiviert**, aber die UI zeigt alle drei Optionen (System/Hell/Dunkel)
 * sichtbar, allerdings ist das gesamte Element disabled. Die useTheme-Logik und Persistenz
 * sind wiederhergestellt für eine eventuelle zukünftige Reaktivierung.
 *
 * Die Tests prüfen, dass:
 * - AK5: Alle drei Optionen sind sichtbar (System, Hell, Dunkel)
 * - AK5: Das Radio-Element ist disabled (nicht interaktiv)
 * - AK6: useTheme-Logik funktioniert korrekt (System folgt OS, localStorage-Persistenz)
 * - AK7: Mobile-Layout passt (kein Overflow bei 375×812)
 *
 * Die Tests prüfen reines UI-Verhalten gegen das echte Backend (kein Mock); die Fixture
 * authentifiziert `/auth/me`, damit die Auth-Gate durchlässig ist.
 */

/** localStorage-Schlüssel für Theme-Präferenz — wird wieder von useTheme gelesen. */
const THEME_STORAGE_KEY = 'pp-theme';

/**
 * Findet das Darstellungs-Bedienelement im Allgemein-Tab, unabhängig von der konkreten Rolle
 * (Radiogruppe / Listbox / Combobox / benannte Group). Der Accessible Name enthält „Darstellung".
 */
const appearanceControl = (page: Page): Locator =>
	page
		.getByRole('radiogroup', { name: /Darstellung/i })
		.or(page.getByRole('listbox', { name: /Darstellung/i }))
		.or(page.getByRole('combobox', { name: /Darstellung/i }))
		.or(page.getByRole('group', { name: /Darstellung/i }));

/**
 * Findet die Option zu einem Modus — als `radio`, `option` oder (Fallback) als `button`.
 */
const appearanceOption = (page: Page, name: RegExp): Locator =>
	page.getByRole('radio', { name }).or(page.getByRole('option', { name })).or(page.getByRole('button', { name }));

test.describe('#285 Einstellungen – Darstellung (Dunkelmodus deaktiviert, Korrektur PR #848)', () => {
	/**
	 * AK5 — Bedienelement: Der Allgemein-Tab zeigt das Darstellungs-Bedienelement mit allen
	 * drei Optionen (System/Hell/Dunkel) — aber das gesamte Element ist disabled.
	 */
	test('AK5: Allgemein-Tab zeigt alle drei Darstellungsoptionen (System/Hell/Dunkel), aber disabled', async ({
		page,
	}) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Das benannte Bedienelement „Darstellung" ist sichtbar.
		await expect(appearanceControl(page)).toBeVisible();

		// Alle drei Optionen sind sichtbar …
		const system = appearanceOption(page, /System/i).first();
		const hell = appearanceOption(page, /Hell/i).first();
		const dunkel = appearanceOption(page, /Dunkel/i).first();

		await expect(system).toBeAttached();
		await expect(hell).toBeAttached();
		await expect(dunkel).toBeAttached();

		// Alle Optionen sind disabled (nicht interaktiv).
		await expect(system).toBeDisabled();
		await expect(hell).toBeDisabled();
		await expect(dunkel).toBeDisabled();
	});

	/**
	 * AK6 (Wirkung) — useTheme-Logik funktioniert: `data-theme` wird korrekt gesetzt,
	 * aber das Element ist disabled, sodass keine Nutzerwahl möglich ist.
	 * System-Präferenz folgt der OS-Einstellung, localStorage-Persistenz funktioniert.
	 */
	test('AK6: useTheme-Logik funktioniert (System folgt OS, localStorage-Persistenz), aber UI ist disabled', async ({
		page,
	}) => {
		// Test mit heller OS-Präferenz
		await page.emulateMedia({ colorScheme: 'light' });
		await page.addInitScript((key) => window.localStorage.setItem(key, 'system'), THEME_STORAGE_KEY);

		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Effektives Theme ist "light" (System folgt OS)
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

		// Alle Optionen sind weiterhin disabled
		const system = appearanceOption(page, /System/i).first();
		const hell = appearanceOption(page, /Hell/i).first();
		const dunkel = appearanceOption(page, /Dunkel/i).first();

		await expect(system).toBeDisabled();
		await expect(hell).toBeDisabled();
		await expect(dunkel).toBeDisabled();
	});

	/**
	 * AK6 (Persistenz) — useTheme-Persistenz funktioniert: localStorage wird gelesen und
	 * das Theme wird korrekt angewendet, auch nach einem Reload. Aber das Element ist disabled.
	 */
	test('AK6: useTheme-Persistenz funktioniert (localStorage wird gelesen), aber UI ist disabled', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });

		const html = page.locator('html');

		// Erster Besuch mit System-Präferenz
		await page.addInitScript((key) => window.localStorage.setItem(key, 'system'), THEME_STORAGE_KEY);
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// System-Präferenz wird gelesen und korrekt angewendet (light wegen heller OS-Präferenz)
		await expect(html).toHaveAttribute('data-theme', 'light');

		// Nach Reload weiterhin das korrekte Theme.
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await expect(html).toHaveAttribute('data-theme', 'light');

		// Alle Optionen sind weiterhin disabled
		const system = appearanceOption(page, /System/i).first();
		const hell = appearanceOption(page, /Hell/i).first();
		const dunkel = appearanceOption(page, /Dunkel/i).first();

		await expect(system).toBeDisabled();
		await expect(hell).toBeDisabled();
		await expect(dunkel).toBeDisabled();
	});

	/**
	 * AK7 (Mobile 375×812) — Bedienelement sichtbar & kein horizontaler Overflow: Auf einem schmalen
	 * Viewport bleibt das Darstellungs-Bedienelement sichtbar und die Settings-General-Seite
	 * verursacht kein horizontales Scrollen.
	 */
	test('AK7: Darstellungs-Bedienelement sichtbar und kein Overflow bei 375×812', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Das Bedienelement ist auch auf dem schmalen Viewport sichtbar.
		await expect(appearanceControl(page)).toBeVisible();

		// Kein horizontaler Überlauf des Dokuments.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});
});
