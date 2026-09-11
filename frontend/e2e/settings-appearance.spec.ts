import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #285 „Dark-Mode-Schalter in den Einstellungen".
 *
 * Der Allgemein-Tab (`/settings/general`) zeigt ein Darstellungs-Bedienelement mit den drei
 * Optionen System / Hell / Dunkel, verdrahtet mit `useTheme` aus `theme.ts` (localStorage-Key
 * `pp-theme`, siehe THEME_STORAGE_KEY dort).
 *
 * Die Tests prüfen, dass:
 * - AK5: Alle drei Optionen sind sichtbar und interaktiv (System, Hell, Dunkel)
 * - AK6: Auswahl wirkt sich auf `data-theme` aus und wird in localStorage persistiert
 * - AK7: Mobile-Layout passt (kein Overflow bei 375×812)
 *
 * Die Tests prüfen reines UI-Verhalten gegen das echte Backend (kein Mock); die Fixture
 * authentifiziert `/auth/me`, damit die Auth-Gate durchlässig ist.
 */

/** localStorage-Schlüssel für Theme-Präferenz — wird von useTheme gelesen. */
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
	 * mit den drei Optionen System / Hell / Dunkel, interaktiv (nicht disabled).
	 */
	test('AK5: Allgemein-Tab zeigt ein Darstellungs-Bedienelement mit System/Hell/Dunkel', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page);

		// Das benannte Bedienelement „Darstellung" ist sichtbar.
		await expect(appearanceControl(page)).toBeVisible();

		const system = appearanceOption(page, /System/i).first();
		const hell = appearanceOption(page, /Hell/i).first();
		const dunkel = appearanceOption(page, /Dunkel/i).first();

		// Die drei Optionen sind vorhanden und interaktiv.
		await expect(system).toBeEnabled();
		await expect(hell).toBeEnabled();
		await expect(dunkel).toBeEnabled();
	});

	/**
	 * AK6 (Wirkung) — Auswahl „Dunkel" setzt `data-theme="dark"` am `<html>` und speichert die Wahl
	 * in localStorage (`pp-theme`="dark").
	 */
	test('AK6: Auswahl „Dunkel" setzt data-theme="dark" und speichert die Wahl', async ({ page }) => {
		// Feste helle OS-Präferenz, damit ein späterer „System"-Wechsel deterministisch auflöst.
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/settings/general');
		await waitForStableView(page);

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
		await waitForStableView(page);

		const html = page.locator('html');

		await appearanceOption(page, /Dunkel/i)
			.first()
			.click();
		await expect(html).toHaveAttribute('data-theme', 'dark');

		// Nach Reload bleibt „dark" wirksam.
		await page.reload();
		await waitForStableView(page);
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
		await waitForStableView(page);

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
		await waitForStableView(page);

		// Das Bedienelement ist auch auf dem schmalen Viewport sichtbar.
		await expect(appearanceControl(page)).toBeVisible();

		// Kein horizontaler Überlauf des Dokuments.
		const overflowsHorizontally = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
		expect(overflowsHorizontally).toBe(false);
	});
});
