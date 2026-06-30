import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #125 „Header – Toolbar" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets (siehe Triage-Analyse, Owner-Entscheidung): Die einfachen Bedienelemente rechts
 * oben im Header — „Neuen Task anlegen", „Aktualisieren" und der Darstellungs-Umschalter — werden zu
 * einer **echten** `KolToolbar` (Toolbar-Rolle, gemeinsame Pfeiltasten-Navigation, sprechendes
 * `_label`) gruppiert. Der `KolPopoverButton` „Einstellungen" bleibt **außerhalb** der Toolbar als
 * Geschwister-Element erhalten (er trägt Kind-Inhalt, der sich nicht über `_items` abbilden lässt).
 *
 * Diese Tests sind **rot**, bis die Umsetzung den `<div className="toolbar">` in `App.tsx` durch eine
 * `KolToolbar _label="Kopf-Aktionen"` ersetzt. Sie prüfen reines UI-Verhalten gegen das echte Backend
 * (kein Mock, wie in `crud.spec.ts`); der Vite-Proxy reicht API-Requests an das Express-Backend mit
 * In-Memory-DB durch (siehe `playwright.config.ts`).
 */
test.describe('#125 Header – Toolbar', () => {
	/**
	 * AK1 — Toolbar-Semantik: Die drei Bedienelemente sind in einem Element mit Toolbar-Rolle
	 * (sprechendes Label „Kopf-Aktionen") gruppiert; die drei Buttons sind dessen Nachkommen.
	 */
	test('AK1: Header-Aktionen liegen in einer benannten Toolbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		await expect(toolbar.getByRole('button', { name: 'Neuen Task anlegen' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Aktualisieren' })).toBeVisible();
		// Der Darstellungs-Umschalter trägt ein dynamisches, sprechendes Label „Darstellung: …".
		await expect(toolbar.getByRole('button', { name: /Darstellung/ })).toBeVisible();
	});

	/**
	 * AK2 — keine Regression der Aktionen: „Neuen Task anlegen" öffnet den Anlege-Dialog,
	 * „Aktualisieren" lädt die Liste neu (Button ist klickbar und nicht dauerhaft deaktiviert).
	 */
	test('AK2: Aktionen in der Toolbar funktionieren weiterhin', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });

		// „Neuen Task anlegen" öffnet den Dialog (gleicher Flow wie in crud.spec.ts).
		await toolbar.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		// Dialog wieder schließen, damit „Aktualisieren" frei klickbar ist.
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		// „Aktualisieren" löst einen erneuten Listen-Request aus (beweist: Button verdrahtet & aktiv).
		const reloadRequest = page.waitForRequest(
			(request) => request.url().includes('/tasks') && request.method() === 'GET',
		);
		await toolbar.getByRole('button', { name: 'Aktualisieren' }).click();
		await reloadRequest;
	});

	/**
	 * AK3 — Theme-Umschalter unverändert: Klicks wechseln das Farbschema zyklisch
	 * System → Hell → Dunkel; das effektive Theme spiegelt sich in `data-theme` am `<html>`.
	 */
	test('AK3: Darstellungs-Umschalter wechselt das Farbschema zyklisch', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		const themeButton = toolbar.getByRole('button', { name: /Darstellung/ });
		const html = page.locator('html');

		// Start: „System" (Standard). Erster Klick erzwingt „Hell" → data-theme="light".
		await themeButton.click();
		await expect(html).toHaveAttribute('data-theme', 'light');

		// Zweiter Klick erzwingt „Dunkel" → data-theme="dark".
		await themeButton.click();
		await expect(html).toHaveAttribute('data-theme', 'dark');
	});

	/**
	 * AK4 — Popover-Button bleibt außerhalb der Toolbar erreichbar: „Einstellungen" ist KEIN
	 * Nachkomme der Toolbar, der Säulen-Gewichtungs-Dialog ist weiterhin über das Popover öffenbar.
	 */
	test('AK4: „Einstellungen"-Popover bleibt außerhalb der Toolbar erreichbar', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		// Der Einstellungs-Button ist bewusst NICHT Teil der Toolbar (Owner-Entscheidung).
		await expect(toolbar.getByRole('button', { name: 'Einstellungen' })).toHaveCount(0);

		// Bestehender Flow (vgl. crud.spec.ts `openPillarWeights`) bleibt grün.
		await page.getByRole('button', { name: 'Einstellungen' }).click();
		await page.getByRole('button', { name: 'Persönliche Säulen-Verteilung' }).click();
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
	});
});
