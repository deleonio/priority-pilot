import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Spec-Tests für #285 „Dark-Mode-Schalter in den Einstellungen" — angepasst an die
 * Entscheidung aus PR #848 (P1-2, Menschen-Entscheidung Kommentar 5325527064):
 *
 * Der Dunkelmodus ist **deaktiviert** — KoliBri-Komponenten rendern im Dunkelmodus weiter
 * auf Weiß (@public-ui/theme-default reagiert nicht auf `data-theme`), deshalb läuft die App
 * fix im Hell-Modus. Das Bedienelement „Darstellung" zeigt „Hell" als einzige, deaktivierte
 * Option; `theme.ts` und der Anti-FOUC-Bootstrap in `index.html` setzen `data-theme` immer
 * auf `light`.
 *
 * Die ursprünglichen AK6-Tests („Dunkel" wählen/wirken/persistieren, „System" folgt OS) sind
 * damit obsolet — ihr Verhalten ist bewusst entfernt. Der neue AK6 kehrt die Richtung um:
 * Auch eine localStorage-Altlast `pp-theme=dark` aus Sessions vor der Deaktivierung darf
 * den Hell-Modus nicht mehr durchbrechen.
 *
 * Die Tests prüfen reines UI-Verhalten gegen das echte Backend (kein Mock); die Fixture
 * authentifiziert `/auth/me`, damit die Auth-Gate durchlässig ist.
 */

/** localStorage-Schlüssel aus Zeiten des Umschalters — Altlast, wird von theme.ts nicht mehr gelesen. */
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

test.describe('#285 Einstellungen – Darstellung (Dunkelmodus deaktiviert, PR #848)', () => {
	/**
	 * AK5 — Bedienelement: Der Allgemein-Tab zeigt das Darstellungs-Bedienelement mit genau
	 * einer Option „Hell" — deaktiviert, keine Auswahl möglich. „System" und „Dunkel" existieren
	 * nicht mehr.
	 */
	test('AK5: Allgemein-Tab zeigt „Hell" als einzige, deaktivierte Darstellungsoption', async ({ page }) => {
		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Das benannte Bedienelement „Darstellung" ist sichtbar.
		await expect(appearanceControl(page)).toBeVisible();

		// Einzige Option ist „Hell" …
		const hell = appearanceOption(page, /Hell/i).first();
		await expect(hell).toBeAttached();

		// … „System" und „Dunkel" existieren nicht mehr.
		await expect(appearanceOption(page, /System/i)).toHaveCount(0);
		await expect(appearanceOption(page, /Dunkel/i)).toHaveCount(0);

		// Keine Auswahl möglich: die Option ist deaktiviert.
		await expect(hell).toBeDisabled();
	});

	/**
	 * AK6 (Wirkung) — Keine Nutzerwahl mehr: `data-theme` bleibt fix „light" — unabhängig von
	 * einer localStorage-Altlast `pp-theme=dark` (Session vor der Deaktivierung) und unabhängig
	 * von einer dunklen OS-Präferenz. Kein Dunkel-Blitz beim Laden (Anti-FOUC-Bootstrap).
	 *
	 * Der FOUC-Wächter schneidet ab `document_start` jede je gesehene `data-theme`-Phase mit
	 * (MutationObserver, noch vor dem Inline-Bootstrap im <head> registriert): Ein Dunkel-Blitz,
	 * den `applyInitialTheme` erst Millisekunden später korrigiert, wäre eine reine
	 * Endzustands-Assertion nicht.
	 */
	test('AK6: data-theme bleibt „light" — Altlast pp-theme=dark und dunkle OS-Präferenz bleiben wirkungslos', async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), THEME_STORAGE_KEY);
		await page.addInitScript(() => {
			const seen: string[] = [];
			(window as unknown as { __themeHistory: string[] }).__themeHistory = seen;
			const watch = () => {
				new MutationObserver(() => seen.push(document.documentElement.dataset.theme ?? '')).observe(
					document.documentElement,
					{
						attributes: true,
						attributeFilter: ['data-theme'],
					},
				);
			};
			// <html> existiert zu document_start evtl. noch nicht — dann dessen Einfügen abwarten.
			if (document.documentElement) {
				watch();
			} else {
				new MutationObserver(watch).observe(document, { childList: true });
			}
		});

		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');

		// Effektives Theme am <html>-Element ist „light" — von Anfang an, ohne Dunkel-FOUC.
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		const history = await page.evaluate(
			() => (window as unknown as { __themeHistory?: string[] }).__themeHistory ?? [],
		);
		expect(history, `data-theme-Phasen während des Ladens: ${history.join(' → ')}`).not.toContain('dark');
	});

	/**
	 * AK6 (Persistenz) — Auch nach einem Reload bleibt der Hell-Modus wirksam; die Altlast wird
	 * nicht „wiederbelebt".
	 */
	test('AK6: Hell-Modus bleibt nach Reload erhalten (kein Rückfall in Dunkel)', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), THEME_STORAGE_KEY);

		const html = page.locator('html');

		await page.goto('/settings/general');
		await waitForStableView(page, 'Priority Pilot');
		await expect(html).toHaveAttribute('data-theme', 'light');

		// Nach Reload weiterhin „light".
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await expect(html).toHaveAttribute('data-theme', 'light');
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
