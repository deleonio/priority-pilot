import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #285 „Header-Toolbar kompakter (Icon-Buttons) und Dark-Mode-Schalter in die
 * Einstellungen" (Stufe 1 TDD, der einklagbare Vertrag) — Teil Einstellungen.
 *
 * Ziel (Teil 2): Der Darstellungs-/Theme-Umschalter wandert aus der Header-Toolbar in den
 * Settings-Tab „Allgemein" (`/settings/general`). Dort steht ein Bedienelement mit den drei
 * Optionen **System / Hell / Dunkel**, verdrahtet mit `useTheme` aus `theme.ts` (localStorage-Key
 * `pp-theme`, siehe STORAGE_KEY dort).
 *
 * Diese Tests sind bewusst **rot**, bis das Bedienelement im Allgemein-Tab existiert und mit
 * `useTheme` verdrahtet ist. Sie prüfen reines UI-Verhalten gegen das echte Backend (kein Mock);
 * die Fixture authentifiziert `/auth/me`, damit die Auth-Gate durchlässig ist.
 *
 * Robustheit gegenüber der noch offenen Umsetzungsform: Ob das Bedienelement als Radiogruppe
 * (`role="radiogroup"` + `role="radio"`), als Single-Select-Listbox (`role="listbox"` +
 * `role="option"`) oder als Combobox (`role="combobox"`) umgesetzt wird, ist Sache der
 * Implementierung. Die Helfer unten treffen daher jede dieser Formen über den Accessible Name.
 */

/** localStorage-Schlüssel der Theme-Wahl — identisch zu STORAGE_KEY in `src/lib/theme.ts`. */
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
 * Findet die auswählbare Option zu einem Modus (System/Hell/Dunkel) — als `radio`, `option`
 * oder (Fallback) als `button`. Wird zum Aktivieren des jeweiligen Modus geklickt.
 */
const appearanceOption = (page: Page, name: RegExp): Locator =>
	page.getByRole('radio', { name }).or(page.getByRole('option', { name })).or(page.getByRole('button', { name }));

test.describe('#285 Einstellungen – Darstellungs-Umschalter (Allgemein-Tab)', () => {
	/**
	 * AK5 — Bedienelement mit drei Optionen: Der Allgemein-Tab zeigt ein Darstellungs-Bedienelement
	 * mit den drei Optionen System / Hell / Dunkel.
	 */
	test('AK5: Allgemein-Tab zeigt ein Darstellungs-Bedienelement mit System/Hell/Dunkel', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Das benannte Bedienelement „Darstellung" ist sichtbar.
		await expect(appearanceControl(page)).toBeVisible();

		// Die drei Optionen sind vorhanden (im DOM angebunden).
		await expect(appearanceOption(page, /System/i).first()).toBeAttached();
		await expect(appearanceOption(page, /Hell/i).first()).toBeAttached();
		await expect(appearanceOption(page, /Dunkel/i).first()).toBeAttached();
	});

	/**
	 * AK6 (Wirkung) — Auswahl „Dunkel" setzt `data-theme="dark"` am `<html>` und speichert die Wahl
	 * in localStorage (`pp-theme`="dark").
	 */
	test('AK6: Auswahl „Dunkel" setzt data-theme="dark" und speichert die Wahl', async ({ page }) => {
		// Feste helle OS-Präferenz, damit ein späterer „System"-Wechsel deterministisch auflöst.
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const html = page.locator('html');

		// „Dunkel" auswählen.
		await appearanceOption(page, /Dunkel/i)
			.first()
			.click();

		// Effektives Theme am <html>-Element ist „dark".
		await expect(html).toHaveAttribute('data-theme', 'dark');

		// Die Wahl ist in localStorage gespeichert.
		const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
		expect(stored).toBe('dark');
	});

	/**
	 * AK6 (Persistenz) — Die Wahl „Dunkel" bleibt nach einem Seiten-Reload erhalten
	 * (localStorage-getriebener FOUC-freier Anstrich).
	 */
	test('AK6: „Dunkel" bleibt nach Reload erhalten (Persistenz)', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const html = page.locator('html');

		await appearanceOption(page, /Dunkel/i)
			.first()
			.click();
		await expect(html).toHaveAttribute('data-theme', 'dark');

		// Nach Reload bleibt „dark" wirksam.
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await expect(html).toHaveAttribute('data-theme', 'dark');

		const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
		expect(stored).toBe('dark');
	});

	/**
	 * AK6 (System folgt OS) — Auswahl „System" folgt der OS-Präferenz: Bei heller OS-Präferenz löst
	 * „System" zu `data-theme="light"` auf. Ausgangspunkt ist eine explizite „Dunkel"-Wahl, damit der
	 * Wechsel nach „System" tatsächlich einen sichtbaren Zustandswechsel erzwingt.
	 */
	test('AK6: „System" folgt der OS-Präferenz (hell → data-theme="light")', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		const html = page.locator('html');

		// Zunächst „Dunkel", damit „System" danach einen echten Wechsel bewirkt.
		await appearanceOption(page, /Dunkel/i)
			.first()
			.click();
		await expect(html).toHaveAttribute('data-theme', 'dark');

		// „System" auswählen → folgt der (hellen) OS-Präferenz → data-theme="light".
		await appearanceOption(page, /System/i)
			.first()
			.click();
		await expect(html).toHaveAttribute('data-theme', 'light');

		// Persistiert als „system".
		const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
		expect(stored).toBe('system');
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
