import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #229 „Handbuch" — Teilstück #256 (In-App-Hilfeseite).
 *
 * Ziel (siehe KI-Analyse im Ticket): Der Header trägt einen icon-only Hilfe-Button mit Tooltip; ein
 * Klick öffnet eine Hilfeseite, die das Nutzerhandbuch als formatiertes Markdown (echte HTML-
 * Überschriften) rendert. Die Seite ist Mobile-First und läuft bei 375px Breite nicht horizontal über.
 *
 * Diese Tests prüfen reines UI-Verhalten gegen das echte Backend (kein Mock, wie in `crud.spec.ts`);
 * der Vite-Proxy reicht API-Requests an das Express-Backend mit In-Memory-DB durch (siehe
 * `playwright.config.ts`). Sie sind **rot**, bis der Hilfe-Button, die Route `/hilfe` und der
 * Markdown-Renderer umgesetzt sind. Die Implementierung folgt durch die Umsetzung.
 */
test.describe('#229 Nutzerhandbuch', () => {
	/**
	 * AK3 — Header-Hilfe-Button: Rechts oben im Header liegt ein zugänglicher, icon-only Button mit
	 * Tooltip/Accessible-Name „Hilfe". Icon-only heißt: kein sichtbarer Text „Hilfe" im Button-Body,
	 * der Name kommt allein aus dem Tooltip/aria-Label.
	 */
	test('AK3: Header zeigt einen icon-only Hilfe-Button mit Tooltip', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const hilfeButton = page.getByRole('button', { name: /Hilfe/ });
		await expect(hilfeButton).toBeVisible();

		// Der zugängliche Name enthält „Hilfe" (aus Tooltip/aria-Label).
		await expect(hilfeButton).toHaveAccessibleName(/Hilfe/);

		// Icon-only: der sichtbare Text des Buttons enthält NICHT das Wort „Hilfe"
		// (der Name stammt aus dem Tooltip, nicht aus einem sichtbaren Text-Span).
		const sichtbarerText = ((await hilfeButton.innerText()) ?? '').trim();
		expect(sichtbarerText).not.toMatch(/Hilfe/);
	});

	/**
	 * AK4 — Hilfeseite mit gerendertem Markdown: Ein Klick auf den Hilfe-Button führt zur Hilfeseite
	 * (Route `/hilfe`), die das Handbuch als formatiertes Markdown mit echten HTML-Überschriften
	 * (h1/h2) rendert.
	 */
	test('AK4: Klick auf den Hilfe-Button zeigt das Handbuch als formatiertes Markdown', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Hilfe/ }).click();
		await waitForStableView(page);

		// Die Hilfeseite ist unter der Route /hilfe erreichbar.
		await expect(page).toHaveURL(/\/hilfe/);

		// Das Markdown ist zu echten HTML-Überschriften gerendert (mind. eine h1 oder h2).
		const ueberschrift = page.locator('h1, h2').first();
		await expect(ueberschrift).toBeVisible();
	});

	/**
	 * AK4 (Direktaufruf) — die Route `/hilfe` liefert den Handbuch-Inhalt auch bei direkter Navigation.
	 */
	test('AK4: Direktaufruf von /hilfe zeigt den Handbuch-Inhalt', async ({ page }) => {
		await page.goto('/hilfe');
		await waitForStableView(page);

		const ueberschrift = page.locator('h1, h2').first();
		await expect(ueberschrift).toBeVisible();
	});

	/**
	 * AK5 — Mobile-First: Bei 375px Breite läuft die Hilfeseite nicht horizontal über
	 * (`scrollWidth` des Dokuments bleibt innerhalb der Viewport-Breite).
	 */
	test('AK5: Hilfeseite läuft bei 375px nicht horizontal über', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/hilfe');
		await waitForStableView(page);

		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(375);
	});
});
